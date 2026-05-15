import { useTranslation } from 'react-i18next'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUIStore } from '@/store/ui.store'
import type { Language } from '@/store/ui.store'
import { GraduationCap } from 'lucide-react'

const LANGUAGE_OPTIONS: { value: Language; native: string }[] = [
  { value: 'es', native: 'Español' },
  { value: 'en', native: 'English' },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, tutorialCompleted, setTutorialOpen, setTutorialStep } = useUIStore()
  const navigate = useNavigate()
  const { t } = useTranslation('settings')

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
