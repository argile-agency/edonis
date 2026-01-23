---
name: design-to-code-react
description: |
  Convert Figma designs to production-ready React components with TailwindCSS, dark mode, responsive design.
  Use when: (1) Converting Figma screenshots to React components, (2) Extracting design tokens from Figma,
  (3) Generating responsive TailwindCSS code from designs, (4) Creating Storybook stories from UI screenshots,
  (5) Building component variants (hover, active, disabled states), (6) Implementing dark mode from designs.
  Triggers: "figma to react", "design to code", "screenshot to component", "convert design", "ui to react".
---

# Design-to-Code React Skill

Convert Figma designs to production-ready React components.

## Workflow Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   CAPTURE   │───▶│   ANALYZE   │───▶│  GENERATE   │───▶│   REFINE    │
│  screenshot │    │ Vision API  │    │  component  │    │  Storybook  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Screenshot Analysis Prompt

```typescript
const analyzeDesignPrompt = `
Analyze this UI design screenshot and extract:

1. **Component Structure**
   - Main component and sub-components
   - Component hierarchy
   - Reusable patterns

2. **Visual Properties**
   - Colors (background, text, borders, shadows)
   - Typography (font sizes, weights, line heights)
   - Spacing (padding, margins, gaps)
   - Border radius values

3. **Layout**
   - Flexbox/Grid structure
   - Responsive breakpoints suggested
   - Alignment patterns

4. **Interactive States** (if visible)
   - Hover states
   - Active/pressed states
   - Disabled states
   - Focus indicators

5. **Accessibility**
   - Contrast ratios estimation
   - Touch target sizes
   - Required ARIA attributes

Output as structured JSON for code generation.
`
```

## Component Generation

```typescript
// design-to-code.ts
import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'

interface DesignAnalysis {
  componentName: string
  structure: ComponentStructure
  styles: StyleTokens
  variants: Variant[]
  accessibility: A11yRequirements
}

async function designToComponent(imagePath: string): Promise<string> {
  const client = new Anthropic()
  const imageData = fs.readFileSync(imagePath).toString('base64')

  // Step 1: Analyze design
  const analysis = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageData } },
          { type: 'text', text: analyzeDesignPrompt },
        ],
      },
    ],
  })

  const design: DesignAnalysis = JSON.parse(analysis.content[0].text)

  // Step 2: Generate component
  const component = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Generate a React component with TypeScript and TailwindCSS based on this analysis:
      
${JSON.stringify(design, null, 2)}

Requirements:
- Use functional component with TypeScript
- TailwindCSS for all styling
- Support dark mode with dark: variants
- Include all interactive states
- Add proper TypeScript props interface
- Include JSDoc comments
- Make it responsive (mobile-first)
- Add accessibility attributes`,
      },
    ],
  })

  return component.content[0].text
}
```

## Component Template

```tsx
// Generated component structure
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const componentVariants = cva(
  // Base styles
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-11 px-8 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface ComponentProps
  extends ComponentPropsWithoutRef<'button'>,
    VariantProps<typeof componentVariants> {
  /** Loading state */
  isLoading?: boolean
}

/**
 * Component description from design
 * @example
 * <Component variant="primary" size="md">Click me</Component>
 */
export const Component = forwardRef<HTMLButtonElement, ComponentProps>(
  ({ className, variant, size, isLoading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(componentVariants({ variant, size }), className)}
        disabled={isLoading}
        {...props}
      >
        {isLoading ? <Spinner /> : children}
      </button>
    )
  }
)

Component.displayName = 'Component'
```

## Figma API Integration

```typescript
// Extract design tokens from Figma
import { FigmaAPI } from 'figma-api'

async function extractFigmaTokens(fileKey: string, nodeId: string) {
  const figma = new FigmaAPI({ personalAccessToken: process.env.FIGMA_TOKEN })

  const file = await figma.getFile(fileKey)
  const node = findNode(file.document, nodeId)

  return {
    colors: extractColors(node),
    typography: extractTypography(node),
    spacing: extractSpacing(node),
    effects: extractEffects(node),
  }
}

function extractColors(node: any): Record<string, string> {
  const colors: Record<string, string> = {}

  if (node.fills) {
    node.fills.forEach((fill: any, i: number) => {
      if (fill.type === 'SOLID') {
        const { r, g, b, a = 1 } = fill.color
        colors[`fill-${i}`] = rgbaToHex(r, g, b, a)
      }
    })
  }

  return colors
}
```

## Storybook Generation

```typescript
// Generate Storybook story
function generateStory(componentName: string, variants: Variant[]): string {
  return `
import type { Meta, StoryObj } from '@storybook/react'
import { ${componentName} } from './${componentName}'

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${componentName}',
  component: ${componentName},
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [${variants.map((v) => `'${v.name}'`).join(', ')}],
    },
  },
}

export default meta
type Story = StoryObj<typeof ${componentName}>

export const Default: Story = {
  args: {
    children: '${componentName}',
  },
}

${variants
  .map(
    (v) => `
export const ${capitalize(v.name)}: Story = {
  args: {
    variant: '${v.name}',
    children: '${v.name} variant',
  },
}
`
  )
  .join('')}
`
}
```

## Resources

- references/tailwind-mapping.md - Design token to Tailwind class mapping
- references/responsive-patterns.md - Mobile-first responsive patterns
