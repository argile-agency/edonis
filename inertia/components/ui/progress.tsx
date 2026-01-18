import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'

import { cn } from '~/lib/utils'

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Visual variant of the progress bar */
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'accent'
  /** Size of the progress bar */
  size?: 'sm' | 'default' | 'lg'
  /** Show percentage label */
  showLabel?: boolean
  /** Animate the progress bar on mount */
  animated?: boolean
  /** Label for screen readers */
  ariaLabel?: string
}

const variantStyles = {
  default: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-info',
  accent: 'bg-accent',
}

const sizeStyles = {
  sm: 'h-1.5',
  default: 'h-2.5',
  lg: 'h-4',
}

const trackSizeStyles = {
  sm: 'h-1.5',
  default: 'h-2.5',
  lg: 'h-4',
}

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  (
    {
      className,
      value,
      variant = 'default',
      size = 'default',
      showLabel = false,
      animated = true,
      ariaLabel,
      ...props
    },
    ref
  ) => {
    const percentage = value || 0

    return (
      <div className="relative w-full">
        <ProgressPrimitive.Root
          ref={ref}
          className={cn(
            'relative w-full overflow-hidden rounded-full bg-secondary',
            trackSizeStyles[size],
            className
          )}
          aria-label={ariaLabel}
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          {...props}
        >
          <ProgressPrimitive.Indicator
            className={cn(
              'h-full w-full flex-1 rounded-full transition-transform duration-500 ease-out',
              variantStyles[variant],
              animated && 'animate-progress'
            )}
            style={{ transform: `translateX(-${100 - percentage}%)` }}
          />
        </ProgressPrimitive.Root>
        {showLabel && (
          <span
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 text-xs font-medium tabular-nums',
              size === 'lg'
                ? 'pr-2 text-white mix-blend-difference'
                : '-top-5 text-muted-foreground'
            )}
            aria-hidden="true"
          >
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    )
  }
)
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
