# API Integrations Reference

## Green Web Foundation API

**Endpoint:** `https://api.thegreenwebfoundation.org/`

### Green Check
```bash
GET /greencheck/{domain}
```

Response:
```json
{
  "url": "example.com",
  "green": true,
  "hosted_by": "Green Host Provider",
  "hosted_by_website": "https://greenhost.com",
  "partner": "Green Web Foundation",
  "supporting_documents": ["https://..."]
}
```

### Batch Check
```bash
POST /v3/greencheck
Content-Type: application/json

["example.com", "test.com", "demo.org"]
```

## Website Carbon API

**Endpoint:** `https://api.websitecarbon.com/`

```bash
GET /site?url={encoded_url}
```

Response:
```json
{
  "url": "https://example.com",
  "green": true,
  "bytes": 456789,
  "cleanerThan": 0.85,
  "statistics": {
    "adjustedBytes": 456789,
    "energy": 0.000123,
    "co2": {
      "grid": { "grams": 0.45, "litres": 0.00025 },
      "renewable": { "grams": 0.15, "litres": 0.00008 }
    }
  }
}
```

## Lighthouse API (PageSpeed Insights)

**Endpoint:** `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`

```bash
GET ?url={encoded_url}&key={API_KEY}&strategy=mobile&category=performance
```

Response fields:
```json
{
  "lighthouseResult": {
    "categories": {
      "performance": { "score": 0.92 }
    },
    "audits": {
      "total-byte-weight": { "numericValue": 456789 },
      "network-requests": { "details": { "items": [] } },
      "dom-size": { "numericValue": 1234 }
    }
  }
}
```

## CO2.js Library

```typescript
import { co2 } from '@tgwf/co2'

const emissions = new co2({ model: 'swd' })

// Calculate emissions for bytes transferred
const result = emissions.perByte(456789)
// Returns: grams of CO2

// With green hosting
const greenResult = emissions.perByte(456789, true)
// Returns: reduced emissions for green hosting
```

## Environment Variables

```env
# .env
PAGESPEED_API_KEY=your_google_api_key
GREEN_WEB_API_KEY=optional_for_batch
CARBON_API_KEY=optional
```

## Rate Limits

| API | Rate Limit | Notes |
|-----|------------|-------|
| Green Web Foundation | 1000/day | Free tier |
| Website Carbon | 500/day | Free tier |
| PageSpeed Insights | 25000/day | With API key |
