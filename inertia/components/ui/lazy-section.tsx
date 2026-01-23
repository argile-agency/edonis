import * as React from 'react'
import { useLazySection, type UseLazySectionOptions } from '~/hooks/use_lazy_section'
import { cn } from '~/lib/utils'

export interface LazySectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content to render when visible */
  children: React.ReactNode
  /** Fallback content shown while loading (skeleton, spinner, etc.) */
  fallback?: React.ReactNode
  /** Options for the intersection observer */
  options?: UseLazySectionOptions
  /** Minimum height to prevent layout shift */
  minHeight?: string | number
  /** Skip lazy loading (render immediately) */
  eager?: boolean
}

/**
 * A section component that lazy loads its content when visible.
 * Uses Intersection Observer to detect visibility.
 *
 * @example
 * ```tsx
 * <LazySection fallback={<SkeletonCard />} minHeight={400}>
 *   <HeavyComponent />
 * </LazySection>
 * ```
 */
const LazySection = React.forwardRef<HTMLDivElement, LazySectionProps>(
  (
    { children, fallback = null, options, minHeight, eager = false, className, style, ...props },
    forwardedRef
  ) => {
    const { ref, isVisible } = useLazySection<HTMLDivElement>({
      ...options,
      skip: eager,
    })

    // Merge refs if forwardedRef is provided
    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        // Update internal ref
        ;(ref as React.MutableRefObject<HTMLDivElement | null>).current = node

        // Update forwarded ref
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          forwardedRef.current = node
        }
      },
      [ref, forwardedRef]
    )

    const sectionStyle: React.CSSProperties = {
      ...style,
      minHeight: minHeight ?? undefined,
    }

    return (
      <div ref={mergedRef} className={cn(className)} style={sectionStyle} {...props}>
        {isVisible ? children : fallback}
      </div>
    )
  }
)
LazySection.displayName = 'LazySection'

export { LazySection }
