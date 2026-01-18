# Accessibility Testing Patterns

## Keyboard Navigation Test

```typescript
async function testKeyboardNavigation(page: Page): Promise<KeyboardTestResult> {
  const issues: KeyboardIssue[] = []
  
  // Get all focusable elements
  const focusable = await page.$$eval(
    'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    els => els.map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim(),
      tabindex: el.getAttribute('tabindex'),
    }))
  )
  
  // Test Tab navigation
  for (let i = 0; i < focusable.length; i++) {
    await page.keyboard.press('Tab')
    
    const focused = await page.evaluate(() => {
      const el = document.activeElement
      return {
        tag: el?.tagName,
        visible: el ? getComputedStyle(el).outline !== 'none' : false,
      }
    })
    
    if (!focused.visible) {
      issues.push({
        type: 'focus-not-visible',
        element: focusable[i],
      })
    }
  }
  
  return { focusableCount: focusable.length, issues }
}
```

## Focus Trap Detection

```typescript
async function detectFocusTraps(page: Page): Promise<FocusTrap[]> {
  const traps: FocusTrap[] = []
  const visited = new Set<string>()
  
  // Tab through page multiple times
  for (let i = 0; i < 100; i++) {
    await page.keyboard.press('Tab')
    
    const current = await page.evaluate(() => {
      const el = document.activeElement
      return el ? el.outerHTML.slice(0, 100) : null
    })
    
    if (current && visited.has(current)) {
      // Check if we're cycling in a small loop
      if (visited.size < 5) {
        traps.push({
          element: current,
          loopSize: visited.size,
        })
        break
      }
    }
    
    visited.add(current)
  }
  
  return traps
}
```

## Screen Reader Text Check

```typescript
async function checkScreenReaderText(page: Page): Promise<SRIssue[]> {
  return page.$$eval('*', elements => {
    const issues: any[] = []
    
    elements.forEach(el => {
      // Check images
      if (el.tagName === 'IMG') {
        const alt = el.getAttribute('alt')
        if (alt === null) {
          issues.push({ type: 'missing-alt', element: el.outerHTML.slice(0, 100) })
        } else if (alt === '') {
          // Empty alt is OK for decorative images
        }
      }
      
      // Check buttons/links without text
      if (el.tagName === 'BUTTON' || el.tagName === 'A') {
        const hasText = el.textContent?.trim()
        const hasAriaLabel = el.getAttribute('aria-label')
        const hasAriaLabelledby = el.getAttribute('aria-labelledby')
        
        if (!hasText && !hasAriaLabel && !hasAriaLabelledby) {
          issues.push({ type: 'empty-interactive', element: el.outerHTML.slice(0, 100) })
        }
      }
      
      // Check form inputs
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
        const id = el.getAttribute('id')
        const ariaLabel = el.getAttribute('aria-label')
        const ariaLabelledby = el.getAttribute('aria-labelledby')
        
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`)
          if (!label && !ariaLabel && !ariaLabelledby) {
            issues.push({ type: 'missing-label', element: el.outerHTML.slice(0, 100) })
          }
        }
      }
    })
    
    return issues
  })
}
```

## ARIA Validation

```typescript
const validARIARoles = [
  'alert', 'alertdialog', 'application', 'article', 'banner',
  'button', 'cell', 'checkbox', 'columnheader', 'combobox',
  'complementary', 'contentinfo', 'definition', 'dialog',
  'directory', 'document', 'feed', 'figure', 'form', 'grid',
  'gridcell', 'group', 'heading', 'img', 'link', 'list',
  'listbox', 'listitem', 'log', 'main', 'marquee', 'math',
  'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
  'menuitemradio', 'navigation', 'none', 'note', 'option',
  'presentation', 'progressbar', 'radio', 'radiogroup',
  'region', 'row', 'rowgroup', 'rowheader', 'scrollbar',
  'search', 'searchbox', 'separator', 'slider', 'spinbutton',
  'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel',
  'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree',
  'treegrid', 'treeitem'
]

async function validateARIA(page: Page): Promise<ARIAIssue[]> {
  return page.$$eval('[role]', elements => {
    return elements
      .filter(el => !validARIARoles.includes(el.getAttribute('role') || ''))
      .map(el => ({
        type: 'invalid-role',
        role: el.getAttribute('role'),
        element: el.outerHTML.slice(0, 100),
      }))
  })
}
```

## Automated Test Suite

```typescript
// Full accessibility test suite
async function runA11yTestSuite(url: string): Promise<A11yTestResults> {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(url)
  
  const results = await Promise.all([
    new AxeBuilder({ page }).analyze(),
    testKeyboardNavigation(page),
    detectFocusTraps(page),
    checkScreenReaderText(page),
    validateARIA(page),
  ])
  
  await browser.close()
  
  return {
    axe: results[0],
    keyboard: results[1],
    focusTraps: results[2],
    screenReader: results[3],
    aria: results[4],
  }
}
```
