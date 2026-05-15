import { cn } from '@/lib/utils'
import { Header } from './Header'

interface PageShellProps {
  title?: string
  headerActions?: React.ReactNode
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function PageShell({
  title,
  headerActions,
  children,
  className,
  noPadding = false,
}: PageShellProps) {
  return (
    <div className="flex h-full flex-col">
      <Header title={title} actions={headerActions} />
      <main
        className={cn(
          'flex-1 overflow-y-auto',
          !noPadding && 'p-5 lg:p-6',
          className
        )}
      >
        {children}
      </main>
    </div>
  )
}
