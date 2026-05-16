import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouteLoaderData } from 'react-router-dom'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUIStore } from '@/store/ui.store'
import type { Language } from '@/store/ui.store'
import { GraduationCap, Store } from 'lucide-react'
import type { Profile } from '@/lib/auth'
import { can } from '@/lib/can'
import type { ShopConfig } from '@/types/database'

const LANGUAGE_OPTIONS: { value: Language; native: string }[] = [
  { value: 'es', native: 'Español' },
  { value: 'en', native: 'English' },
]

async function fetchShopConfig(): Promise<ShopConfig | null> {
  const { data } = await supabase.from('shop_config').select('*').limit(1).maybeSingle()
  return data as ShopConfig | null
}

async function updateShopConfig(patch: Partial<ShopConfig> & { id: string }): Promise<void> {
  const { error } = await supabase.from('shop_config').update(patch).eq('id', patch.id)
  if (error) throw error
}

function ShopConfigCard({ config }: { config: ShopConfig }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: config.name,
    address: config.address ?? '',
    phone: config.phone ?? '',
    description: config.description ?? '',
    instagram: config.instagram ?? '',
  })

  useEffect(() => {
    setForm({
      name: config.name,
      address: config.address ?? '',
      phone: config.phone ?? '',
      description: config.description ?? '',
      instagram: config.instagram ?? '',
    })
  }, [config])

  const { mutate, isPending } = useMutation({
    mutationFn: () => updateShopConfig({
      id: config.id,
      name: form.name.trim() || config.name,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      description: form.description.trim() || null,
      instagram: form.instagram.trim() || null,
    }),
    onSuccess: () => {
      toast.success('Configuración guardada')
      qc.invalidateQueries({ queryKey: ['shop-config'] })
    },
    onError: () => toast.error('No se pudo guardar'),
  })

  const field = (key: keyof typeof form, label: string, placeholder: string) => (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[var(--color-fg-muted)]">{label}</label>
      <Input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Store className="size-4 text-[var(--color-primary)]" />
          <CardTitle>Datos de la barbería</CardTitle>
        </div>
        <CardDescription>Aparecen en la página pública de turnos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {field('name',        'Nombre',      'Turno al Corte')}
        {field('address',     'Dirección',   'Av. Corrientes 1234, CABA')}
        {field('phone',       'Teléfono',    '+54 11 4567-8901')}
        {field('instagram',   'Instagram',   '@turnoalcorte')}
        {field('description', 'Descripción', 'La mejor barbería del barrio')}
        <div className="pt-1">
          <Button size="sm" onClick={() => mutate()} loading={isPending}>
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, tutorialCompleted, setTutorialOpen, setTutorialStep } = useUIStore()
  const navigate = useNavigate()
  const { t } = useTranslation('settings')

  const loaderData = useRouteLoaderData('app-shell') as { profile: Profile } | null
  const isAdmin = can(loaderData?.profile.role ?? 'barber', 'update', 'settings')

  const { data: shopConfig } = useQuery({
    queryKey: ['shop-config'],
    queryFn: fetchShopConfig,
    enabled: isAdmin,
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success(t('signed_out'))
    navigate('/auth/login', { replace: true })
  }

  function handleOpenTutorial() {
    setTutorialStep(0)
    setTutorialOpen(true)
  }

  return (
    <PageShell title={t('title')}>
      <div className="max-w-xl space-y-4">
        {/* Shop config — admin only */}
        {isAdmin && shopConfig && (
          <ShopConfigCard config={shopConfig} />
        )}

        {/* Tutorial */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Tutorial</CardTitle>
              {tutorialCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  ✓ Completado
                </span>
              )}
            </div>
            <CardDescription>Aprendé a usar Turnoalcorte paso a paso</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={handleOpenTutorial}>
              <GraduationCap className="size-3.5" />
              Ver tutorial
            </Button>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle>{t('language')}</CardTitle>
            <CardDescription>{t('language_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <Button
                  key={lang.value}
                  size="sm"
                  variant={language === lang.value ? 'default' : 'secondary'}
                  onClick={() => setLanguage(lang.value)}
                >
                  {lang.native}
                  {language === lang.value && (
                    <span className="ml-1.5 text-[10px] font-normal opacity-70">
                      {t('language_active')}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>{t('theme')}</CardTitle>
            <CardDescription>{t('theme_current', { theme: t(`theme_${theme}`) })}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((themeOpt) => (
                <Button
                  key={themeOpt}
                  size="sm"
                  variant={theme === themeOpt ? 'default' : 'secondary'}
                  onClick={() => setTheme(themeOpt)}
                >
                  {t(`theme_${themeOpt}`)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle>{t('account')}</CardTitle>
            <CardDescription>{t('account_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="danger" size="sm" onClick={handleSignOut}>
              {t('sign_out')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
