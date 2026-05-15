import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Users, Search, Plus, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { keys } from '@/lib/query-keys'
import type { Client, Barber } from '@/types/database'
import { PageShell } from '@/components/layout/PageShell'
import { EmptyState } from '@/components/ui/empty-state'
import { NamedAvatar } from '@/components/ui/avatar'
import { AppointmentCardSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetHeader,
  SheetBody,
  SheetFooter,
  FormField,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { formatDate } from '@/lib/time'

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().min(6, 'Phone is required').max(30),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  notes: z.string().max(500).optional(),
  preferred_barber_id: z.string().uuid().nullable().optional(),
})

type FormValues = z.infer<typeof schema>

// ── Data ──────────────────────────────────────────────────────────────────────

async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Client[]
}

async function fetchBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from('barbers')
    .select('id, name, color, photo_url, email, bio, active')
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Barber[]
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

interface ClientSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  client?: Client
  barbers: Barber[]
}

function ClientSheet({ open, onOpenChange, client, barbers }: ClientSheetProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const qc = useQueryClient()
  const isEditing = !!client

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: { name: '', phone: '', email: '', notes: '', preferred_barber_id: null },
    })

  useEffect(() => {
    if (open) {
      reset(client
        ? {
            name: client.name,
            phone: client.phone,
            email: client.email ?? '',
            notes: client.notes ?? '',
            preferred_barber_id: client.preferred_barber_id,
          }
        : { name: '', phone: '', email: '', notes: '', preferred_barber_id: null }
      )
    }
  }, [open, client, reset])

  const preferredBarberId = watch('preferred_barber_id')

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        phone: values.phone,
        email: values.email || null,
        notes: values.notes || null,
        preferred_barber_id: values.preferred_barber_id || null,
      }
      if (isEditing) {
        const { error } = await supabase.from('clients').update(payload).eq('id', client.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('clients').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.clients.all })
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
        title={isEditing ? t('edit_client') : t('add_client')}
        description={
          isEditing
            ? t('edit_client_desc', { name: client.name })
            : t('add_client_desc')
        }
        onClose={handleClose}
      />
      <SheetBody>
        <form id="client-form" onSubmit={handleSubmit((v) => mutate(v))} className="space-y-5">
          <FormField label={t('client_name_label')} error={errors.name?.message}>
            <Input
              {...register('name')}
              placeholder={t('client_name_placeholder')}
              error={!!errors.name}
            />
          </FormField>

          <FormField label={t('client_phone_label')} error={errors.phone?.message}>
            <Input
              {...register('phone')}
              type="tel"
              placeholder={t('client_phone_placeholder')}
              error={!!errors.phone}
            />
          </FormField>

          <FormField label={t('client_email_label')} error={errors.email?.message}>
            <Input
              {...register('email')}
              type="email"
              placeholder={t('client_email_placeholder')}
              error={!!errors.email}
            />
          </FormField>

          <FormField label={t('preferred_barber')}>
            <Select
              value={preferredBarberId ?? 'none'}
              onValueChange={(v) => setValue('preferred_barber_id', v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('no_preference')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('no_preference')}</SelectItem>
                {barbers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t('client_notes_label')}>
            <Textarea
              {...register('notes')}
              placeholder={t('client_notes_placeholder')}
              className="min-h-[80px]"
            />
          </FormField>
        </form>
      </SheetBody>
      <SheetFooter>
        <Button variant="secondary" onClick={handleClose} type="button">
          {t('common:cancel')}
        </Button>
        <Button form="client-form" type="submit" loading={isPending}>
          {isEditing ? t('save_changes') : t('add_client')}
        </Button>
      </SheetFooter>
    </Sheet>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const { t } = useTranslation(['dashboard', 'common'])
  const [search, setSearch] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Client | undefined>()

  const { data: clients = [], isLoading } = useQuery({
    queryKey: keys.clients.list(),
    queryFn: fetchClients,
  })

  const { data: barbers = [] } = useQuery({
    queryKey: keys.barbers.list(),
    queryFn: fetchBarbers,
  })

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() {
    setEditing(undefined)
    setSheetOpen(true)
  }

  function openEdit(client: Client) {
    setEditing(client)
    setSheetOpen(true)
  }

  return (
    <PageShell
      title={t('clients_title')}
      headerActions={
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-3.5" />
          {t('add_client')}
        </Button>
      }
    >
      {/* Search */}
      <div className="relative mb-5 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-fg-muted)]" />
        <Input
          placeholder={t('search_clients')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <AppointmentCardSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<Users className="size-6" />}
          title={search ? t('no_clients_found') : t('no_clients_yet')}
          description={search ? t('no_clients_found_desc') : t('no_clients_yet_desc')}
          action={!search ? { label: t('add_client'), onClick: openAdd } : undefined}
        />
      )}

      <div className="space-y-1">
        {filtered.map((client) => (
          <div
            key={client.id}
            className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5 hover:border-[var(--color-border-strong)] transition-all duration-150 group"
          >
            <NamedAvatar name={client.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-fg)] truncate">{client.name}</p>
              <p className="text-xs text-[var(--color-fg-muted)]">{client.phone}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-[var(--color-fg-subtle)]">
                  {t('client_since', { date: formatDate(client.created_at) })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit(client)}
                aria-label={t('edit_client')}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pencil className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ClientSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        client={editing}
        barbers={barbers}
      />
    </PageShell>
  )
}
