---
name: ecoscore-calculator-engine
description: |
  Integrate multiple APIs (Lighthouse, Sustainable Web Design, Carbon API), calculate EcoScore with JSON output.
  Use when: (1) Calculating website environmental scores, (2) Integrating multiple sustainability APIs,
  (3) Generating eco-design reports with carbon footprint, (4) Orchestrating Lighthouse performance data,
  (5) Creating environmental dashboards, (6) Comparing websites by sustainability metrics.
  Triggers: "ecoscore", "carbon footprint", "environmental score", "sustainability api", "green web score".
---

# EcoScore Calculator Engine Skill

Multi-API orchestration for comprehensive environmental scoring.

## EcoScore Components

```
┌──────────────────────────────────────────────────────────────┐
│                       EcoScore (0-100)                        │
├──────────────────────────────────────────────────────────────┤
│  Performance (30%)  │  Carbon (35%)  │  Best Practices (35%)  │
│  - Lighthouse       │  - CO₂/view    │  - Green hosting       │
│  - Page weight      │  - Data transfer│  - Caching            │
│  - Requests         │  - Energy       │  - Optimization       │
└──────────────────────────────────────────────────────────────┘
```

## API Integration Architecture

```typescript
// ecoscore-engine.ts
interface EcoScoreConfig {
  url: string
  includeScreenshot?: boolean
  compareWith?: string[]
}

interface EcoScoreResult {
  url: string
  timestamp: string
  ecoscore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'E'
  breakdown: {
    performance: PerformanceScore
    carbon: CarbonScore
    bestPractices: BestPracticesScore
  }
  recommendations: Recommendation[]
  comparison?: ComparisonResult
}

async function calculateEcoScore(config: EcoScoreConfig): Promise<EcoScoreResult> {
  // Parallel API calls
  const [lighthouse, carbon, greenCheck] = await Promise.all([
    runLighthouseAnalysis(config.url),
    calculateCarbonFootprint(config.url),
    checkGreenHosting(config.url),
  ])
  
  const breakdown = {
    performance: calculatePerformanceScore(lighthouse),
    carbon: calculateCarbonScore(carbon),
    bestPractices: calculateBestPracticesScore(lighthouse, greenCheck),
  }
  
  const ecoscore = calculateWeightedScore(breakdown)
  
  return {
    url: config.url,
    timestamp: new Date().toISOString(),
    ecoscore,
    grade: getGrade(ecoscore),
    breakdown,
    recommendations: generateRecommendations(breakdown),
  }
}
```

## Lighthouse Integration

```typescript
// lighthouse-api.ts
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'

interface LighthouseMetrics {
  performance: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  totalBlockingTime: number
  cumulativeLayoutShift: number
  speedIndex: number
  totalByteWeight: number
  requestCount: number
  domSize: number
}

async function runLighthouseAnalysis(url: string): Promise<LighthouseMetrics> {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] })
  
  const result = await lighthouse(url, {
    port: chrome.port,
    output: 'json',
    onlyCategories: ['performance'],
  })
  
  await chrome.kill()
  
  const audits = result.lhr.audits
  
  return {
    performance: result.lhr.categories.performance.score * 100,
    firstContentfulPaint: audits['first-contentful-paint'].numericValue,
    largestContentfulPaint: audits['largest-contentful-paint'].numericValue,
    totalBlockingTime: audits['total-blocking-time'].numericValue,
    cumulativeLayoutShift: audits['cumulative-layout-shift'].numericValue,
    speedIndex: audits['speed-index'].numericValue,
    totalByteWeight: audits['total-byte-weight'].numericValue,
    requestCount: audits['network-requests'].details?.items?.length || 0,
    domSize: audits['dom-size'].numericValue,
  }
}
```

## Carbon Footprint Calculator

```typescript
// carbon-calculator.ts
const SUSTAINABLE_WEB_DESIGN_MODEL = {
  dataTransferPerGB: 0.81,      // kWh per GB
  globalGridIntensity: 442,     // g CO2 per kWh (world average)
  greenGridIntensity: 50,       // g CO2 per kWh (renewable)
  datacenterPUE: 1.2,           // Power Usage Effectiveness
  networkEnergy: 0.06,          // kWh per GB
  deviceEnergy: 0.08,           // kWh per GB
}

interface CarbonResult {
  co2PerView: number           // grams
  co2PerYear: number           // kg (assuming 10k views/month)
  dataTransferred: number      // bytes
  isGreenHosted: boolean
  breakdown: {
    datacenter: number
    network: number
    device: number
  }
}

async function calculateCarbonFootprint(url: string): Promise<CarbonResult> {
  // Get page weight
  const pageData = await fetchPageMetrics(url)
  const gbTransferred = pageData.totalBytes / (1024 * 1024 * 1024)
  
  // Check green hosting
  const isGreenHosted = await checkGreenHosting(url)
  const gridIntensity = isGreenHosted 
    ? SUSTAINABLE_WEB_DESIGN_MODEL.greenGridIntensity 
    : SUSTAINABLE_WEB_DESIGN_MODEL.globalGridIntensity
  
  // Calculate energy per component
  const datacenterEnergy = gbTransferred * SUSTAINABLE_WEB_DESIGN_MODEL.dataTransferPerGB 
    * SUSTAINABLE_WEB_DESIGN_MODEL.datacenterPUE
  const networkEnergy = gbTransferred * SUSTAINABLE_WEB_DESIGN_MODEL.networkEnergy
  const deviceEnergy = gbTransferred * SUSTAINABLE_WEB_DESIGN_MODEL.deviceEnergy
  
  const totalEnergy = datacenterEnergy + networkEnergy + deviceEnergy
  const co2PerView = totalEnergy * gridIntensity // grams
  
  return {
    co2PerView: Math.round(co2PerView * 100) / 100,
    co2PerYear: Math.round(co2PerView * 10000 * 12 / 1000 * 100) / 100, // 10k views/month
    dataTransferred: pageData.totalBytes,
    isGreenHosted,
    breakdown: {
      datacenter: datacenterEnergy * gridIntensity,
      network: networkEnergy * gridIntensity,
      device: deviceEnergy * gridIntensity,
    },
  }
}
```

## Green Web Foundation API

```typescript
// green-hosting.ts
async function checkGreenHosting(url: string): Promise<GreenHostingResult> {
  const domain = new URL(url).hostname
  
  const response = await fetch(
    `https://api.thegreenwebfoundation.org/greencheck/${domain}`
  )
  const data = await response.json()
  
  return {
    isGreen: data.green,
    hostedBy: data.hosted_by,
    hostedByWebsite: data.hosted_by_website,
    supportingDocs: data.supporting_documents,
  }
}
```

## EcoScore Calculation

```typescript
// scoring.ts
interface ScoreWeights {
  performance: 0.30
  carbon: 0.35
  bestPractices: 0.35
}

function calculateWeightedScore(breakdown: ScoreBreakdown): number {
  const weights: ScoreWeights = {
    performance: 0.30,
    carbon: 0.35,
    bestPractices: 0.35,
  }
  
  return Math.round(
    breakdown.performance.score * weights.performance +
    breakdown.carbon.score * weights.carbon +
    breakdown.bestPractices.score * weights.bestPractices
  )
}

function calculatePerformanceScore(lighthouse: LighthouseMetrics): PerformanceScore {
  // Page weight scoring (target < 500KB)
  const weightScore = Math.max(0, 100 - (lighthouse.totalByteWeight / 1024 / 10))
  
  // Request count scoring (target < 25)
  const requestScore = Math.max(0, 100 - (lighthouse.requestCount * 2))
  
  // DOM size scoring (target < 1500)
  const domScore = Math.max(0, 100 - (lighthouse.domSize / 30))
  
  return {
    score: Math.round((lighthouse.performance * 0.4 + weightScore * 0.3 + requestScore * 0.2 + domScore * 0.1)),
    metrics: lighthouse,
  }
}

function calculateCarbonScore(carbon: CarbonResult): CarbonScore {
  // Score based on CO2 per view (target < 0.5g)
  let score = 100
  if (carbon.co2PerView > 0.5) score -= (carbon.co2PerView - 0.5) * 50
  if (carbon.co2PerView > 1.0) score -= (carbon.co2PerView - 1.0) * 30
  
  // Bonus for green hosting
  if (carbon.isGreenHosted) score = Math.min(100, score + 10)
  
  return {
    score: Math.max(0, Math.round(score)),
    co2PerView: carbon.co2PerView,
    isGreenHosted: carbon.isGreenHosted,
  }
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (score >= 90) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  if (score >= 30) return 'D'
  return 'E'
}
```

## JSON Output Schema

```typescript
interface EcoScoreOutput {
  version: '1.0'
  url: string
  timestamp: string
  ecoscore: {
    value: number
    grade: string
    percentile: number  // Compared to benchmark
  }
  carbon: {
    perView: { value: number, unit: 'g CO2' }
    perYear: { value: number, unit: 'kg CO2' }
    equivalent: string  // "X km driven" or "X trees needed"
  }
  performance: {
    lighthouse: number
    pageWeight: { value: number, unit: 'KB' }
    requests: number
    domNodes: number
  }
  hosting: {
    isGreen: boolean
    provider?: string
    location?: string
  }
  recommendations: {
    priority: number
    category: string
    action: string
    impact: string
    effort: string
  }[]
}
```

## CLI Usage

```bash
# Calculate EcoScore
npx ecoscore https://example.com

# Compare multiple sites
npx ecoscore https://site1.com https://site2.com --compare

# Output JSON
npx ecoscore https://example.com --format json --output report.json

# Include in CI/CD
npx ecoscore https://example.com --threshold 70 --fail-under
```

## Resources

- references/api-integrations.md - API setup and authentication
- references/scoring-algorithm.md - Detailed scoring methodology
