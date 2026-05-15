import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40" />
        <Dialog.Content asChild onOpenAutoFocus={(e) => e.preventDefault()}>
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 flex w-[520px] max-w-full flex-col bg-[var(--color-bg)] border-l border-[var(--color-border)] shadow-2xl outline-none"
          >
            {children}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface SheetHeaderProps {
  title: string
  description?: string
  onClose: () => void
}

export function SheetHeader({ title, description, onClose }: SheetHeaderProps) {
  return (
    <div className="flex shrink-0 items-start justify-between border-b border-[var(--color-border)] px-6 py-4">
      <div>
        <Dialog.Title className="text-base font-semibold text-[var(--color-fg)]">
          {title}
        </Dialog.Title>
        {description && (
          <Dialog.Description className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
            {description}
          </Dialog.Description>
        )}
      </div>
      <button
        onClick={onClose}
        className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)] transition-colors"
        aria-label="Close"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

export function SheetBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-6 py-5', className)}>
      {children}
    </div>
  )
}

export function SheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
      {children}
    </div>
  )
}

export function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[var(--color-fg-muted)]">{label}</label>
      {children}
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
