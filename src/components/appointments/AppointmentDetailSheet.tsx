import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Clock,
  Scissors,
  User,
  Phone,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  UserCheck,
  PlayCircle,
  RotateCcw,
  Trash2,
  Pencil,
  X as XIcon,
} from 'lucide-react'
import { format, parseISO, addMinutes } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { keys } from '@/lib/query-keys'
import type { Appointment, AppointmentStatus, Barber, Service } from '@/types/database'
import {
  Sheet,
  SheetHeader,
  SheetBody,
  SheetFooter,
  FormField,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { NamedAvatar } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimePicker } from '@/components/ui/TimePicker'
import { formatTime, formatDate, formatPrice, durationLabel } from '@/lib/time'

// ── Status transitions ────────────────────────────────────────────────────────

interface StatusAction {
  status: AppointmentStatus
  labelKey: string
  icon: React.ReactNode
  variant: 'default' | 'secondary' | 'danger' | 'outline'
}

function getAvailableActions(current: AppointmentStatus): StatusAction[] {
  switch (current) {
    case 'pending':
      return [
        { status: 'confirmed',  labelKey: 'actions.confirm',       icon: <CheckCircle2 className="size-3.5" />, variant: 'default' },
        { status: 'cancelled',  labelKey: 'actions.cancel_short',  icon: <XCircle className="size-3.5" />,      variant: 'danger'  },
      ]
    case 'confirmed':
      return [
        { status: 'checked_in', labelKey: 'actions.check_in',      icon: <UserCheck className="size-3.5" />,    variant: 'default' },
        { status: 'no_show',    labelKey: 'actions.no_show',        icon: <XCircle className="size-3.5" />,      variant: 'danger'  },
        { status: 'cancelled',  labelKey: 'actions.cancel_short',   icon: <Trash2 className="size-3.5" />,       variant: 'danger'  },
      ]
    case 'checked_in':
      return [
        { status: 'in_progress', labelKey: 'actions.start',        icon: <PlayCircle className="size-3.5" />,   variant: 'default' },
        { status: 'no_show',     labelKey: 'actions.no_show',       icon: <XCircle className="size-3.5" />,      variant: 'danger'  },
      ]
    case 'in_progress':
      return [
        { status: 'completed',  labelKey: 'actions.complete',       icon: <CheckCircle2 className="size-3.5" />, variant: 'default' },
      ]
    case 'completed':
      return []
    case 'cancelled':
    case 'no_show':
      return [
        { status: 'confirmed',  labelKey: 'actions.restore',        icon: <RotateCcw className="size-3.5" />,    variant: 'secondary' },
      ]
    case 'rescheduled':
      return [
        { status: 'confirmed',  labelKey: 'actions.confirm',        icon: <CheckCircle2 className="size-3.5" />, variant: 'default' },
      ]
    default:
      return []
  }
}

// ── Detail row ────────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="mt-0.5 text-[var(--color-fg-muted)] shrink-0">{icon}</span>
      <span className="text-xs text-[var(--color-fg-muted)] w-20 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-[var(--color-fg)] flex-1">{value}</span>
    </div>
  )
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const editSchema = z.object({
  service_id: z.string().min(1, 'Servicio requerido'),
  barber_id: z.string().min(1, 'Barbero requerido'),
  date: z.string().min(1, 'Fecha requerida'),
  start_time: z.string().min(1, 'Hora requerida'),
  notes: z.string(),
  price_charged: z.coerce.number().min(0, 'El precio debe ser 0 o mayor'),
})

type EditFormValues = z.infer<typeof editSchema>

// ── Data fetchers ─────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDefaultValues(appointment: Appointment): EditFormValues {
  const start = parseISO(appointment.start_time)
  return {
    service_id: appointment.service_id,
    barber_id: appointment.barber_id,
    date: format(start, 'yyyy-MM-dd'),
    start_time: format(start, 'HH:mm'),
    notes: appointment.notes ?? '',
    price_charged: appointment.price_charged,
  }
}

// ── Edit Form ─────────────────────────────────────────────────────────────────

interface EditFormProps {
  appointment: Appointment
  onCancel: () => void
  onSaved: () => void
}

function EditForm({ appointment, onCancel, onSaved }: EditFormProps) {
  const qc = useQueryClient()

  const { data: services = [] } = useQuery({
    queryKey: keys.services.list(),
    queryFn: fetchServices,
    staleTime: 5 * 60 * 1000,
  })

  const { data: barbers = [] } = useQuery({
    queryKey: keys.barbers.list(),
    queryFn: fetchBarbers,
    staleTime: 5 * 60 * 1000,
  })

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: buildDefaultValues(appointment),
  })

  // When service changes, auto-update price to service default price
  const watchedServiceId = watch('service_id')
  useEffect(() => {
    const svc = services.find((s) => s.id === watchedServiceId)
    if (svc) {
      setValue('price_charged', svc.price)
    }
  }, [watchedServiceId, services, setValue])

  const { mutate: saveEdit, isPending } = useMutation({
    mutationFn: async (values: EditFormValues) => {
      // Find selected service to get duration
      const svc = services.find((s) => s.id === values.service_id)
      if (!svc) throw new Error('Service not found')

      const startDatetime = new Date(`${values.date}T${values.start_time}:00`)
      const endDatetime = addMinutes(startDatetime, svc.duration_minutes)

      const { error } = await supabase
        .from('appointments')
        .update({
          service_id: values.service_id,
          barber_id: values.barber_id,
          start_time: startDatetime.toISOString(),
          end_time: endDatetime.toISOString(),
          price_charged: values.price_charged,
          notes: values.notes || null,
        })
        .eq('id', appointment.id)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.appointments.all })
      toast.success('Turno actualizado')
      onSaved()
    },
    onError: () => toast.error('No se pudo guardar'),
  })

  return (
    <form onSubmit={handleSubmit((v) => saveEdit(v))} className="space-y-4">
      {/* Service */}
      <FormField label="Servicio" error={errors.service_id?.message}>
        <Controller
          name="service_id"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className={errors.service_id ? 'border-[var(--color-danger)]' : ''}>
                <SelectValue placeholder="Seleccionar servicio" />
              </SelectTrigger>
              <SelectContent>
                {services.map((svc) => (
                  <SelectItem key={svc.id} value={svc.id}>
                    {svc.name}
                    <span className="ml-2 text-[var(--color-fg-muted)] text-xs">
                      ({durationLabel(svc.duration_minutes)})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      {/* Barber */}
      <FormField label="Barbero" error={errors.barber_id?.message}>
        <Controller
          name="barber_id"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className={errors.barber_id ? 'border-[var(--color-danger)]' : ''}>
                <SelectValue placeholder="Seleccionar barbero" />
              </SelectTrigger>
              <SelectContent>
                {barbers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      {/* Date + Time row */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Fecha" error={errors.date?.message}>
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <DatePicker
                value={field.value}
                onChange={field.onChange}
                error={!!errors.date}
              />
            )}
          />
        </FormField>

        <FormField label="Hora de inicio" error={errors.start_time?.message}>
          <Controller
            name="start_time"
            control={control}
            render={({ field }) => (
              <TimePicker
                value={field.value}
                onChange={field.onChange}
                error={!!errors.start_time}
              />
            )}
          />
        </FormField>
      </div>

      {/* Price */}
      <FormField label="Precio" error={errors.price_charged?.message}>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          error={!!errors.price_charged}
          {...register('price_charged')}
        />
      </FormField>

      {/* Notes */}
      <FormField label="Notas" error={errors.notes?.message}>
        <Textarea
          placeholder="Notas opcionales..."
          rows={3}
          {...register('notes')}
        />
      </FormField>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="default" size="sm" loading={isPending} className="flex-1">
          Guardar cambios
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Descartar
        </Button>
      </div>
    </form>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AppointmentDetailSheetProps {
  appointment: Appointment | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function AppointmentDetailSheet({
  appointment,
  open,
  onOpenChange,
}: AppointmentDetailSheetProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const qc = useQueryClient()
  const [mode, setMode] = useState<'view' | 'edit'>('view')

  // Reset to view mode when the sheet closes or appointment changes
  useEffect(() => {
    if (!open) setMode('view')
  }, [open])

  useEffect(() => {
    setMode('view')
  }, [appointment?.id])

  const { mutate: changeStatus, isPending } = useMutation({
    mutationFn: async (newStatus: AppointmentStatus) => {
      if (!appointment) return
      const patch: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'checked_in') patch.checked_in_at = new Date().toISOString()
      if (newStatus === 'cancelled')  patch.cancelled_at  = new Date().toISOString()
      const { error } = await supabase
        .from('appointments')
        .update(patch)
        .eq('id', appointment.id)
      if (error) throw error
    },
    onSuccess: (_, newStatus) => {
      qc.invalidateQueries({ queryKey: keys.appointments.all })
      toast.success(t(`common:status.${newStatus}` as Parameters<typeof t>[0]))
      onOpenChange(false)
    },
    onError: () => toast.error(t('common:error_generic')),
  })

  if (!appointment) return null

  const actions = getAvailableActions(appointment.status)
  const duration = appointment.service
    ? durationLabel(appointment.service.duration_minutes)
    : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Custom header with edit toggle */}
      <div className="flex shrink-0 items-start justify-between border-b border-[var(--color-border)] px-6 py-4">
        <div>
          <p className="text-base font-semibold text-[var(--color-fg)]">
            {mode === 'edit' ? 'Editar turno' : t('dashboard:appointment')}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
            #{appointment.id.slice(-6).toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {mode === 'view' && (
            <button
              onClick={() => setMode('edit')}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Edit appointment"
            >
              <Pencil className="size-4" />
            </button>
          )}
          {mode === 'edit' && (
            <button
              onClick={() => setMode('view')}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Cancel edit"
            >
              <XIcon className="size-4" />
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      <SheetBody>
        {/* Client + barber hero — always visible */}
        <div className="flex items-center gap-4 rounded-[var(--radius-xl)] bg-[var(--color-bg-subtle)] p-4 mb-5">
          <NamedAvatar
            name={appointment.barber?.name ?? '?'}
            color={appointment.barber?.color}
            src={appointment.barber?.photo_url}
            size="lg"
          />
          <div className="min-w-0">
            <p className="text-base font-semibold text-[var(--color-fg)] truncate">
              {appointment.client?.name ?? 'Unknown client'}
            </p>
            <p className="text-xs text-[var(--color-fg-muted)]">
              {t('dashboard:with_barber', { name: appointment.barber?.name ?? '?' })}
            </p>
            <div className="mt-1.5">
              <StatusBadge status={appointment.status} />
            </div>
          </div>
        </div>

        {/* View / Edit mode animated switch */}
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'view' ? (
            <motion.div
              key="view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Details */}
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] mb-5">
                <DetailRow
                  icon={<Calendar className="size-3.5" />}
                  label={t('dashboard:date_label').replace(' *', '')}
                  value={formatDate(appointment.start_time)}
                />
                <DetailRow
                  icon={<Clock className="size-3.5" />}
                  label={t('dashboard:time_label')}
                  value={`${formatTime(appointment.start_time)} – ${formatTime(appointment.end_time)}`}
                />
                <DetailRow
                  icon={<Scissors className="size-3.5" />}
                  label={t('dashboard:service_label')}
                  value={
                    <span className="flex items-center gap-2">
                      {appointment.service?.name ?? '—'}
                      {duration && (
                        <span className="text-xs text-[var(--color-fg-muted)]">{duration}</span>
                      )}
                    </span>
                  }
                />
                {appointment.client?.phone && (
                  <DetailRow
                    icon={<Phone className="size-3.5" />}
                    label={t('dashboard:client_phone_label').replace(' *', '')}
                    value={appointment.client.phone}
                  />
                )}
                <DetailRow
                  icon={<DollarSign className="size-3.5" />}
                  label={t('dashboard:price_label')}
                  value={
                    <span className="font-[var(--font-mono)] font-medium">
                      {formatPrice(appointment.price_charged)}
                    </span>
                  }
                />
                {appointment.notes && (
                  <DetailRow
                    icon={<FileText className="size-3.5" />}
                    label={t('dashboard:notes_label')}
                    value={appointment.notes}
                  />
                )}
              </div>

              {/* Status actions */}
              {actions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-3">
                    {t('dashboard:actions_label')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {actions.map((action) => (
                      <Button
                        key={action.status}
                        variant={action.variant}
                        size="sm"
                        onClick={() => changeStatus(action.status)}
                        loading={isPending}
                        className="gap-1.5"
                      >
                        {action.icon}
                        {t(`dashboard:${action.labelKey}` as Parameters<typeof t>[0])}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <EditForm
                appointment={appointment}
                onCancel={() => setMode('view')}
                onSaved={() => setMode('view')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </SheetBody>

      <SheetFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t('common:close')}
        </Button>
      </SheetFooter>
    </Sheet>
  )
}
