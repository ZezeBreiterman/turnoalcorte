import { Search, Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'
import { useUIStore } from '@/store/ui.store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'

interface HeaderProps {
  title?: string
  actions?: React.ReactNode
}

export function Header({ title, actions }: HeaderProps) {
  const { theme, setTheme, isDark } = useTheme()
  const { toggleCommand } = useUIStore()

  return (
    <TooltipProvider>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-5">
        {/* Left: title */}
        <div className="flex items-center gap-3">
          {title && (
            <h1 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h1>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          {actions}

          {/* Search trigger */}
          <Tooltip
            content={
              <span className="flex items-center gap-1.5">
                Search
                <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white">
                  {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'}
                </kbd>
              </span>
            }
            side="bottom"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleCommand}
              aria-label="Open search (Ctrl+K)"
              data-tour="search-btn"
            >
              <Search className="size-4" />
            </Button>
          </Tooltip>

          {/* Theme toggle */}
          <DropdownMenu>
            <Tooltip content="Theme" side="bottom">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Toggle theme">
                  {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
                </Button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Appearance</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="size-4" />
                Light
                {theme === 'light' && <span className="ml-auto text-[var(--color-primary)]">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="size-4" />
                Dark
                {theme === 'dark' && <span className="ml-auto text-[var(--color-primary)]">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="size-4" />
                System
                {theme === 'system' && <span className="ml-auto text-[var(--color-primary)]">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </header>
    </TooltipProvider>
  )
}
