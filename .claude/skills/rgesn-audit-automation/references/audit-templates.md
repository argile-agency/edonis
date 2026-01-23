# RGESN Audit Report Templates

## JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "RGESNAuditReport",
  "type": "object",
  "required": ["version", "generatedAt", "audit", "results"],
  "properties": {
    "version": { "type": "string", "const": "1.0" },
    "generatedAt": { "type": "string", "format": "date-time" },
    "audit": {
      "type": "object",
      "properties": {
        "url": { "type": "string", "format": "uri" },
        "scope": { "type": "array", "items": { "type": "string" } },
        "pages": { "type": "array", "items": { "type": "string" } }
      }
    },
    "results": {
      "type": "object",
      "properties": {
        "score": { "type": "number", "minimum": 0, "maximum": 100 },
        "level": { "type": "string", "enum": ["A", "B", "C", "D", "E"] },
        "conformity": {
          "type": "object",
          "properties": {
            "conforme": { "type": "integer" },
            "nonConforme": { "type": "integer" },
            "partiel": { "type": "integer" },
            "nonApplicable": { "type": "integer" }
          }
        }
      }
    }
  }
}
```

## Summary Template

```markdown
# Rapport d'Audit RGESN

**Site:** {{url}}
**Date:** {{date}}
**Score Global:** {{score}}/100 (Niveau {{level}})

## Synthèse

| Métrique                         | Valeur                       |
| -------------------------------- | ---------------------------- |
| Critères conformes               | {{conformity.conforme}}      |
| Critères non conformes           | {{conformity.nonConforme}}   |
| Critères partiellement conformes | {{conformity.partiel}}       |
| Critères non applicables         | {{conformity.nonApplicable}} |

## Score par Thématique

{{#each thematiques}}

### {{name}} - {{score}}/100

{{#each criteria}}

- [{{status}}] {{id}}: {{title}}
  {{/each}}
  {{/each}}

## Actions Prioritaires

{{#each prioritizedActions}}

### {{priority}}: {{criterion}}

- **Action:** {{action}}
- **Impact:** {{impact}}
- **Effort:** {{effort}}
  {{/each}}
```

## PDF Header Template

```html
<header class="audit-header">
  <img src="logo.png" alt="Logo" />
  <div class="audit-info">
    <h1>Audit RGESN</h1>
    <p class="url">{{url}}</p>
    <p class="date">{{date}}</p>
  </div>
  <div class="score-badge score-{{level}}">
    <span class="score">{{score}}</span>
    <span class="level">Niveau {{level}}</span>
  </div>
</header>
```

## API Response Format

```typescript
// POST /api/audit response
interface AuditAPIResponse {
  success: boolean
  auditId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress?: number
  result?: RGESNReport
  error?: string
}
```
