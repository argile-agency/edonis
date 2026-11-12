import type { Page } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'

export const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

// Fades (body fonts-loaded, page cards, toasts) blend colours while they run: axe must not
// sample mid-fade, or settled text reads as low contrast. Infinite animations (spinners) never end.
export async function analyze(page: Page, tags: string[] = WCAG) {
  // String expression: the backend tsconfig has no DOM lib.
  await page.waitForFunction(
    `!document.body.classList.contains('fonts-loading') &&
      document.getAnimations().every(
        (a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity
      )`
  )
  return new AxeBuilder({ page }).withTags(tags).analyze()
}
