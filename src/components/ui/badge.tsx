import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { AppointmentStatus } from '@/types/database'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:  'bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)] border border-[var(--color-border)]',
        primary:  'bg-[var(--color-primary)] text-[var(--color-primary-fg)]',
        success:  'bg-[var(--color-success-bg)] text-[var(--color-success-fg)]',
        warning:  'bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]',
        danger:   'bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)]',
        outline:  'border border-[var(--color-border)] bg-transparent text-[var(--color-fg-muted)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

const STATUS_MAP: Record<AppointmentStatus, { label: string; variant: VariantProps<typeof badgeVariants>['variant'] }> = {
  pending:    { label: 'Pending',     variant: 'warning' },
  confirmed:  { label: 'Confirmed',   variant: 'success' },
  checked_in: { label: 'Checked In',  variant: 'primary' },
  in_progress:{ label: 'In Chair',    variant: 'primary' },
  completed:  { label: 'Completed',   variant: 'default' },
  cancelled:  { label: 'Cancelled',   variant: 'danger'  },
  no_show:    { label: 'No Show',     variant: 'danger'  },
  rescheduled:{ label: 'Rescheduled', variant: 'warning' },
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { label, variant } = STATUS_MAP[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}
