// Run in Supabase SQL editor:
// CREATE TABLE service_discounts (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   service_id UUID REFERENCES services(id) ON DELETE CASCADE,
//   code TEXT NOT NULL,          -- e.g. 'EFECTIVO', 'VIP10'
//   label TEXT NOT NULL,         -- e.g. 'Pago en efectivo', 'Cliente VIP'
//   discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
//   discount_value NUMERIC(8,2) NOT NULL,
//   active BOOLEAN DEFAULT true,
//   created_at TIMESTAMPTZ DEFAULT now()
// );

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Scissors, Plus, Pencil, Trash2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { keys } from '@/lib/query-keys'
import type { Service, ServiceDiscount } from '@/types/database'
import { PageShell } from '@/components/layout/PageShell'
import { EmptyState } from '@/components/ui/empty-state'
import { AppointmentCardSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice, durationLabel } from '@/lib/time'
import {
  Sheet,
  SheetHeader,
  SheetBody,
  SheetFooter,
  FormField,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  price: z.number().min(0, 'Price must be ≥ 0'),
  duration_minutes: z.number().int().min(5, 'At least 5 min').max(480),
  description: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  buffer_before_minutes: z.number().int().min(0),
  buffer_after_minutes: z.number().int().min(0),
  active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const discountSchema = z.object({
  code: z.string().min(1, 'Code required').max(20).toUpperCase(),
  label: z.string().min(1, 'Label required').max(80),
  discount_type: z.enum(['percent', 'fixed']),
  discount_value: z.number().min(0.01, 'Value must be > 0'),
})

type DiscountFormValues = z.infer<typeof discountSchema>

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
]

// ── Data ──────────────────────────────────────────────────────────────────────

async function fetchServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Service[]
}

async function fetchDiscountsByService(serviceId: string): Promise<ServiceDiscount[]> {
  const { data, error } = await supabase
    .from('service_discounts')
    .select('*')
    .eq('service_id', serviceId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ServiceDiscount[]
}

async function fetchAllDiscounts(): Promise<ServiceDiscount[]> {
  const { data, error } = await supabase
    .from('service_discounts')
    .select('*')
    .eq('active', true)
  if (error) throw error
  return (data ?? []) as ServiceDiscount[]
}

// ── Discount helpers ──────────────────────────────────────────────────────────

function formatDiscount(d: ServiceDiscount): string {
  return d.discount_type === 'percent'
    ? `-${d.discount_value}%`
    : `-${formatPrice(d.discount_value)}`
}

// ── Discount section inside ServiceSheet ─────────────────────────────────────

interface DiscountSectionProps {
  serviceId: string
}

function DiscountSection({ serviceId }: DiscountSectionProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const qc = useQueryClient()

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: keys.discounts.byService(serviceId),
    queryFn: () => fetchDiscountsByService(serviceId),
  })

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<DiscountFormValues>({
      resolver: zodResolver(discountSchema),
      defaultValues: { code: '', label: '', discount_type: 'percent', discount_value: 10 },
    })

  const discountType = watch('discount_type')

  const addMutation = useMutation({
    mutationFn: async (values: DiscountFormValues) => {
      const { error } = await supabase.from('service_discounts').insert({
        service_id: serviceId,
        code: values.code.toUpperCase(),
        label: values.label,
        discount_type: values.discount_type,
        discount_value: values.discount_value,
        active: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.discounts.byService(serviceId) })
      qc.invalidateQueries({ queryKey: keys.discounts.all })
      qc.invalidateQueries({ queryKey: keys.services.list() })
      reset()
      toast.success(t('discount_added'))
    },
    onError: (err) => toast.error(`Failed to add discount: ${err.message}`),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('service_discounts')
        .update({ active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.discounts.byService(serviceId) })
      qc.invalidateQueries({ queryKey: keys.discounts.all })
      qc.invalidateQueries({ queryKey: keys.services.list() })
    },
    onError: (err) => toast.error(`Failed to update: ${err.message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_discounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.discounts.byService(serviceId) })
      qc.invalidateQueries({ queryKey: keys.discounts.all })
      qc.invalidateQueries({ queryKey: keys.services.list() })
      toast.success(t('discount_deleted'))
    },
    onError: (err) => toast.error(`Failed to delete: ${err.message}`),
  })

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Tag className="size-3.5 text-[var(--color-fg-muted)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          {t('discount_codes_title')}
        </span>
      </div>

      {/* Existing discounts */}
      {isLoading && (
        <p className="text-xs text-[var(--color-fg-subtle)] py-2">{t('discount_loading')}</p>
      )}

      {!isLoading && discounts.length === 0 && (
        <p className="text-xs text-[var(--color-fg-subtle)] py-2">{t('no_discounts_yet')}</p>
      )}

      {discounts.map((d) => (
        <div
          key={d.id}
          className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-2.5"
        >
          <kbd className="shrink-0 font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30">
            {d.code}
          </kbd>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--color-fg)] truncate">{d.label}</p>
            <p className="text-[11px] text-[var(--color-fg-muted)]">{formatDiscount(d)}</p>
          </div>
          <Switch
            checked={d.active}
            onCheckedChange={(v) => toggleMutation.mutate({ id: d.id, active: v })}
            aria-label="Toggle discount active"
          />
          <button
            type="button"
            onClick={() => deleteMutation.mutate(d.id)}
            className="shrink-0 p-1 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)] transition-colors"
            aria-label="Delete discount"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}

      {/* Add discount inline form */}
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-3 space-y-3">
        <p className="text-[11px] font-semibold text-[var(--color-fg-muted)] uppercase tracking-wider">
          {t('add_discount_section')}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <FormField label={t('discount_code')} error={errors.code?.message}>
            <Input
              {...register('code')}
              placeholder={t('discount_code_placeholder')}
              error={!!errors.code}
              className="uppercase text-xs"
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase()
                register('code').onChange(e)
              }}
            />
          </FormField>
          <FormField label={t('discount_label')} error={errors.label?.message}>
            <Input
              {...register('label')}
              placeholder={t('discount_label_placeholder')}
              error={!!errors.label}
              className="text-xs"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FormField label={t('discount_type')} error={errors.discount_type?.message}>
            <Select
              value={discountType}
              onValueChange={(v) => setValue('discount_type', v as 'percent' | 'fixed')}
            >
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">{t('discount_percent_option')}</SelectItem>
                <SelectItem value="fixed">{t('discount_fixed_option')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label={discountType === 'percent' ? t('discount_percent_label') : t('discount_amount_label')}
            error={errors.discount_value?.message}
          >
            <Input
              {...register('discount_value', { valueAsNumber: true })}
              type="number"
              min="0.01"
              step={discountType === 'percent' ? '1' : '100'}
              placeholder={discountType === 'percent' ? '10' : '500'}
              error={!!errors.discount_value}
              className="text-xs"
            />
          </FormField>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={addMutation.isPending}
          onClick={handleSubmit((v) => addMutation.mutate(v))}
          className="w-full"
        >
          <Plus className="size-3.5" />
          {t('add_discount_section')}
        </Button>
      </div>
    </div>
  )
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

interface ServiceSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  service?: Service
}

function ServiceSheet({ open, onOpenChange, service }: ServiceSheetProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const qc = useQueryClient()
  const isEditing = !!service

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: { name: '', price: 0, duration_minutes: 30, description: '', color: '#8b5cf6', buffer_before_minutes: 0, buffer_after_minutes: 10, active: true },
    })

  useEffect(() => {
    if (open) {
      reset(service
        ? {
            name: service.name,
            price: service.price,
            duration_minutes: service.duration_minutes,
            description: service.description ?? '',
            color: service.color,
            buffer_before_minutes: service.buffer_before_minutes,
            buffer_after_minutes: service.buffer_after_minutes,
            active: service.active,
          }
        : { name: '', price: 0, duration_minutes: 30, description: '', color: '#8b5cf6', buffer_before_minutes: 0, buffer_after_minutes: 10, active: true }
      )
    }
  }, [open, service, reset])

  const activeValue = watch('active')
  const colorValue = watch('color')

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        price: values.price,
        duration_minutes: values.duration_minutes,
        description: values.description || null,
        color: values.color,
        buffer_before_minutes: values.buffer_before_minutes,
        buffer_after_minutes: values.buffer_after_minutes,
        active: values.active,
      }
      if (isEditing) {
        const { error } = await supabase.from('services').update(payload).eq('id', service.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('services').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.services.all })
      reset()
      onOpenChange(false)
    },
  })

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetHeader
        title={isEditing ? t('edit_service') : t('add_service')}
        description={
          isEditing
            ? t('edit_service_desc', { name: service.name })
            : t('add_service_desc')
        }
        onClose={handleClose}
      />
      <SheetBody>
        <form id="service-form" onSubmit={handleSubmit((v) => mutate(v))} className="space-y-5">
          <FormField label={t('service_name_label')} error={errors.name?.message}>
            <Input
              {...register('name')}
              placeholder={t('service_name_placeholder')}
              error={!!errors.name}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('service_price_label')} error={errors.price?.message}>
              <Input
                {...register('price', { valueAsNumber: true })}
                type="number"
                min="0"
                step="100"
                placeholder="2500"
                error={!!errors.price}
              />
            </FormField>
            <FormField label={t('service_duration_label')} error={errors.duration_minutes?.message}>
              <Input
                {...register('duration_minutes', { valueAsNumber: true })}
                type="number"
                min="5"
                step="5"
                placeholder="30"
                error={!!errors.duration_minutes}
              />
            </FormField>
          </div>

          <FormField label={t('service_desc_label')}>
            <Textarea
              {...register('description')}
              placeholder={t('service_desc_placeholder')}
              className="min-h-[80px]"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('buffer_before_label')} error={errors.buffer_before_minutes?.message}>
              <Input
                {...register('buffer_before_minutes', { valueAsNumber: true })}
                type="number"
                min="0"
                step="5"
                placeholder="0"
              />
            </FormField>
            <FormField label={t('buffer_after_label')} error={errors.buffer_after_minutes?.message}>
              <Input
                {...register('buffer_after_minutes', { valueAsNumber: true })}
                type="number"
                min="0"
                step="5"
                placeholder="10"
              />
            </FormField>
          </div>

          <FormField label={t('service_color_label')}>
            <div className="flex flex-wrap gap-2 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue('color', c)}
                  className="size-7 rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  style={{
                    backgroundColor: c,
                    boxShadow: colorValue === c ? `0 0 0 2px var(--color-bg), 0 0 0 4px ${c}` : undefined,
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
              <input
                type="color"
                value={colorValue}
                onChange={(e) => setValue('color', e.target.value)}
                className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
                title="Custom color"
              />
            </div>
          </FormField>

          <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3">
            <div>
              <Label>{t('service_active_label')}</Label>
              <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">{t('service_active_desc')}</p>
            </div>
            <Switch
              checked={activeValue}
              onCheckedChange={(v) => setValue('active', v)}
            />
          </div>
        </form>

        {/* Discounts section — only visible when editing an existing service */}
        {isEditing && (
          <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
            <DiscountSection serviceId={service.id} />
          </div>
        )}
      </SheetBody>
      <SheetFooter>
        <Button variant="secondary" onClick={handleClose} type="button">
          {t('common:cancel')}
        </Button>
        <Button form="service-form" type="submit" loading={isPending}>
          {isEditing ? t('save_changes') : t('add_service')}
        </Button>
      </SheetFooter>
    </Sheet>
  )
}

// ── Service card discount pills ───────────────────────────────────────────────

interface DiscountPillsProps {
  discounts: ServiceDiscount[]
}

function DiscountPills({ discounts }: DiscountPillsProps) {
  const active = discounts.filter((d) => d.active)
  if (active.length === 0) return null

  // Show first 2 pills, then "+N more" if needed
  const visible = active.slice(0, 2)
  const extra = active.length - visible.length

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {visible.map((d) => (
        <span
          key={d.id}
          className="inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)]/12 text-[var(--color-primary)] border border-[var(--color-primary)]/25"
        >
          {d.code} {formatDiscount(d)}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)] border border-[var(--color-border)]">
          +{extra} more
        </span>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const { t } = useTranslation(['dashboard', 'common'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Service | undefined>()

  const { data: services = [], isLoading } = useQuery({
    queryKey: keys.services.list(),
    queryFn: fetchServices,
  })

  // Fetch all active discounts for badges on service cards
  const { data: allDiscounts = [] } = useQuery({
    queryKey: keys.discounts.all,
    queryFn: fetchAllDiscounts,
  })

  function openAdd() {
    setEditing(undefined)
    setSheetOpen(true)
  }

  function openEdit(service: Service) {
    setEditing(service)
    setSheetOpen(true)
  }

  return (
    <PageShell
      title={t('services_title')}
      headerActions={
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-3.5" />
          {t('add_service')}
        </Button>
      }
    >
      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <AppointmentCardSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && services.length === 0 && (
        <EmptyState
          icon={<Scissors className="size-6" />}
          title={t('no_services_yet')}
          description={t('no_services_yet_desc')}
          action={{ label: t('add_service'), onClick: openAdd }}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {services.map((service) => {
          const serviceDiscounts = allDiscounts.filter((d) => d.service_id === service.id)

          return (
            <div
              key={service.id}
              className="group rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)] transition-all duration-150"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="size-8 rounded-[var(--radius-md)]"
                  style={{ backgroundColor: (service.color ?? '#8b5cf6') + '33' }}
                />
                <div className="flex items-center gap-1.5">
                  <Badge variant="default">{durationLabel(service.duration_minutes)}</Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(service)}
                    aria-label={t('edit_service')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">{service.name}</h3>
              {service.description && (
                <p className="text-xs text-[var(--color-fg-muted)] mb-3 line-clamp-2">{service.description}</p>
              )}

              {/* Discount pills */}
              <DiscountPills discounts={serviceDiscounts} />

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--color-border)]">
                <span className="text-sm font-semibold font-[var(--font-mono)] text-[var(--color-fg)]">
                  {formatPrice(service.price)}
                </span>
                <span className="text-xs text-[var(--color-fg-subtle)]">
                  +{service.buffer_after_minutes ?? 10}m buffer
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <ServiceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        service={editing}
      />
    </PageShell>
  )
}
