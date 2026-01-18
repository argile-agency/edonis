import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '~/lib/utils'

const avatarVariants = cva('relative flex shrink-0 overflow-hidden rounded-full', {
  variants: {
    size: {
      'xs': 'h-6 w-6 text-xs',
      'sm': 'h-8 w-8 text-sm',
      'default': 'h-10 w-10 text-sm',
      'lg': 'h-12 w-12 text-base',
      'xl': 'h-16 w-16 text-lg',
      '2xl': 'h-20 w-20 text-xl',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

const statusVariants = cva('absolute rounded-full border-2 border-background', {
  variants: {
    status: {
      online: 'bg-success',
      offline: 'bg-muted-foreground',
      busy: 'bg-destructive',
      away: 'bg-warning',
    },
    size: {
      'xs': 'h-1.5 w-1.5 -bottom-0 -right-0',
      'sm': 'h-2 w-2 -bottom-0 -right-0',
      'default': 'h-2.5 w-2.5 -bottom-0.5 -right-0.5',
      'lg': 'h-3 w-3 -bottom-0.5 -right-0.5',
      'xl': 'h-4 w-4 -bottom-1 -right-1',
      '2xl': 'h-5 w-5 -bottom-1 -right-1',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {
  /** Online status indicator */
  status?: 'online' | 'offline' | 'busy' | 'away'
}

const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  ({ className, size, status, children, ...props }, ref) => (
    <div className="relative inline-block">
      <AvatarPrimitive.Root
        ref={ref}
        className={cn(avatarVariants({ size, className }))}
        {...props}
      >
        {children}
      </AvatarPrimitive.Root>
      {status && (
        <span className={cn(statusVariants({ status, size }))} aria-label={`Status: ${status}`} />
      )}
    </div>
  )
)
Avatar.displayName = AvatarPrimitive.Root.displayName

export interface AvatarImageProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> {
  /** Disable lazy loading for above-the-fold images */
  eager?: boolean
}

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  AvatarImageProps
>(({ className, eager = false, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    className={cn('aspect-square h-full w-full object-cover', className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-secondary text-secondary-foreground font-medium',
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

/** Avatar group for showing multiple avatars */
interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum avatars to show before +N indicator */
  max?: number
  /** Total count for +N calculation */
  total?: number
  /** Size of avatars in the group */
  size?: VariantProps<typeof avatarVariants>['size']
}

const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, children, max = 4, total, size = 'default', ...props }, ref) => {
    const childArray = React.Children.toArray(children)
    const visibleChildren = max ? childArray.slice(0, max) : childArray
    const remainingCount = total
      ? total - visibleChildren.length
      : childArray.length - visibleChildren.length

    return (
      <div ref={ref} className={cn('flex -space-x-3', className)} {...props}>
        {visibleChildren.map((child, index) => (
          <div
            key={index}
            className="ring-2 ring-background rounded-full"
            style={{ zIndex: visibleChildren.length - index }}
          >
            {React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement<AvatarProps>, { size })
              : child}
          </div>
        ))}
        {remainingCount > 0 && (
          <div
            className={cn(
              avatarVariants({ size }),
              'ring-2 ring-background flex items-center justify-center bg-secondary text-secondary-foreground font-medium'
            )}
            style={{ zIndex: 0 }}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    )
  }
)
AvatarGroup.displayName = 'AvatarGroup'

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, avatarVariants }
