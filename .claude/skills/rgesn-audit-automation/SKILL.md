---
name: rgesn-audit-automation
description: |
  Process 78-page RGESN spec, generate checklists, scoring algorithm, compliance reports in JSON.
  Use when: (1) Auditing websites against RGESN eco-design standards, (2) Generating compliance checklists,
  (3) Calculating RGESN compliance scores, (4) Creating structured audit reports in JSON,
  (5) Processing RGESN specification documents, (6) Automating eco-design compliance workflows.
  Triggers: "rgesn audit", "rgesn compliance", "eco-design audit", "référentiel écoconception", "rgesn checklist".
---

# RGESN Audit Automation Skill

Audit automatisé RGESN (Référentiel Général d'Écoconception de Services Numériques).

## RGESN Overview

Le RGESN comprend 79 critères répartis en 8 thématiques:

| Thématique | Critères | Poids |
|------------|----------|-------|
| Stratégie | 1-10 | 15% |
| Spécifications | 11-20 | 12% |
| Architecture | 21-30 | 15% |
| UX/UI | 31-40 | 12% |
| Contenus | 41-50 | 10% |
| Frontend | 51-60 | 15% |
| Backend | 61-70 | 12% |
| Hébergement | 71-79 | 9% |

## Audit Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   UPLOAD    │───▶│   ANALYZE   │───▶│   SCORE     │───▶│   REPORT    │
│  site/code  │    │  79 criteria│    │  calculate  │    │  JSON/PDF   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Audit Configuration

```typescript
// audit-config.ts
interface RGESNAuditConfig {
  siteUrl: string
  auditScope: AuditScope[]
  includeScreenshots: boolean
  outputFormat: 'json' | 'pdf' | 'html'
  language: 'fr' | 'en'
}

type AuditScope = 
  | 'strategie'
  | 'specifications'
  | 'architecture'
  | 'ux_ui'
  | 'contenus'
  | 'frontend'
  | 'backend'
  | 'hebergement'

const defaultConfig: RGESNAuditConfig = {
  siteUrl: '',
  auditScope: ['frontend', 'contenus', 'ux_ui'], // Automatic audit scope
  includeScreenshots: true,
  outputFormat: 'json',
  language: 'fr',
}
```

## Criteria Evaluation Schema

```typescript
// types/rgesn.ts
interface RGESNCriterion {
  id: string           // e.g., "RGESN-5.1"
  thematique: string
  titre: string
  description: string
  objectif: string
  controle: string     // How to verify
  niveau: 'A' | 'AA' | 'AAA'
}

interface CriterionEvaluation {
  criterionId: string
  status: 'conforme' | 'non_conforme' | 'partiellement_conforme' | 'non_applicable'
  score: number        // 0-100
  evidence: string[]   // URLs, screenshots, code snippets
  recommendations: string[]
  priority: 'critical' | 'major' | 'minor'
}

interface AuditResult {
  metadata: {
    siteUrl: string
    auditDate: string
    auditorVersion: string
    scope: AuditScope[]
  }
  summary: {
    globalScore: number
    conformityRate: number
    criticalIssues: number
    totalCriteria: number
    evaluatedCriteria: number
  }
  byThematique: Record<string, ThematiqueResult>
  evaluations: CriterionEvaluation[]
  recommendations: PrioritizedRecommendation[]
}
```

## Automated Analysis with Claude

```typescript
// audit-engine.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

async function analyzePageForRGESN(
  pageContent: string,
  screenshots: string[],
  criteria: RGESNCriterion[]
): Promise<CriterionEvaluation[]> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: [
        // Include screenshots
        ...screenshots.map(img => ({
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: 'image/png' as const, data: img }
        })),
        {
          type: 'text',
          text: `Analyse cette page web selon les critères RGESN suivants.
          
Page HTML:
${pageContent}

Critères à évaluer:
${JSON.stringify(criteria, null, 2)}

Pour chaque critère, évalue:
1. Status: conforme | non_conforme | partiellement_conforme | non_applicable
2. Score: 0-100
3. Preuves concrètes (éléments HTML, captures, mesures)
4. Recommandations d'amélioration
5. Priorité: critical | major | minor

Réponds en JSON structuré.`
        }
      ]
    }]
  })
  
  return JSON.parse(response.content[0].text)
}
```

## Scoring Algorithm

```typescript
// scoring.ts
interface ScoringWeights {
  strategie: 0.15
  specifications: 0.12
  architecture: 0.15
  ux_ui: 0.12
  contenus: 0.10
  frontend: 0.15
  backend: 0.12
  hebergement: 0.09
}

function calculateGlobalScore(evaluations: CriterionEvaluation[]): number {
  const byThematique = groupByThematique(evaluations)
  
  let weightedSum = 0
  let totalWeight = 0
  
  for (const [thematique, evals] of Object.entries(byThematique)) {
    const weight = WEIGHTS[thematique] || 0.1
    const thematiqueScore = calculateThematiqueScore(evals)
    
    weightedSum += thematiqueScore * weight
    totalWeight += weight
  }
  
  return Math.round((weightedSum / totalWeight) * 100) / 100
}

function calculateThematiqueScore(evaluations: CriterionEvaluation[]): number {
  const applicable = evaluations.filter(e => e.status !== 'non_applicable')
  if (applicable.length === 0) return 100
  
  const totalScore = applicable.reduce((sum, e) => sum + e.score, 0)
  return totalScore / applicable.length
}

function getConformityLevel(score: number): string {
  if (score >= 90) return 'A - Excellent'
  if (score >= 75) return 'B - Bon'
  if (score >= 50) return 'C - Acceptable'
  if (score >= 25) return 'D - Insuffisant'
  return 'E - Non conforme'
}
```

## JSON Report Output

```typescript
// report-generator.ts
interface RGESNReport {
  version: '1.0'
  generatedAt: string
  audit: {
    url: string
    scope: string[]
    duration: number
  }
  results: {
    score: number
    level: string
    conformity: {
      conforme: number
      nonConforme: number
      partiel: number
      nonApplicable: number
    }
  }
  thematiques: {
    [key: string]: {
      score: number
      criteria: {
        id: string
        status: string
        score: number
        details: string
      }[]
    }
  }
  prioritizedActions: {
    priority: 'critical' | 'major' | 'minor'
    criterion: string
    action: string
    impact: string
    effort: 'low' | 'medium' | 'high'
  }[]
}

async function generateReport(result: AuditResult): Promise<RGESNReport> {
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    audit: {
      url: result.metadata.siteUrl,
      scope: result.metadata.scope,
      duration: result.metadata.duration,
    },
    results: {
      score: result.summary.globalScore,
      level: getConformityLevel(result.summary.globalScore),
      conformity: countByStatus(result.evaluations),
    },
    thematiques: formatThematiques(result.byThematique),
    prioritizedActions: prioritizeActions(result.recommendations),
  }
}
```

## CLI Usage

```bash
# Run RGESN audit
npx rgesn-audit https://example.com --output report.json

# Audit specific thematiques
npx rgesn-audit https://example.com --scope frontend,contenus

# Generate PDF report
npx rgesn-audit https://example.com --format pdf --output audit.pdf
```

## Resources

- references/rgesn-criteria.md - Complete 79 criteria reference
- references/audit-templates.md - Report templates and formats
