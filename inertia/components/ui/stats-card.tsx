import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

import { cn } from '~/lib/utils'

const statsCardVariants = cva(
  'rounded-lg border bg-card text-card-foreground p-6 transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'shadow-sm',
        elevated: 'shadow-md',
        outline: 'shadow-none',
        interactive: 'shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const trendVariants = {
  up: {
    icon: TrendingUp,
    color: 'text-success',
    bg: 'bg-success/10',
  },
  down: {
    icon: TrendingDown,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
  neutral: {
    icon: Minus,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
  },
}

export interface StatsCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statsCardVariants> {
  /** The main title/label */
  title: string
  /** The primary value to display */
  value: string | number
  /** Optional description or context */
  description?: string
  /** Icon to display */
  icon?: React.ReactNode
  /** Trend direction */
  trend?: 'up' | 'down' | 'neutral'
  /** Trend value (e.g., "+12%") */
  trendValue?: string
  /** Whether to animate the value on mount */
  animated?: boolean
}

const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  ({
    className,
    variant,
    title,
    value,
    description,
    icon,
    trend,
    trendValue,
    animated = false,
    ...props
  }, ref) => {
    const trendConfig = trend ? trendVariants[trend] : null
    const TrendIcon = trendConfig?.icon

    return (
      <div
        ref={ref}
        className={cn(statsCardVariants({ variant, className }))}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p
              className={cn(
                'text-3xl font-bold tracking-tight tabular-nums',
                animated && 'animate-fade-in'
              )}
            >
              {value}
            </p>
          </div>
          {icon && (
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary" aria-hidden="true">
              {icon}
            </div>
          )}
        </div>

        {(description || trend) && (
          <div className="mt-4 flex items-center gap-2">
            {trend && trendConfig && TrendIcon && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  trendConfig.bg,
                  trendConfig.color
                )}
              >
                <TrendIcon className="h-3 w-3" aria-hidden="true" />
                {trendValue}
              </span>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        )}
      </div>
    )
  }
)
StatsCard.displayName = 'StatsCard'

export { StatsCard, statsCardVariants }
