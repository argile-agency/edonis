import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '~/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        'default': 'border-transparent bg-primary text-primary-foreground',
        'secondary': 'border-transparent bg-secondary text-secondary-foreground',
        'destructive': 'border-transparent bg-destructive text-destructive-foreground',
        'outline': 'text-foreground border-border',
        // Educational status variants
        'success': 'border-transparent bg-success text-success-foreground',
        'warning': 'border-transparent bg-warning text-warning-foreground',
        'info': 'border-transparent bg-info text-info-foreground',
        'accent': 'border-transparent bg-accent text-accent-foreground',
        // Soft variants for less emphasis
        'soft-primary': 'border-transparent bg-primary/10 text-primary',
        'soft-success': 'border-transparent bg-success/10 text-success',
        'soft-warning': 'border-transparent bg-warning/10 text-warning',
        'soft-destructive': 'border-transparent bg-destructive/10 text-destructive',
        'soft-info': 'border-transparent bg-info/10 text-info',
        'soft-accent': 'border-transparent bg-accent/10 text-accent',
        // Role-based variants for LMS
        'admin': 'border-transparent bg-destructive/10 text-destructive',
        'teacher': 'border-transparent bg-primary/10 text-primary',
        'student': 'border-transparent bg-success/10 text-success',
        'manager': 'border-transparent bg-info/10 text-info',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Optional dot indicator before text */
  dot?: boolean
  /** Optional icon before text */
  icon?: React.ReactNode
}

function Badge({ className, variant, size, dot, icon, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70"
          aria-hidden="true"
        />
      )}
      {icon && (
        <span className="mr-1" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
