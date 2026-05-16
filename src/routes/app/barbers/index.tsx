import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Plus, Pencil, CalendarDays, CalendarOff, Trash2, Camera, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { keys } from '@/lib/query-keys'
import type { Barber } from '@/types/database'
import { PageShell } from '@/components/layout/PageShell'
import { EmptyState } from '@/components/ui/empty-state'
import { AppointmentCardSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { NamedAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import { toast } from 'sonner'

// ── TimeOff types ─────────────────────────────────────────────────────────────

interface TimeOff {
  id: string
  barber_id: string
  start_at: string
  end_at: string
  reason: string | null
}

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  bio: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color'),
  active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

// ── Color swatches ────────────────────────────────────────────────────────────

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
]

// ── Data ──────────────────────────────────────────────────────────────────────

async function fetchBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from('barbers')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Barber[]
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

interface BarberSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  barber?: Barber
}

function BarberSheet({ open, onOpenChange, barber }: BarberSheetProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const qc = useQueryClient()
  const isEditing = !!barber
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: { name: '', email: '', bio: '', color: '#6366f1', active: true },
    })

  useEffect(() => {
    if (open) {
      reset(barber
        ? { name: barber.name, email: barber.email ?? '', bio: barber.bio ?? '', color: barber.color, active: barber.active }
        : { name: '', email: '', bio: '', color: '#6366f1', active: true }
      )
      setPhotoPreview(barber?.photo_url ?? null)
      setPhotoFile(null)
    }
  }, [open, barber, reset])

  const activeValue = watch('active')
  const colorValue = watch('color')

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function clearPhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      let photoUrl = barber?.photo_url ?? null

      // Upload new photo if selected
      if (photoFile) {
        setUploadingPhoto(true)
        const ext = photoFile.name.split('.').pop() ?? 'jpg'
        const path = `barbers/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('barber-photos')
          .upload(path, photoFile, { upsert: true })
        setUploadingPhoto(false)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('barber-photos').getPublicUrl(path)
        photoUrl = urlData.publicUrl
      } else if (photoPreview === null && barber?.photo_url) {
        // Photo was cleared
        photoUrl = null
      }

      const payload = {
        name: values.name,
        email: values.email || null,
        bio: values.bio || null,
        color: values.color,
        active: values.active,
        photo_url: photoUrl,
      }
      if (isEditing) {
        const { error } = await supabase.from('barbers').update(payload).eq('id', barber.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('barbers').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.barbers.all })
      reset()
      setPhotoPreview(null)
      setPhotoFile(null)
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
        title={isEditing ? t('edit_barber') : t('add_barber')}
        description={
          isEditing
            ? t('edit_barber_desc', { name: barber.name })
            : t('add_barber_desc')
        }
        onClose={handleClose}
      />
      <SheetBody>
        <form id="barber-form" onSubmit={handleSubmit((v) => mutate(v))} className="space-y-5">

          {/* Photo upload */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div
                className="size-20 rounded-full overflow-hidden border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-muted)] flex items-center justify-center"
                style={photoPreview ? { borderStyle: 'solid', borderColor: colorValue } : undefined}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="size-full object-cover" />
                ) : (
                  <User className="size-8 text-[var(--color-fg-muted)]" />
                )}
              </div>
              {photoPreview && (
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[var(--color-danger)] text-white shadow"
                  aria-label="Remove photo"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--color-fg-muted)]">Profile photo</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-bg-muted)] transition-colors"
              >
                <Camera className="size-3.5" />
                {photoPreview ? 'Change photo' : 'Upload photo'}
              </button>
              <p className="text-[10px] text-[var(--color-fg-muted)]">JPG, PNG, WebP · max 5 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handlePhotoSelect}
              />
            </div>
          </div>

          <FormField label={t('barber_name_label')} error={errors.name?.message}>
            <Input
              {...register('name')}
              placeholder={t('barber_name_placeholder')}
              error={!!errors.name}
            />
          </FormField>

          <FormField label={t('barber_email_label')} error={errors.email?.message}>
            <Input
              {...register('email')}
              type="email"
              placeholder={t('barber_email_placeholder')}
              error={!!errors.email}
            />
          </FormField>

          <FormField label={t('barber_bio_label')}>
            <Textarea
              {...register('bio')}
              placeholder={t('barber_bio_placeholder')}
              className="min-h-[80px]"
            />
          </FormField>

          <FormField label={t('barber_color_label')}>
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
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorValue}
                  onChange={(e) => setValue('color', e.target.value)}
                  className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  title="Custom color"
                />
              </div>
            </div>
          </FormField>

          <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3">
            <div>
              <Label>{t('barber_active_label')}</Label>
              <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">{t('barber_active_desc')}</p>
            </div>
            <Switch
              checked={activeValue}
              onCheckedChange={(v) => setValue('active', v)}
            />
          </div>
        </form>
      </SheetBody>
      <SheetFooter>
        <Button variant="secondary" onClick={handleClose} type="button">
          {t('common:cancel')}
        </Button>
        <Button form="barber-form" type="submit" loading={isPending || uploadingPhoto}>
          {uploadingPhoto ? 'Uploading…' : isEditing ? t('save_changes') : t('add_barber')}
        </Button>
      </SheetFooter>
    </Sheet>
  )
}

// ── Schedule sheet ────────────────────────────────────────────────────────────

interface DaySchedule {
  day: number          // 0–6
  working: boolean
  startTime: string    // "HH:mm"
  endTime: string
}

function buildDefaultDays(): DaySchedule[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day: i,
    working: false,
    startTime: '09:00',
    endTime: '18:00',
  }))
}

interface ScheduleSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  barber?: Barber
}

function ScheduleSheet({ open, onOpenChange, barber }: ScheduleSheetProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const qc = useQueryClient()
  const [days, setDays] = useState<DaySchedule[]>(buildDefaultDays)

  // Load existing schedule when sheet opens
  const { isLoading } = useQuery({
    queryKey: keys.schedules.byBarber(barber?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('barber_schedules')
        .select('*')
        .eq('barber_id', barber!.id)
      if (error) throw error
      return data ?? []
    },
    enabled: open && !!barber?.id,
  })

  // Sync query data into local state
  useEffect(() => {
    if (!open) return
    if (!barber?.id) {
      setDays(buildDefaultDays())
      return
    }
    // Reset to defaults first, then overlay with stored data once the query resolves
    supabase
      .from('barber_schedules')
      .select('*')
      .eq('barber_id', barber.id)
      .then(({ data }) => {
        const base = buildDefaultDays()
        if (data && data.length > 0) {
          data.forEach((row) => {
            const idx = base.findIndex((d) => d.day === row.day_of_week)
            if (idx !== -1) {
              base[idx] = {
                day: row.day_of_week,
                working: true,
                startTime: (row.start_time as string).slice(0, 5),
                endTime: (row.end_time as string).slice(0, 5),
              }
            }
          })
        }
        setDays(base)
      })
  }, [open, barber?.id])

  function toggleDay(dayIndex: number, working: boolean) {
    setDays((prev) =>
      prev.map((d) => (d.day === dayIndex ? { ...d, working } : d))
    )
  }

  function updateTime(dayIndex: number, field: 'startTime' | 'endTime', value: string) {
    setDays((prev) =>
      prev.map((d) => (d.day === dayIndex ? { ...d, [field]: value } : d))
    )
  }

  const { mutate: saveSchedule, isPending } = useMutation({
    mutationFn: async () => {
      if (!barber) return
      // Delete all existing rows for this barber
      const { error: delError } = await supabase
        .from('barber_schedules')
        .delete()
        .eq('barber_id', barber.id)
      if (delError) throw delError

      // Insert active days
      const activeDays = days.filter((d) => d.working)
      if (activeDays.length > 0) {
        const { error: insError } = await supabase
          .from('barber_schedules')
          .insert(
            activeDays.map((d) => ({
              barber_id: barber.id,
              day_of_week: d.day,
              start_time: d.startTime,
              end_time: d.endTime,
            }))
          )
        if (insError) throw insError
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.schedules.byBarber(barber?.id ?? '') })
      toast.success(t('schedule_saved'))
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save schedule')
    },
  })

  function handleClose() {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetHeader
        title={t('schedule_title', { name: barber?.name ?? '' })}
        description={t('schedule_desc')}
        onClose={handleClose}
      />
      <SheetBody>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-14 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {days.map((day) => (
              <div
                key={day.day}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3"
              >
                {/* Day label */}
                <span className="w-24 shrink-0 text-sm font-medium text-[var(--color-fg)]">
                  {t(`day_${day.day}` as `day_${0 | 1 | 2 | 3 | 4 | 5 | 6}`)}
                </span>

                {/* Toggle */}
                <Switch
                  checked={day.working}
                  onCheckedChange={(v) => toggleDay(day.day, v)}
                />

                {/* Time inputs or "Day off" */}
                {day.working ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <Input
                      type="time"
                      value={day.startTime}
                      onChange={(e) => updateTime(day.day, 'startTime', e.target.value)}
                      className="w-32 text-sm"
                    />
                    <span className="text-xs text-[var(--color-fg-muted)]">–</span>
                    <Input
                      type="time"
                      value={day.endTime}
                      onChange={(e) => updateTime(day.day, 'endTime', e.target.value)}
                      className="w-32 text-sm"
                    />
                  </div>
                ) : (
                  <span className="ml-auto text-xs text-[var(--color-fg-muted)]">
                    {t('day_off')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </SheetBody>
      <SheetFooter>
        <Button variant="secondary" onClick={handleClose} type="button">
          {t('common:cancel')}
        </Button>
        <Button onClick={() => saveSchedule()} loading={isPending}>
          {t('schedule_save')}
        </Button>
      </SheetFooter>
    </Sheet>
  )
}

// ── Vacation sheet ────────────────────────────────────────────────────────────

const vacationSchema = z.object({
  start_at: z.string().min(1, 'Start date is required'),
  end_at: z.string().min(1, 'End date is required'),
  reason: z.string().max(200).optional(),
}).refine((v) => v.end_at >= v.start_at, {
  message: 'End date must be after or equal to start date',
  path: ['end_at'],
})

type VacationFormValues = z.infer<typeof vacationSchema>

function formatDateRange(start: string, end: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const s = fmt(start)
  const e = fmt(end)
  return s === e ? s : `${s} – ${e}`
}

interface VacationSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  barber?: Barber
}

function VacationSheet({ open, onOpenChange, barber }: VacationSheetProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const qc = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<VacationFormValues>({
      resolver: zodResolver(vacationSchema),
      defaultValues: { start_at: '', end_at: '', reason: '' },
    })

  // Fetch existing time-off blocks
  const { data: timeOffList = [], isLoading } = useQuery({
    queryKey: keys.timeOff.byBarber(barber?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_off')
        .select('*')
        .eq('barber_id', barber!.id)
        .order('start_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as TimeOff[]
    },
    enabled: open && !!barber?.id,
  })

  // Add time-off mutation
  const { mutate: addTimeOff, isPending: isAdding } = useMutation({
    mutationFn: async (values: VacationFormValues) => {
      if (!barber) return

      // Client-side overlap check
      const newStart = values.start_at
      const newEnd = values.end_at
      const hasOverlap = timeOffList.some((block) => {
        const bStart = block.start_at.slice(0, 10)
        const bEnd = block.end_at.slice(0, 10)
        return newStart <= bEnd && newEnd >= bStart
      })
      if (hasOverlap) {
        throw new Error('This period overlaps with an existing time-off block')
      }

      const { error } = await supabase.from('time_off').insert({
        barber_id: barber.id,
        start_at: `${values.start_at}T00:00:00Z`,
        end_at: `${values.end_at}T23:59:59Z`,
        reason: values.reason || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.timeOff.byBarber(barber?.id ?? '') })
      toast.success(t('time_off_added'))
      reset()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to add time off')
    },
  })

  // Delete time-off mutation
  const { mutate: deleteTimeOff } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_off').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.timeOff.byBarber(barber?.id ?? '') })
      toast.success(t('time_off_removed'))
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to remove time off')
    },
  })

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetHeader
        title={`${t('vacation_title')} — ${barber?.name ?? ''}`}
        description={t('vacation_manage_desc')}
        onClose={handleClose}
      />
      <SheetBody className="space-y-6">

        {/* ── Existing blocks ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
            {t('vacation_title')}
          </p>

          {isLoading && (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 rounded-[var(--radius-md)] bg-[var(--color-bg-muted)] animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && timeOffList.length === 0 && (
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-4 text-[var(--color-fg-muted)]">
              <CalendarOff className="size-4 shrink-0 opacity-50" />
              <p className="text-xs">{t('vacation_empty')}</p>
            </div>
          )}

          <div className="space-y-2">
            {timeOffList.map((block) => (
              <div
                key={block.id}
                className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 hover:border-[var(--color-border-strong)] transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <CalendarOff
                    className="size-4 mt-0.5 shrink-0"
                    style={{ color: 'var(--color-primary)' }}
                  />
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {formatDateRange(block.start_at, block.end_at)}
                    </p>
                    {block.reason && (
                      <p className="text-xs text-[var(--color-fg-muted)] mt-0.5 truncate">
                        {block.reason}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteTimeOff(block.id)}
                  className="shrink-0 rounded-[var(--radius-sm)] p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-red-500 transition-colors"
                  aria-label="Remove time off"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Add new block ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
            {t('vacation_add')}
          </p>
          <form
            id="vacation-form"
            onSubmit={handleSubmit((v) => addTimeOff(v))}
            className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField label={`${t('vacation_from')} *`} error={errors.start_at?.message}>
                <Input
                  {...register('start_at')}
                  type="date"
                  error={!!errors.start_at}
                />
              </FormField>
              <FormField label={`${t('vacation_to')} *`} error={errors.end_at?.message}>
                <Input
                  {...register('end_at')}
                  type="date"
                  error={!!errors.end_at}
                />
              </FormField>
            </div>
            <FormField label={t('vacation_reason')} error={errors.reason?.message}>
              <Input
                {...register('reason')}
                placeholder="e.g. Summer holidays"
                error={!!errors.reason}
              />
            </FormField>
          </form>
        </div>
      </SheetBody>

      <SheetFooter>
        <Button variant="secondary" onClick={handleClose} type="button">
          {t('common:close')}
        </Button>
        <Button form="vacation-form" type="submit" loading={isAdding}>
          {t('vacation_add')}
        </Button>
      </SheetFooter>
    </Sheet>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BarbersPage() {
  const { t } = useTranslation(['dashboard', 'common'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Barber | undefined>()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [schedulingBarber, setSchedulingBarber] = useState<Barber | undefined>()
  const [vacationOpen, setVacationOpen] = useState(false)
  const [vacationBarber, setVacationBarber] = useState<Barber | undefined>()
  const qc = useQueryClient()

  const { data: barbers = [], isLoading } = useQuery({
    queryKey: keys.barbers.list(),
    queryFn: fetchBarbers,
  })

  const { mutate: toggleActive } = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('barbers').update({ active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.barbers.all }),
  })

  function openAdd() {
    setEditing(undefined)
    setSheetOpen(true)
  }

  function openEdit(barber: Barber) {
    setEditing(barber)
    setSheetOpen(true)
  }

  function openSchedule(barber: Barber) {
    setSchedulingBarber(barber)
    setScheduleOpen(true)
  }

  function openVacation(barber: Barber) {
    setVacationBarber(barber)
    setVacationOpen(true)
  }

  return (
    <PageShell
      title={t('barbers_title')}
      headerActions={
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-3.5" />
          {t('add_barber')}
        </Button>
      }
    >
      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <AppointmentCardSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && barbers.length === 0 && (
        <EmptyState
          icon={<User className="size-6" />}
          title={t('no_barbers_yet_page')}
          description={t('no_barbers_yet_desc')}
          action={{ label: t('add_barber'), onClick: openAdd }}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {barbers.map((barber) => (
          <div
            key={barber.id}
            className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)] transition-all duration-150"
          >
            <div className="flex items-center gap-3 mb-4">
              <NamedAvatar
                name={barber.name}
                src={barber.photo_url}
                color={barber.color}
                size="lg"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-fg)] truncate">{barber.name}</p>
                {barber.email && (
                  <p className="text-xs text-[var(--color-fg-muted)] truncate">{barber.email}</p>
                )}
              </div>
            </div>

            {barber.bio && (
              <p className="text-xs text-[var(--color-fg-muted)] line-clamp-2 mb-3">{barber.bio}</p>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => toggleActive({ id: barber.id, active: !barber.active })}
                className="focus-visible:outline-none"
              >
                <Badge variant={barber.active ? 'success' : 'default'}>
                  {barber.active ? t('barber_status_active') : t('barber_status_inactive')}
                </Badge>
              </button>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => openVacation(barber)} aria-label="Vacation">
                  <CalendarOff className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => openSchedule(barber)} aria-label="Schedule">
                  <CalendarDays className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(barber)} aria-label="Edit">
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <BarberSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        barber={editing}
      />

      <ScheduleSheet
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        barber={schedulingBarber}
      />

      <VacationSheet
        open={vacationOpen}
        onOpenChange={setVacationOpen}
        barber={vacationBarber}
      />
    </PageShell>
  )
}
