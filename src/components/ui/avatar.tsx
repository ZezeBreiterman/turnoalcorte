import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/utils'

function Avatar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn('aspect-square h-full w-full object-cover', className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)] text-xs font-semibold',
        className
      )}
      {...props}
    />
  )
}

interface NamedAvatarProps {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  color?: string
  className?: string
}

const sizeMap = {
  sm: 'size-7 text-[10px]',
  md: 'size-9 text-xs',
  lg: 'size-11 text-sm',
}

export function NamedAvatar({ name, src, size = 'md', color, className }: NamedAvatarProps) {
  const abbr = initials(name)
  return (
    <Avatar className={cn(sizeMap[size], className)}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback
        style={color ? { backgroundColor: color + '22', color } : undefined}
      >
        {abbr}
      </AvatarFallback>
    </Avatar>
  )
}

export { Avatar, AvatarImage, AvatarFallback }
