import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:bg-gradient-to-r before:from-transparent before:via-[var(--color-bg-muted)]/60 before:to-transparent',
        'before:animate-[shimmer_1.5s_infinite]',
        className
      )}
      {...props}
    />
  )
}

export function AppointmentCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <Skeleton className="size-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-2 text-right">
        <Skeleton className="h-4 w-16 ml-auto" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  )
}

export function KPISkeleton() {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}
