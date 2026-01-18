# RGESN Criteria Reference

## Thématique 1: Stratégie (1-10)

| ID | Critère | Niveau |
|----|---------|--------|
| 1.1 | Le service numérique a-t-il été évalué favorablement en termes d'utilité ? | A |
| 1.2 | Le service numérique a-t-il défini ses cibles utilisatrices ? | A |
| 1.3 | Le service numérique a-t-il défini les besoins métiers et les attentes ? | A |
| 1.4 | Le service numérique a-t-il défini la liste des équipements ciblés ? | A |
| 1.5 | Le service numérique a-t-il défini la liste des navigateurs ciblés ? | A |
| 1.6 | Le service numérique est-il utilisable via une connexion bas débit ? | AA |
| 1.7 | Le service numérique est-il utilisable sur les équipements les plus anciens ? | AA |
| 1.8 | Une stratégie de fin de vie a-t-elle été définie ? | AAA |

## Thématique 5: Contenus (41-50)

| ID | Critère | Vérification automatisable |
|----|---------|---------------------------|
| 5.1 | Les contenus sont-ils utiles et nécessaires ? | Non |
| 5.2 | Les contenus textuels sont-ils lisibles ? | Oui (Flesch) |
| 5.3 | Les images sont-elles optimisées ? | Oui |
| 5.4 | Les formats d'images sont-ils adaptés ? | Oui |
| 5.5 | Les vidéos sont-elles optimisées ? | Oui |
| 5.6 | Le téléchargement de ressources est-il évité ? | Oui |
| 5.7 | Les documents téléchargeables sont-ils optimisés ? | Oui |

## Thématique 6: Frontend (51-60)

| ID | Critère | Mesure |
|----|---------|--------|
| 6.1 | Le poids des pages est-il inférieur à 1 Mo ? | Page weight |
| 6.2 | Le nombre de requêtes HTTP est-il limité ? | Request count |
| 6.3 | Les scripts JS sont-ils minifiés ? | File analysis |
| 6.4 | Les CSS sont-elles minifiées ? | File analysis |
| 6.5 | Le lazy loading est-il implémenté ? | DOM analysis |
| 6.6 | Les animations sont-elles optimisées ? | CSS analysis |
| 6.7 | Les fonts sont-elles optimisées ? | Font analysis |

## Automated Check Functions

```typescript
// Criterion 5.3: Image optimization
async function checkImageOptimization(page: Page): Promise<CriterionResult> {
  const images = await page.$$eval('img', imgs => 
    imgs.map(img => ({
      src: img.src,
      width: img.naturalWidth,
      displayWidth: img.clientWidth,
      format: img.src.split('.').pop(),
    }))
  )
  
  const issues = images.filter(img => {
    // Check if image is oversized
    if (img.width > img.displayWidth * 2) return true
    // Check format (should be webp/avif)
    if (!['webp', 'avif'].includes(img.format)) return true
    return false
  })
  
  return {
    criterionId: '5.3',
    status: issues.length === 0 ? 'conforme' : 'non_conforme',
    score: Math.max(0, 100 - (issues.length * 10)),
    evidence: issues.map(i => i.src),
  }
}

// Criterion 6.1: Page weight
async function checkPageWeight(metrics: PageMetrics): Promise<CriterionResult> {
  const weightKB = metrics.totalTransferSize / 1024
  
  return {
    criterionId: '6.1',
    status: weightKB < 1000 ? 'conforme' : 'non_conforme',
    score: Math.max(0, 100 - Math.floor((weightKB - 500) / 10)),
    evidence: [`Total: ${weightKB.toFixed(0)} KB`],
    recommendations: weightKB >= 1000 ? ['Optimiser images', 'Minifier JS/CSS'] : [],
  }
}
```
