import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  LevelFormat,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageNumber,
} from 'docx'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load audit data
const auditData = JSON.parse(fs.readFileSync(join(__dirname, 'showcase-rgesn-audit.json'), 'utf8'))

// Colors
const colors = {
  primary: '2563EB',
  success: '16A34A',
  warning: 'D97706',
  error: 'DC2626',
  gray: '6B7280',
  lightGray: 'F3F4F6',
  headerBg: 'E0E7FF',
}

// Table border style
const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' }
const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder }

// Numbering config
const numberingConfig = {
  config: [
    {
      reference: 'bullet-list',
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
    {
      reference: 'actions-list',
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
  ],
}

// Helper: Create score badge text
function getScoreLevel(score) {
  if (score >= 90) return { text: 'Excellent', color: colors.success }
  if (score >= 75) return { text: 'Bon', color: colors.primary }
  if (score >= 50) return { text: 'Moyen', color: colors.warning }
  return { text: 'À améliorer', color: colors.error }
}

// Helper: Status text
function getStatusText(status) {
  switch (status) {
    case 'conforme':
      return { text: 'Conforme', color: colors.success }
    case 'partiellement_conforme':
      return { text: 'Partiel', color: colors.warning }
    case 'non_conforme':
      return { text: 'Non conforme', color: colors.error }
    default:
      return { text: 'N/A', color: colors.gray }
  }
}

// Helper: Priority text
function getPriorityText(priority) {
  switch (priority) {
    case 'critical':
      return { text: 'Critique', color: colors.error }
    case 'major':
      return { text: 'Majeur', color: colors.warning }
    case 'minor':
      return { text: 'Mineur', color: colors.gray }
    default:
      return { text: '-', color: colors.gray }
  }
}

// Create header cell
function createHeaderCell(text, width) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: colors.headerBg, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 20, font: 'Arial' })],
      }),
    ],
  })
}

// Create data cell
function createDataCell(text, width, align = AlignmentType.LEFT, color = '000000') {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, size: 20, font: 'Arial', color })],
      }),
    ],
  })
}

// Build document
const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      {
        id: 'Title',
        name: 'Title',
        basedOn: 'Normal',
        run: { size: 48, bold: true, color: colors.primary, font: 'Arial' },
        paragraph: { spacing: { before: 0, after: 200 }, alignment: AlignmentType.CENTER },
      },
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 32, bold: true, color: '1E3A5F', font: 'Arial' },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 26, bold: true, color: '374151', font: 'Arial' },
        paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 },
      },
      {
        id: 'Heading3',
        name: 'Heading 3',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 22, bold: true, color: '4B5563', font: 'Arial' },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: numberingConfig,
  sections: [
    {
      properties: {
        page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: 'Audit RGESN & EcoScore - Edonis',
                  size: 18,
                  color: colors.gray,
                  font: 'Arial',
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Page ', size: 18, color: colors.gray, font: 'Arial' }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 18,
                  color: colors.gray,
                  font: 'Arial',
                }),
                new TextRun({ text: ' / ', size: 18, color: colors.gray, font: 'Arial' }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                  size: 18,
                  color: colors.gray,
                  font: 'Arial',
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        // Title
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun("Rapport d'Audit RGESN & EcoScore")],
        }),

        // Subtitle
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: 'Edonis Design System - Page Showcase',
              size: 24,
              color: colors.gray,
              font: 'Arial',
            }),
          ],
        }),

        // Meta info
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [
            new TextRun({
              text: `Date: ${new Date(auditData.generatedAt).toLocaleDateString('fr-FR')}`,
              size: 20,
              color: colors.gray,
              font: 'Arial',
            }),
            new TextRun({ text: '  |  ', size: 20, color: colors.gray, font: 'Arial' }),
            new TextRun({
              text: `Version: ${auditData.audit.auditorVersion}`,
              size: 20,
              color: colors.gray,
              font: 'Arial',
            }),
          ],
        }),

        // Section 1: Synthèse
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('1. Synthèse')] }),

        // Score summary table
        new Table({
          columnWidths: [3000, 2000, 2000, 2360],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                createHeaderCell('Métrique', 3000),
                createHeaderCell('Score', 2000),
                createHeaderCell('Grade', 2000),
                createHeaderCell('Niveau', 2360),
              ],
            }),
            new TableRow({
              children: [
                createDataCell('EcoScore Global', 3000),
                createDataCell(`${auditData.ecoscore.value}/100`, 2000, AlignmentType.CENTER),
                createDataCell(
                  auditData.ecoscore.grade,
                  2000,
                  AlignmentType.CENTER,
                  colors.primary
                ),
                createDataCell(
                  getScoreLevel(auditData.ecoscore.value).text,
                  2360,
                  AlignmentType.CENTER,
                  getScoreLevel(auditData.ecoscore.value).color
                ),
              ],
            }),
            new TableRow({
              children: [
                createDataCell('RGESN Conformité', 3000),
                createDataCell(`${auditData.rgesn.score}/100`, 2000, AlignmentType.CENTER),
                createDataCell(
                  auditData.rgesn.level.split(' - ')[0],
                  2000,
                  AlignmentType.CENTER,
                  colors.primary
                ),
                createDataCell(
                  auditData.rgesn.level.split(' - ')[1] || 'Bon',
                  2360,
                  AlignmentType.CENTER,
                  getScoreLevel(auditData.rgesn.score).color
                ),
              ],
            }),
            new TableRow({
              children: [
                createDataCell('Accessibilité', 3000),
                createDataCell(`${auditData.accessibility.score}/100`, 2000, AlignmentType.CENTER),
                createDataCell(
                  auditData.accessibility.wcagLevel,
                  2000,
                  AlignmentType.CENTER,
                  colors.success
                ),
                createDataCell(
                  getScoreLevel(auditData.accessibility.score).text,
                  2360,
                  AlignmentType.CENTER,
                  getScoreLevel(auditData.accessibility.score).color
                ),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 300, after: 200 }, children: [] }),

        // Conformity breakdown
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun('Répartition de la Conformité RGESN')],
        }),

        new Table({
          columnWidths: [4680, 4680],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [createHeaderCell('Statut', 4680), createHeaderCell('Nombre', 4680)],
            }),
            new TableRow({
              children: [
                createDataCell('Conforme', 4680),
                createDataCell(
                  String(auditData.rgesn.conformity.conforme),
                  4680,
                  AlignmentType.CENTER,
                  colors.success
                ),
              ],
            }),
            new TableRow({
              children: [
                createDataCell('Partiellement conforme', 4680),
                createDataCell(
                  String(auditData.rgesn.conformity.partiel),
                  4680,
                  AlignmentType.CENTER,
                  colors.warning
                ),
              ],
            }),
            new TableRow({
              children: [
                createDataCell('Non conforme', 4680),
                createDataCell(
                  String(auditData.rgesn.conformity.nonConforme),
                  4680,
                  AlignmentType.CENTER,
                  colors.error
                ),
              ],
            }),
            new TableRow({
              children: [
                createDataCell('Non applicable', 4680),
                createDataCell(
                  String(auditData.rgesn.conformity.nonApplicable),
                  4680,
                  AlignmentType.CENTER,
                  colors.gray
                ),
              ],
            }),
          ],
        }),

        // Section 2: EcoScore
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('2. EcoScore Breakdown')],
        }),

        // EcoScore components table
        new Table({
          columnWidths: [3120, 3120, 3120],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                createHeaderCell('Performance (30%)', 3120),
                createHeaderCell('Carbon (35%)', 3120),
                createHeaderCell('Best Practices (35%)', 3120),
              ],
            }),
            new TableRow({
              children: [
                createDataCell(
                  `${auditData.ecoscore.breakdown.performance.score}/100`,
                  3120,
                  AlignmentType.CENTER,
                  colors.primary
                ),
                createDataCell(
                  `${auditData.ecoscore.breakdown.carbon.score}/100`,
                  3120,
                  AlignmentType.CENTER,
                  colors.primary
                ),
                createDataCell(
                  `${auditData.ecoscore.breakdown.bestPractices.score}/100`,
                  3120,
                  AlignmentType.CENTER,
                  colors.primary
                ),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 300 }, children: [] }),

        // Performance details
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Performance')] }),
        new Paragraph({
          numbering: { reference: 'bullet-list', level: 0 },
          children: [
            new TextRun({
              text: `Lighthouse estimé: ${auditData.ecoscore.breakdown.performance.metrics.lighthouse}/100`,
              size: 20,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          numbering: { reference: 'bullet-list', level: 0 },
          children: [
            new TextRun({
              text: `Poids de page: ${auditData.ecoscore.breakdown.performance.metrics.pageWeightEstimate}`,
              size: 20,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          numbering: { reference: 'bullet-list', level: 0 },
          children: [
            new TextRun({
              text: `Requêtes HTTP: ${auditData.ecoscore.breakdown.performance.metrics.requestCount}`,
              size: 20,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          numbering: { reference: 'bullet-list', level: 0 },
          children: [
            new TextRun({
              text: `Nœuds DOM: ${auditData.ecoscore.breakdown.performance.metrics.domNodes}`,
              size: 20,
              font: 'Arial',
            }),
          ],
        }),

        // Carbon details
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun('Empreinte Carbone')],
        }),
        new Paragraph({
          numbering: { reference: 'bullet-list', level: 0 },
          children: [
            new TextRun({
              text: `CO2 par visite: ${auditData.ecoscore.breakdown.carbon.metrics.co2PerView}`,
              size: 20,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          numbering: { reference: 'bullet-list', level: 0 },
          children: [
            new TextRun({
              text: `CO2 annuel: ${auditData.ecoscore.breakdown.carbon.metrics.co2PerYear}`,
              size: 20,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          numbering: { reference: 'bullet-list', level: 0 },
          children: [
            new TextRun({
              text: `Équivalent: ${auditData.ecoscore.breakdown.carbon.equivalent}`,
              size: 20,
              font: 'Arial',
            }),
          ],
        }),

        // Section 3: RGESN par thématique
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('3. Résultats RGESN par Thématique')],
        }),

        // UX/UI
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun(`UX/UI - Score: ${auditData.rgesn.thematiques.ux_ui.score}/100`)],
        }),

        new Table({
          columnWidths: [1200, 5000, 1500, 1660],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                createHeaderCell('ID', 1200),
                createHeaderCell('Critère', 5000),
                createHeaderCell('Statut', 1500),
                createHeaderCell('Score', 1660),
              ],
            }),
            ...auditData.rgesn.thematiques.ux_ui.criteria.map((c) => {
              const status = getStatusText(c.status)
              return new TableRow({
                children: [
                  createDataCell(c.id, 1200, AlignmentType.CENTER),
                  createDataCell(c.title, 5000),
                  createDataCell(status.text, 1500, AlignmentType.CENTER, status.color),
                  createDataCell(`${c.score}`, 1660, AlignmentType.CENTER),
                ],
              })
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 300 }, children: [] }),

        // Contenus
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun(`Contenus - Score: ${auditData.rgesn.thematiques.contenus.score}/100`),
          ],
        }),

        new Table({
          columnWidths: [1200, 5000, 1500, 1660],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                createHeaderCell('ID', 1200),
                createHeaderCell('Critère', 5000),
                createHeaderCell('Statut', 1500),
                createHeaderCell('Score', 1660),
              ],
            }),
            ...auditData.rgesn.thematiques.contenus.criteria.map((c) => {
              const status = getStatusText(c.status)
              return new TableRow({
                children: [
                  createDataCell(c.id, 1200, AlignmentType.CENTER),
                  createDataCell(c.title, 5000),
                  createDataCell(status.text, 1500, AlignmentType.CENTER, status.color),
                  createDataCell(`${c.score}`, 1660, AlignmentType.CENTER),
                ],
              })
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 300 }, children: [] }),

        // Frontend
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun(`Frontend - Score: ${auditData.rgesn.thematiques.frontend.score}/100`),
          ],
        }),

        new Table({
          columnWidths: [1200, 5000, 1500, 1660],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                createHeaderCell('ID', 1200),
                createHeaderCell('Critère', 5000),
                createHeaderCell('Statut', 1500),
                createHeaderCell('Score', 1660),
              ],
            }),
            ...auditData.rgesn.thematiques.frontend.criteria.map((c) => {
              const status = getStatusText(c.status)
              return new TableRow({
                children: [
                  createDataCell(c.id, 1200, AlignmentType.CENTER),
                  createDataCell(c.title, 5000),
                  createDataCell(status.text, 1500, AlignmentType.CENTER, status.color),
                  createDataCell(`${c.score}`, 1660, AlignmentType.CENTER),
                ],
              })
            }),
          ],
        }),

        // Section 4: Actions Prioritaires
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('4. Actions Prioritaires')],
        }),

        new Table({
          columnWidths: [1500, 1200, 4500, 2160],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                createHeaderCell('Priorité', 1500),
                createHeaderCell('Critère', 1200),
                createHeaderCell('Action', 4500),
                createHeaderCell('Gain estimé', 2160),
              ],
            }),
            ...auditData.prioritizedActions.map((a) => {
              const priority = getPriorityText(a.priority)
              return new TableRow({
                children: [
                  createDataCell(priority.text, 1500, AlignmentType.CENTER, priority.color),
                  createDataCell(a.criterion, 1200, AlignmentType.CENTER),
                  createDataCell(a.action, 4500),
                  createDataCell(a.estimatedGain, 2160, AlignmentType.CENTER, colors.success),
                ],
              })
            }),
          ],
        }),

        // Section 5: Accessibilité
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('5. Accessibilité')],
        }),

        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: `Score: ${auditData.accessibility.score}/100 - Niveau ${auditData.accessibility.wcagLevel}`,
              size: 22,
              bold: true,
              color: colors.success,
              font: 'Arial',
            }),
          ],
        }),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun('Points Forts')] }),
        ...auditData.accessibility.strengths.map(
          (s) =>
            new Paragraph({
              numbering: { reference: 'bullet-list', level: 0 },
              children: [new TextRun({ text: s, size: 20, font: 'Arial' })],
            })
        ),

        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun('Améliorations Suggérées')],
        }),
        ...auditData.accessibility.improvements.map(
          (i) =>
            new Paragraph({
              numbering: { reference: 'bullet-list', level: 0 },
              children: [
                new TextRun({ text: `${i.issue} → ${i.recommendation}`, size: 20, font: 'Arial' }),
              ],
            })
        ),

        // Section 6: Empreinte Environnementale
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('6. Empreinte Environnementale')],
        }),

        new Table({
          columnWidths: [4680, 4680],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [createHeaderCell('Métrique', 4680), createHeaderCell('Valeur', 4680)],
            }),
            new TableRow({
              children: [
                createDataCell('CO2 par visite', 4680),
                createDataCell(
                  `${auditData.sustainability.carbon.perView.value} ${auditData.sustainability.carbon.perView.unit}`,
                  4680,
                  AlignmentType.CENTER
                ),
              ],
            }),
            new TableRow({
              children: [
                createDataCell('CO2 annuel', 4680),
                createDataCell(
                  `${auditData.sustainability.carbon.perYear.value} ${auditData.sustainability.carbon.perYear.unit}`,
                  4680,
                  AlignmentType.CENTER
                ),
              ],
            }),
            new TableRow({
              children: [
                createDataCell('Équivalent voiture', 4680),
                createDataCell(
                  `${auditData.sustainability.carbon.equivalent.carKm} km`,
                  4680,
                  AlignmentType.CENTER
                ),
              ],
            }),
            new TableRow({
              children: [
                createDataCell('Charges smartphone', 4680),
                createDataCell(
                  `${auditData.sustainability.carbon.equivalent.smartphoneCharges}`,
                  4680,
                  AlignmentType.CENTER
                ),
              ],
            }),
            new TableRow({
              children: [
                createDataCell('Arbres nécessaires', 4680),
                createDataCell(
                  `${auditData.sustainability.carbon.equivalent.treesNeeded}`,
                  4680,
                  AlignmentType.CENTER
                ),
              ],
            }),
          ],
        }),

        // Section 7: Verdict
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('7. Verdict Final')],
        }),

        new Paragraph({
          spacing: { before: 200, after: 300 },
          shading: { fill: colors.lightGray, type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: auditData.summary.verdict,
              size: 22,
              italics: true,
              font: 'Arial',
            }),
          ],
        }),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun('Points Forts')] }),
        ...auditData.summary.strengths.map(
          (s) =>
            new Paragraph({
              numbering: { reference: 'bullet-list', level: 0 },
              children: [new TextRun({ text: s, size: 20, color: colors.success, font: 'Arial' })],
            })
        ),

        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun('Points à Améliorer')],
        }),
        ...auditData.summary.weaknesses.map(
          (w) =>
            new Paragraph({
              numbering: { reference: 'bullet-list', level: 0 },
              children: [new TextRun({ text: w, size: 20, color: colors.warning, font: 'Arial' })],
            })
        ),

        // Footer info
        new Paragraph({ spacing: { before: 600 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`,
              size: 18,
              color: colors.gray,
              italics: true,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `Outils: ${auditData.audit.auditorVersion}`,
              size: 18,
              color: colors.gray,
              italics: true,
              font: 'Arial',
            }),
          ],
        }),
      ],
    },
  ],
})

// Generate document
const outputPath = join(__dirname, 'showcase-rgesn-audit-report.docx')
Packer.toBuffer(doc)
  .then((buffer) => {
    fs.writeFileSync(outputPath, buffer)
    console.log('Document generated:', outputPath)
  })
  .catch((err) => {
    console.error('Error generating document:', err)
  })
