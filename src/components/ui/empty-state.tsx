import { cn } from '@/lib/utils'
import { Button } from './button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 px-6 text-center',
        className
      )}
    >
      {icon && (
        <div className="flex size-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)]">
          {icon}
        </div>
      )}
      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-medium text-[var(--color-fg)]">{title}</p>
        {description && (
          <p className="text-xs text-[var(--color-fg-muted)]">{description}</p>
        )}
      </div>
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
