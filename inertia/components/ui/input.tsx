import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'

import { cn } from '~/lib/utils'

const inputVariants = cva(
  'flex w-full rounded-md border bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200',
  {
    variants: {
      variant: {
        default: 'border-input focus-visible:ring-ring',
        error: 'border-destructive focus-visible:ring-destructive text-destructive',
        success: 'border-success focus-visible:ring-success',
      },
      inputSize: {
        sm: 'h-9 px-3 text-xs',
        default: 'h-10 px-3 py-2',
        lg: 'h-12 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'default',
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /** Left icon or element */
  leftElement?: React.ReactNode
  /** Right icon or element */
  rightElement?: React.ReactNode
  /** Error message to display */
  error?: string
  /** Success state */
  success?: boolean
  /** Helper text below input */
  helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      variant,
      inputSize,
      leftElement,
      rightElement,
      error,
      success,
      helperText,
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const isPassword = type === 'password'
    const inputType = isPassword && showPassword ? 'text' : type

    // Determine variant based on error/success state
    const computedVariant = error ? 'error' : success ? 'success' : variant

    // Generate unique ID if not provided
    const inputId = id || React.useId()
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    return (
      <div className="w-full">
        <div className="relative">
          {leftElement && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            >
              {leftElement}
            </div>
          )}
          <input
            type={inputType}
            id={inputId}
            className={cn(
              inputVariants({ variant: computedVariant, inputSize, className }),
              leftElement && 'pl-10',
              (rightElement || isPassword || error || success) && 'pr-10'
            )}
            ref={ref}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={cn(error && errorId, helperText && helperId) || undefined}
            {...props}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {error && !isPassword && (
              <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
            )}
            {success && !isPassword && !error && (
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
            )}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            )}
            {rightElement && !isPassword && !error && !success && (
              <span className="text-muted-foreground" aria-hidden="true">
                {rightElement}
              </span>
            )}
          </div>
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input, inputVariants }
