import { cn } from '@/lib/utils'

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)]',
        'bg-[var(--color-bg-subtle)] px-3 py-2 text-sm text-[var(--color-fg)]',
        'placeholder:text-[var(--color-fg-subtle)] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-0 focus-visible:border-[var(--color-primary)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
