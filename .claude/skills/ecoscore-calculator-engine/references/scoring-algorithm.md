# EcoScore Scoring Algorithm

## Score Components

### 1. Performance Score (30%)

| Metric | Weight | Scoring |
|--------|--------|---------|
| Lighthouse Performance | 40% | Direct score (0-100) |
| Page Weight | 30% | 100 - (KB / 10), min 0 |
| HTTP Requests | 20% | 100 - (count × 2), min 0 |
| DOM Size | 10% | 100 - (nodes / 30), min 0 |

```typescript
performanceScore = 
  lighthouse * 0.4 +
  pageWeightScore * 0.3 +
  requestScore * 0.2 +
  domScore * 0.1
```

### 2. Carbon Score (35%)

| CO₂/view | Score |
|----------|-------|
| < 0.2g | 100 |
| 0.2-0.5g | 90-100 |
| 0.5-1.0g | 60-90 |
| 1.0-2.0g | 30-60 |
| > 2.0g | 0-30 |

```typescript
carbonScore = 100 - ((co2PerView - 0.2) × 125)
if (isGreenHosted) carbonScore += 10
carbonScore = clamp(carbonScore, 0, 100)
```

### 3. Best Practices Score (35%)

| Practice | Points |
|----------|--------|
| Green hosting | +20 |
| Caching headers | +15 |
| Compression (gzip/br) | +15 |
| Modern image formats | +15 |
| Lazy loading | +10 |
| No render-blocking | +10 |
| Efficient fonts | +10 |
| No unused CSS/JS | +5 |

## Final EcoScore Calculation

```typescript
ecoscore = 
  performanceScore × 0.30 +
  carbonScore × 0.35 +
  bestPracticesScore × 0.35
```

## Grade Thresholds

| Grade | Score Range | Description |
|-------|-------------|-------------|
| A | 90-100 | Excellent - Top 10% |
| B | 70-89 | Good - Above average |
| C | 50-69 | Average - Room to improve |
| D | 30-49 | Below average |
| E | 0-29 | Poor - Needs attention |

## CO₂ Equivalents

```typescript
function getCO2Equivalent(kgCO2PerYear: number): string {
  const kmDriven = kgCO2PerYear / 0.12  // avg car
  const treesNeeded = kgCO2PerYear / 21 // yearly absorption
  const phonesCharged = kgCO2PerYear / 0.008
  
  if (kgCO2PerYear < 1) {
    return `${Math.round(phonesCharged)} smartphone charges`
  }
  if (kgCO2PerYear < 10) {
    return `${Math.round(kmDriven)} km driven by car`
  }
  return `${Math.round(treesNeeded)} trees needed to absorb annually`
}
```

## Benchmark Data

| Percentile | EcoScore | CO₂/view |
|------------|----------|----------|
| Top 10% | >90 | <0.2g |
| Top 25% | >75 | <0.4g |
| Median | 55-65 | 0.5-0.8g |
| Bottom 25% | <40 | >1.2g |
| Bottom 10% | <25 | >2.0g |
