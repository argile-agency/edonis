import { useEffect, useRef, useState, useCallback } from 'react'

export interface UseLazySectionOptions extends IntersectionObserverInit {
  /** Only trigger once (default: true) */
  triggerOnce?: boolean
  /** Delay before showing content in ms (default: 0) */
  delay?: number
  /** Skip lazy loading entirely (useful for SSR or above-fold content) */
  skip?: boolean
}

export interface UseLazySectionResult<T extends HTMLElement = HTMLDivElement> {
  /** Ref to attach to the section container */
  ref: React.RefObject<T>
  /** Whether the section is visible/should be rendered */
  isVisible: boolean
  /** Whether the section has ever been visible */
  hasBeenVisible: boolean
}

/**
 * Hook for lazy loading sections using Intersection Observer.
 * Sections below the fold are rendered only when they become visible.
 *
 * @example
 * ```tsx
 * function HeavySection() {
 *   const { ref, isVisible } = useLazySection({ rootMargin: '200px' })
 *
 *   return (
 *     <section ref={ref}>
 *       {isVisible ? <ActualContent /> : <SkeletonPlaceholder />}
 *     </section>
 *   )
 * }
 * ```
 */
export function useLazySection<T extends HTMLElement = HTMLDivElement>(
  options: UseLazySectionOptions = {}
): UseLazySectionResult<T> {
  const {
    triggerOnce = true,
    delay = 0,
    skip = false,
    rootMargin = '100px',
    threshold = 0,
    root = null,
  } = options

  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(skip)
  const [hasBeenVisible, setHasBeenVisible] = useState(skip)

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
      const [entry] = entries

      if (entry.isIntersecting) {
        const show = () => {
          setIsVisible(true)
          setHasBeenVisible(true)
        }

        if (delay > 0) {
          setTimeout(show, delay)
        } else {
          show()
        }

        if (triggerOnce) {
          observer.disconnect()
        }
      } else if (!triggerOnce) {
        setIsVisible(false)
      }
    },
    [delay, triggerOnce]
  )

  useEffect(() => {
    if (skip) return

    const element = ref.current
    if (!element) return

    // Check if IntersectionObserver is supported
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: show content immediately
      setIsVisible(true)
      setHasBeenVisible(true)
      return
    }

    const observer = new IntersectionObserver(handleIntersection, {
      root,
      rootMargin,
      threshold,
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [skip, root, rootMargin, threshold, handleIntersection])

  return { ref, isVisible, hasBeenVisible }
}

/**
 * Wrapper component for lazy sections with built-in skeleton support.
 */
export interface LazySectionProps {
  children: React.ReactNode
  /** Fallback content shown while loading */
  fallback?: React.ReactNode
  /** Options for the lazy section hook */
  options?: UseLazySectionOptions
  /** Additional class names */
  className?: string
  /** Minimum height to prevent layout shift */
  minHeight?: string | number
}
