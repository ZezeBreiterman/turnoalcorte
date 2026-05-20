import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Clock, Scissors, User, ChevronRight, Plus, Tag } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { keys } from '@/lib/query-keys'
import {
  formatTime,
  formatDayHeading,
  formatPrice,
  durationLabel,
  now,
  startOfDay,
  endOfDay,
  addMinutes,
} from '@/lib/time'
import type { Appointment, Barber, Service, ServiceDiscount } from '@/types/database'
import { PageShell } from '@/components/layout/PageShell'
import { StatusBadge } from '@/components/ui/badge'
import { NamedAvatar } from '@/components/ui/avatar'
import { AppointmentCardSkeleton, KPISkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetHeader,
  SheetBody,
  SheetFooter,
  FormField,
} from '@/components/ui/sheet'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimePicker } from '@/components/ui/TimePicker'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { AppointmentDetailSheet } from '@/components/appointments/AppointmentDetailSheet'

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  barber_id: z.string().uuid('Select a barber'),
  service_id: z.string().uuid('Select a service'),
  client_name: z.string().min(1, 'Client name is required').max(100),
  client_phone: z.string().min(6, 'Phone is required').max(30),
  date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  notes: z.string().max(500).optional(),
  status: z.enum(['pending', 'confirmed', 'checked_in']),
})

type FormValues = z.infer<typeof schema>

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchTodayAppointments(): Promise<Appointment[]> {
  const todayStart = startOfDay(now()).toISOString()
  const todayEnd = endOfDay(now()).toISOString()

  const { data, error } = await supabase
    .from('appointments')
    .select(`*, client:clients(*), barber:barbers(*), service:services(*)`)
    .gte('start_time', todayStart)
    .lte('start_time', todayEnd)
    .not('status', 'in', '("cancelled","no_show")')
    .order('start_time', { ascending: true })

  if (error) throw error
  return (data ?? []) as Appointment[]
}

async function fetchBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from('barbers')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Barber[]
}

async function fetchServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Service[]
}

async function fetchDiscountsByService(serviceId: string): Promise<ServiceDiscount[]> {
  const { data, error } = await supabase
    .from('service_discounts')
    .select('*')
    .eq('service_id', serviceId)
    .eq('active', true)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ServiceDiscount[]
}

// ── Discount helpers ──────────────────────────────────────────────────────────

function applyDiscount(price: number, discount: ServiceDiscount): number {
  if (discount.discount_type === 'percent') {
    return Math.max(0, price - (price * discount.discount_value) / 100)
  }
  return Math.max(0, price - discount.discount_value)
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

function KPIStrip({ appointments }: { appointments: Appointment[] }) {
  const { t } = useTranslation('dashboard')
  const total = appointments.length
  const completed = appointments.filter((a) => a.status === 'completed').length
  const revenue = appointments
    .filter((a) => a.status === 'completed')
    .reduce((sum, a) => sum + Number(a.price_charged), 0)
  const pending = appointments.filter((a) => a.status === 'pending').length

  const kpis = [
    { label: t('kpi.todays_appointments'), value: total.toString(), sub: t('kpi.completed', { count: completed }) },
    { label: t('kpi.revenue_today'), value: formatPrice(revenue), sub: t('kpi.services_rendered', { count: completed }) },
    { label: t('kpi.pending_confirmation'), value: pending.toString(), sub: pending > 0 ? t('kpi.need_followup') : t('kpi.all_clear') },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="p-5">
            <p className="text-xs text-[var(--color-fg-muted)] font-medium mb-2">{kpi.label}</p>
            <p className="text-2xl font-semibold tracking-tight text-[var(--color-fg)] font-[var(--font-mono)]">
              {kpi.value}
            </p>
            <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">{kpi.sub}</p>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

// ── Appointment Card ──────────────────────────────────────────────────────────

function AppointmentCard({ appointment, index, onClick }: { appointment: Appointment; index: number; onClick: () => void }) {
  const isNow =
    new Date(appointment.start_time) <= now() &&
    new Date(appointment.end_time) >= now()

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        'group relative flex items-center gap-4 rounded-[var(--radius-lg)] border p-4 transition-all duration-150',
        'hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)] cursor-pointer',
        isNow
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/[0.04]'
          : 'border-[var(--color-border)] bg-[var(--color-bg)]'
      )}
    >
      {isNow && (
        <span className="absolute -left-px top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-[var(--color-primary)]" />
      )}

      <NamedAvatar
        name={appointment.barber?.name ?? '?'}
        src={appointment.barber?.photo_url}
        color={appointment.barber?.color}
        size="md"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-[var(--color-fg)] truncate">
            {appointment.client?.name ?? 'Unknown client'}
          </p>
          {isNow && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/10 rounded-full px-2 py-0.5">
              <span className="size-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
              NOW
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
          <Scissors className="size-3 shrink-0" />
          <span className="truncate">{appointment.service?.name ?? 'Service'}</span>
          <span className="text-[var(--color-fg-subtle)]">·</span>
          <span>{durationLabel(appointment.service?.duration_minutes ?? 0)}</span>
          <span className="text-[var(--color-fg-subtle)]">·</span>
          <User className="size-3 shrink-0" />
          <span className="truncate">{appointment.barber?.name ?? 'Barber'}</span>
        </div>
      </div>

      <div className="text-right shrink-0 space-y-1.5">
        <p className="text-sm font-medium text-[var(--color-fg)] font-[var(--font-mono)] tabular-nums">
          {formatTime(appointment.start_time)}
        </p>
        <StatusBadge status={appointment.status} />
      </div>

      <ChevronRight className="size-4 text-[var(--color-fg-subtle)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  )
}

// ── Discount Selector (used inside AddAppointmentSheet) ───────────────────────

interface DiscountSelectorProps {
  service: Service
  selectedDiscountId: string
  onSelect: (discountId: string) => void
}

function DiscountSelector({ service, selectedDiscountId, onSelect }: DiscountSelectorProps) {
  const { t } = useTranslation('dashboard')
  const { data: discounts = [], isLoading } = useQuery({
    queryKey: keys.discounts.byService(service.id),
    queryFn: () => fetchDiscountsByService(service.id),
    enabled: !!service.id,
  })

  if (isLoading || discounts.length === 0) return null

  const selected = discounts.find((d) => d.id === selectedDiscountId)
  const finalPrice = selected ? applyDiscount(service.price, selected) : service.price

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/[0.04] px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="size-3.5 text-[var(--color-primary)]" />
        <span className="text-xs font-semibold text-[var(--color-primary)]">{t('apply_discount')}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* "No discount" option */}
        <button
          type="button"
          onClick={() => onSelect('')}
          className={cn(
            'text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border transition-all duration-100',
            !selectedDiscountId
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold'
              : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]'
          )}
        >
          {t('no_discount')}
        </button>

        {discounts.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d.id === selectedDiscountId ? '' : d.id)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border transition-all duration-100',
              selectedDiscountId === d.id
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold'
                : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]'
            )}
          >
            <kbd className="font-mono font-bold">{d.code}</kbd>
            <span className="text-[var(--color-fg-subtle)]">·</span>
            <span>{d.label}</span>
            <span className="font-semibold">
              {d.discount_type === 'percent' ? `-${d.discount_value}%` : `-${formatPrice(d.discount_value)}`}
            </span>
          </button>
        ))}
      </div>

      {/* Adjusted price preview */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--color-primary)]/20 text-sm">
        <span className="text-xs text-[var(--color-fg-muted)]">{t('price_charged')}</span>
        <div className="flex items-center gap-2 font-[var(--font-mono)]">
          {selected && (
            <span className="text-xs text-[var(--color-fg-subtle)] line-through">
              {formatPrice(service.price)}
            </span>
          )}
          <span className={cn(
            'font-semibold text-sm',
            selected ? 'text-[var(--color-primary)]' : 'text-[var(--color-fg)]'
          )}>
            {formatPrice(finalPrice)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Add Appointment Sheet ─────────────────────────────────────────────────────

interface AddAppointmentSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  barbers: Barber[]
  services: Service[]
}

function AddAppointmentSheet({ open, onOpenChange, barbers, services }: AddAppointmentSheetProps) {
  const qc = useQueryClient()
  const { t } = useTranslation('dashboard')
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>('')

  const todayStr = format(now(), 'yyyy-MM-dd')

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        barber_id: '',
        service_id: '',
        client_name: '',
        client_phone: '',
        date: todayStr,
        start_time: '09:00',
        notes: '',
        status: 'confirmed',
      },
    })

  const barberId = watch('barber_id')
  const serviceId = watch('service_id')
  const selectedService = services.find((s) => s.id === serviceId)

  // Reset discount when service changes
  useEffect(() => {
    setSelectedDiscountId('')
  }, [serviceId])

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      // Find existing client by phone, or create new one
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', values.client_phone)
        .maybeSingle()
      let clientId: string
      if (existingClient?.id) {
        clientId = existingClient.id
      } else {
        const { data: newClient, error: insertClientErr } = await supabase
          .from('clients')
          .insert({ name: values.client_name, phone: values.client_phone })
          .select('id')
          .single()
        if (insertClientErr) throw insertClientErr
        clientId = newClient.id
      }

      const service = services.find((s) => s.id === values.service_id)
      if (!service) throw new Error('Service not found')

      const startAt = new Date(`${values.date}T${values.start_time}:00`)
      const totalDuration = service.duration_minutes + (service.buffer_after_minutes ?? 0)
      const endAt = addMinutes(startAt, totalDuration)

      // Compute price with optional discount
      let priceCharged = service.price
      if (selectedDiscountId) {
        const { data: discountData } = await supabase
          .from('service_discounts')
          .select('*')
          .eq('id', selectedDiscountId)
          .single()
        if (discountData) {
          const d = discountData as ServiceDiscount
          priceCharged = applyDiscount(service.price, d)
        }
      }

      const { error: apptError } = await supabase.from('appointments').insert({
        client_id: clientId,
        barber_id: values.barber_id,
        service_id: values.service_id,
        start_time: startAt.toISOString(),
        end_time: endAt.toISOString(),
        status: values.status,
        price_charged: priceCharged,
        notes: values.notes || null,
      })
      if (apptError) throw apptError
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.appointments.all })
      qc.invalidateQueries({ queryKey: keys.clients.all })
      reset()
      setSelectedDiscountId('')
      onOpenChange(false)
    },
  })

  function handleClose() {
    reset()
    setSelectedDiscountId('')
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetHeader
        title={t('add_sheet_title')}
        description={t('add_sheet_desc')}
        onClose={handleClose}
      />
      <SheetBody>
        <form id="appointment-form" onSubmit={handleSubmit((v) => mutate(v))} className="space-y-5">
          {/* Client info */}
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-subtle)] px-4 py-3 space-y-4">
            <p className="text-xs font-semibold text-[var(--color-fg-muted)] uppercase tracking-wider">{t('client_label')}</p>
            <FormField label={t('client_name_label')} error={errors.client_name?.message}>
              <Input {...register('client_name')} placeholder="Full name" error={!!errors.client_name} />
            </FormField>
            <FormField label={t('client_phone_label')} error={errors.client_phone?.message}>
              <Input {...register('client_phone')} type="tel" placeholder="+54 11 1234-5678" error={!!errors.client_phone} />
            </FormField>
          </div>

          {/* Service */}
          <FormField label={`${t('service_label')} *`} error={errors.service_id?.message}>
            <Select value={serviceId} onValueChange={(v) => setValue('service_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('select_service')} />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {durationLabel(s.duration_minutes)} · {formatPrice(s.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {/* Discount selector — shown only when service has active discounts */}
          {selectedService && (
            <DiscountSelector
              service={selectedService}
              selectedDiscountId={selectedDiscountId}
              onSelect={setSelectedDiscountId}
            />
          )}

          {/* Barber */}
          <FormField label={`${t('barber_label')} *`} error={errors.barber_id?.message}>
            <Select value={barberId} onValueChange={(v) => setValue('barber_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('select_barber')} />
              </SelectTrigger>
              <SelectContent>
                {barbers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('date_label')} error={errors.date?.message}>
              <DatePicker
                value={watch('date')}
                onChange={(v) => setValue('date', v)}
                error={!!errors.date}
              />
            </FormField>
            <FormField label={t('start_time_label')} error={errors.start_time?.message}>
              <TimePicker
                value={watch('start_time')}
                onChange={(v) => setValue('start_time', v)}
                error={!!errors.start_time}
              />
            </FormField>
          </div>

          {/* Service summary */}
          {selectedService && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-[var(--color-fg-muted)]">{t('total_duration_label')}</span>
              <span className="font-medium text-[var(--color-fg)]">
                {durationLabel(selectedService.duration_minutes + (selectedService.buffer_after_minutes ?? 0))}
              </span>
            </div>
          )}

          {/* Status */}
          <FormField label={t('status_label')}>
            <Select value={watch('status')} onValueChange={(v) => setValue('status', v as FormValues['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="checked_in">Checked in</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {/* Notes */}
          <FormField label={t('notes_label')}>
            <Textarea {...register('notes')} placeholder={t('notes_placeholder')} className="min-h-[70px]" />
          </FormField>
        </form>
      </SheetBody>
      <SheetFooter>
        <Button variant="secondary" onClick={handleClose} type="button">Cancel</Button>
        <Button form="appointment-form" type="submit" loading={isPending}>
          {t('add_appointment')}
        </Button>
      </SheetFooter>
    </Sheet>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation('dashboard')

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setSheetOpen(true)
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

  const { data: appointments, isLoading, error, refetch } = useQuery({
    queryKey: keys.appointments.today(),
    queryFn: fetchTodayAppointments,
    refetchInterval: 60_000,
  })

  const { data: barbers = [] } = useQuery({
    queryKey: keys.barbers.list(),
    queryFn: fetchBarbers,
  })

  const { data: services = [] } = useQuery({
    queryKey: keys.services.list(),
    queryFn: fetchServices,
  })

  useEffect(() => {
    const channel = supabase
      .channel('today-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' },
        () => qc.invalidateQueries({ queryKey: keys.appointments.all })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc])

  const heading = formatDayHeading(now())

  return (
    <PageShell
      title={heading}
      headerActions={
        <Button size="sm" onClick={() => setSheetOpen(true)} data-tour="add-appointment-btn">
          <Plus className="size-3.5" />
          {t('add_appointment')}
        </Button>
      }
    >
      {/* KPI strip */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[0, 1, 2].map((i) => <KPISkeleton key={i} />)}
        </div>
      ) : (
        <KPIStrip appointments={appointments ?? []} />
      )}

      {/* Appointments list */}
      <div className="space-y-2" data-tour="today-list">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] flex items-center gap-2">
            <CalendarClock className="size-3.5" />
            {t('appointments_section')}
          </h2>
          {!isLoading && (
            <span className="text-xs text-[var(--color-fg-subtle)]">
              {t('appointments_scheduled', { count: appointments?.length ?? 0 })}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => <AppointmentCardSkeleton key={i} />)}
          </div>
        )}

        {error && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-4">
            <p className="text-sm text-[var(--color-danger-fg)] font-medium">
              {t('error_load')}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-xs font-medium text-[var(--color-danger-fg)] underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              {t('retry', { ns: 'common' })}
            </button>
          </div>
        )}

        {!isLoading && !error && appointments?.length === 0 && (
          <EmptyState
            icon={<Clock className="size-6" />}
            title={t('today_empty')}
            description={t('today_empty_sub')}
            action={{ label: t('add_appointment'), onClick: () => setSheetOpen(true) }}
          />
        )}

        {!isLoading && appointments?.map((appt, i) => (
          <AppointmentCard key={appt.id} appointment={appt} index={i} onClick={() => setSelectedAppt(appt)} />
        ))}
      </div>

      <AddAppointmentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        barbers={barbers}
        services={services}
      />

      <AppointmentDetailSheet
        appointment={selectedAppt}
        open={!!selectedAppt}
        onOpenChange={(v) => { if (!v) setSelectedAppt(null) }}
      />
    </PageShell>
  )
}
