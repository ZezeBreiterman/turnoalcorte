import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-sm text-[var(--color-fg)] shadow-[var(--shadow-sm)]',
        'placeholder:text-[var(--color-fg-placeholder)]',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-0 focus-visible:border-[var(--color-primary)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]',
        className
      )}
      {...props}
    />
  )
}
