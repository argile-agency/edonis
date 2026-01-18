import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'

import { cn } from '~/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 btn-press',
  {
    variants: {
      variant: {
        'default': 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
        'destructive':
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        'outline':
          'border border-input bg-background hover:bg-secondary hover:text-secondary-foreground',
        'secondary': 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm',
        'ghost': 'hover:bg-secondary hover:text-secondary-foreground',
        'link': 'text-primary underline-offset-4 hover:underline',
        // Educational context variants
        'success': 'bg-success text-success-foreground hover:bg-success/90 shadow-sm',
        'warning': 'bg-warning text-warning-foreground hover:bg-warning/90 shadow-sm',
        'info': 'bg-info text-info-foreground hover:bg-info/90 shadow-sm',
        'accent': 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm',
        // Soft variants for less emphasis
        'soft-primary': 'bg-primary/10 text-primary hover:bg-primary/20',
        'soft-success': 'bg-success/10 text-success hover:bg-success/20',
        'soft-warning': 'bg-warning/10 text-warning hover:bg-warning/20',
        'soft-destructive': 'bg-destructive/10 text-destructive hover:bg-destructive/20',
        'soft-info': 'bg-info/10 text-info hover:bg-info/20',
      },
      size: {
        'default': 'h-10 px-4 py-2',
        'sm': 'h-9 rounded-md px-3 text-xs',
        'lg': 'h-11 rounded-md px-8 text-base',
        'xl': 'h-12 rounded-lg px-10 text-base font-semibold',
        'icon': 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading, leftIcon, rightIcon, children, disabled, ...props },
    ref
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : leftIcon ? (
          <span aria-hidden="true">{leftIcon}</span>
        ) : null}
        {children}
        {!loading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
