---
name: wcag-compliance-checker
description: |
  Analyze web pages for WCAG A11y compliance using Vision API, axe-core integration, generate compliance reports.
  Use when: (1) Auditing websites for WCAG 2.1/2.2 compliance, (2) Running automated accessibility tests,
  (3) Generating accessibility compliance reports, (4) Integrating axe-core with Claude Vision analysis,
  (5) Testing keyboard navigation and screen reader compatibility, (6) Checking color contrast ratios.
  Triggers: "wcag audit", "accessibility check", "a11y compliance", "wcag compliance", "accessibility testing".
---

# WCAG Compliance Checker Skill

Automated WCAG 2.1/2.2 accessibility testing with Vision API and axe-core.

## WCAG Levels Overview

| Level | Requirements           | Target         |
| ----- | ---------------------- | -------------- |
| A     | Minimum accessibility  | Must have      |
| AA    | Enhanced accessibility | Legal standard |
| AAA   | Optimal accessibility  | Best practice  |

## Compliance Checker Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Playwright │───▶│   axe-core  │───▶│   Results   │
│   capture   │    │   analysis  │    │   merge     │
└─────────────┘    └─────────────┘    └─────────────┘
       │                                     │
       ▼                                     ▼
┌─────────────┐                       ┌─────────────┐
│   Vision    │──────────────────────▶│   Report    │
│   analysis  │                       │   generate  │
└─────────────┘                       └─────────────┘
```

## Combined Analysis Setup

```typescript
// wcag-checker.ts
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import Anthropic from '@anthropic-ai/sdk'

interface WCAGAuditConfig {
  url: string
  level: 'A' | 'AA' | 'AAA'
  includeVisionAnalysis: boolean
  pages?: string[]
}

interface WCAGResult {
  url: string
  timestamp: string
  level: string
  automated: AxeResult
  visual: VisionResult
  combined: CombinedScore
  violations: Violation[]
  recommendations: Recommendation[]
}

async function runWCAGAudit(config: WCAGAuditConfig): Promise<WCAGResult> {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(config.url)

  // Run axe-core analysis
  const axeResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()

  // Capture screenshot for Vision analysis
  const screenshot = await page.screenshot({ fullPage: true })

  // Run Vision API analysis
  const visionResults = config.includeVisionAnalysis
    ? await analyzeWithVision(screenshot, config.level)
    : null

  await browser.close()

  return mergeResults(axeResults, visionResults, config)
}
```

## axe-core Integration

```typescript
// axe-analysis.ts
import AxeBuilder from '@axe-core/playwright'
import type { Page } from 'playwright'

interface AxeConfig {
  level: 'A' | 'AA' | 'AAA'
  rules?: string[]
  exclude?: string[]
}

async function runAxeAnalysis(page: Page, config: AxeConfig) {
  const tags = getTagsForLevel(config.level)

  const builder = new AxeBuilder({ page }).withTags(tags).options({
    resultTypes: ['violations', 'incomplete', 'passes'],
    rules: config.rules ? { [config.rules[0]]: { enabled: true } } : undefined,
  })

  if (config.exclude) {
    builder.exclude(config.exclude)
  }

  const results = await builder.analyze()

  return {
    violations: results.violations.map(formatViolation),
    incomplete: results.incomplete.map(formatIncomplete),
    passes: results.passes.length,
    score: calculateAxeScore(results),
  }
}

function getTagsForLevel(level: string): string[] {
  const tags = ['wcag2a', 'wcag21a']
  if (level === 'AA' || level === 'AAA') {
    tags.push('wcag2aa', 'wcag21aa', 'wcag22aa')
  }
  if (level === 'AAA') {
    tags.push('wcag2aaa')
  }
  return tags
}

function formatViolation(violation: any) {
  return {
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    wcagCriteria: extractWCAGCriteria(violation.tags),
    nodes: violation.nodes.map((node: any) => ({
      html: node.html,
      target: node.target,
      failureSummary: node.failureSummary,
    })),
  }
}
```

## Vision API Analysis

```typescript
// vision-analysis.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

async function analyzeWithVision(screenshot: Buffer, level: string): Promise<VisionResult> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: screenshot.toString('base64'),
            },
          },
          {
            type: 'text',
            text: `Analyze this webpage screenshot for WCAG ${level} accessibility issues.

Check for:
1. **Color Contrast** - Text readability, sufficient contrast ratios
2. **Visual Hierarchy** - Clear heading structure, logical layout
3. **Focus Indicators** - Visible focus states (if detectable)
4. **Touch Targets** - Button/link sizes (minimum 44x44px)
5. **Text Readability** - Font sizes, line spacing
6. **Motion/Animation** - Any auto-playing content
7. **Form Labels** - Visible labels for inputs
8. **Error States** - Clear error messaging
9. **Images** - Missing alt text indicators
10. **Navigation** - Skip links, landmark structure

For each issue found:
- WCAG criterion violated (e.g., "1.4.3 Contrast")
- Severity: critical | serious | moderate | minor
- Location description
- Remediation suggestion

Return structured JSON.`,
          },
        ],
      },
    ],
  })

  return JSON.parse(response.content[0].text)
}
```

## Color Contrast Checker

```typescript
// contrast-checker.ts
function calculateContrastRatio(foreground: RGB, background: RGB): number {
  const l1 = getRelativeLuminance(foreground)
  const l2 = getRelativeLuminance(background)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

function getRelativeLuminance({ r, g, b }: RGB): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function checkContrastCompliance(
  ratio: number,
  textSize: 'normal' | 'large',
  level: 'AA' | 'AAA'
): boolean {
  const requirements = {
    AA: { normal: 4.5, large: 3 },
    AAA: { normal: 7, large: 4.5 },
  }
  return ratio >= requirements[level][textSize]
}
```

## Report Generation

```typescript
// report-generator.ts
interface WCAGReport {
  summary: {
    url: string
    level: string
    score: number
    status: 'pass' | 'fail' | 'partial'
    totalViolations: number
    bySeverity: Record<string, number>
  }
  violations: {
    criterion: string
    level: string
    description: string
    impact: string
    count: number
    elements: string[]
    howToFix: string
  }[]
  passes: string[]
  recommendations: {
    priority: number
    criterion: string
    action: string
    effort: 'low' | 'medium' | 'high'
  }[]
}

function generateReport(results: WCAGResult): WCAGReport {
  const violations = [...results.automated.violations, ...results.visual.issues]

  return {
    summary: {
      url: results.url,
      level: results.level,
      score: results.combined.score,
      status:
        results.combined.score >= 90 ? 'pass' : results.combined.score >= 70 ? 'partial' : 'fail',
      totalViolations: violations.length,
      bySeverity: countBySeverity(violations),
    },
    violations: deduplicateAndFormat(violations),
    passes: results.automated.passes,
    recommendations: prioritizeRecommendations(violations),
  }
}
```

## CLI Usage

```bash
# Run WCAG audit
npx wcag-check https://example.com --level AA

# With Vision analysis
npx wcag-check https://example.com --level AA --vision

# Output formats
npx wcag-check https://example.com --format json --output report.json
npx wcag-check https://example.com --format html --output report.html
```

## Resources

- references/wcag-criteria.md - WCAG 2.1/2.2 criteria reference
- references/testing-patterns.md - Accessibility testing patterns
