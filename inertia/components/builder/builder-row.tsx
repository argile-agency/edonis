import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  FileUp,
  Film,
  GripVertical,
  HelpCircle,
  Link as LinkIcon,
  Pencil,
  Plus,
} from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { InlineTitle } from '~/components/builder/inline-title'
import { DetailsPanel, type DetailsValues } from '~/components/builder/details-panel'
import { ItemActionsMenu } from '~/components/builder/item-actions-menu'
import type { BuilderRow as Row, ContentType, MoveTarget } from '~/lib/builder_tree'

const CONTENT_ICONS: Record<ContentType, typeof FileText> = {
  page: FileText,
  video: Film,
  link: LinkIcon,
  file: FileUp,
  assignment: ClipboardList,
  quiz: HelpCircle,
}

export interface BuilderRowProps {
  row: Row
  /** Section and level, for screen readers: the flat list shows them only by indentation. */
  location: string
  expanded?: boolean
  onToggleExpanded?(): void
  editing: boolean
  initialDraft?: string
  titleError?: string | null
  onStartEdit(): void
  onCancelEdit(): void
  onSubmitTitle(value: string): void
  panelOpen: boolean
  onTogglePanel(): void
  panelError?: string | null
  onSavePanel(patch: Partial<DetailsValues>): void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp(): void
  onMoveDown(): void
  moveTargets: MoveTarget[]
  onMoveTo(parentId: number | null): void
  hasDescendants?: boolean
  retentionDays: number
  onDelete(): void
  loadLearnerImpact?: () => Promise<number>
  onCloseFocusTarget?: () => HTMLElement | null
  onAddContent?(): void
  onAddSubSection?(): void
  /** Depth shown while this section row is dragged (projected drop level). */
  projectedDepth?: number
  /** Selection slot (05-10): the checkbox renders only when onToggleSelect is given. */
  selected?: boolean
  onToggleSelect?: () => void
}

/** One builder row, a section header or a content item. Stateless: the page owns everything. */
export function BuilderRow(props: BuilderRowProps) {
  const { row } = props
  const isSection = row.kind === 'section'
  const item = isSection ? row.section : row.content
  const title = item.title
  const kindLabel = isSection ? 'la section' : 'le contenu'
  const Icon = isSection ? null : CONTENT_ICONS[row.content.contentType]
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.key,
    data: { kind: row.kind },
    attributes: { roleDescription: 'élément déplaçable' },
  })

  return (
    <li
      ref={setNodeRef}
      data-row-key={row.key}
      style={{
        paddingLeft: (isDragging ? (props.projectedDepth ?? row.depth) : row.depth) * 24,
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={`mb-2 list-none${isDragging ? ' opacity-40' : ''}`}
    >
      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {props.onToggleSelect && (
            <Checkbox
              id={`${row.key}-select`}
              checked={props.selected ?? false}
              onCheckedChange={() => props.onToggleSelect?.()}
              aria-label={`Sélectionner « ${title} »`}
              aria-describedby={`${row.key}-location`}
            />
          )}
          {/* Drag listeners live on this button only: touch elsewhere scrolls, the checkbox never drags. */}
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Déplacer « ${title} »`}
            className="inline-flex size-9 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
          {isSection ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-expanded={props.expanded ?? false}
              aria-label={`Contenu de « ${title} »`}
              onClick={props.onToggleExpanded}
            >
              {props.expanded ? (
                <ChevronDown aria-hidden="true" />
              ) : (
                <ChevronRight aria-hidden="true" />
              )}
            </Button>
          ) : (
            Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1">
            <InlineTitle
              idBase={row.key}
              title={title}
              kindLabel={kindLabel}
              editing={props.editing}
              initialDraft={props.initialDraft}
              errorMessage={props.titleError}
              onStartEdit={props.onStartEdit}
              onCancel={props.onCancelEdit}
              onSubmit={props.onSubmitTitle}
              titleClassName={isSection ? 'font-semibold' : undefined}
            />
            <span id={`${row.key}-location`} className="sr-only">
              {props.location}
            </span>
          </div>

          {!item.isPublished && (
            <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
              Brouillon
            </span>
          )}
          {isSection && row.tooDeep && (
            <span className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-800">
              Niveau 3 : invisible pour les apprenants
            </span>
          )}

          {isSection && !row.tooDeep && props.onAddContent && (
            <Button type="button" variant="ghost" size="sm" onClick={props.onAddContent}>
              <Plus aria-hidden="true" />
              Contenu
            </Button>
          )}
          {isSection && row.section.parentId === null && props.onAddSubSection && (
            <Button type="button" variant="ghost" size="sm" onClick={props.onAddSubSection}>
              <Plus aria-hidden="true" />
              Sous-section
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Renommer ${kindLabel} « ${title} »`}
            onClick={props.onStartEdit}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={props.panelOpen}
            aria-controls={`${row.key}-panel`}
            onClick={props.onTogglePanel}
          >
            Détails
          </Button>
          <ItemActionsMenu
            idBase={row.key}
            kind={row.kind}
            title={title}
            canMoveUp={props.canMoveUp}
            canMoveDown={props.canMoveDown}
            onMoveUp={props.onMoveUp}
            onMoveDown={props.onMoveDown}
            moveTargets={props.moveTargets}
            onMoveTo={props.onMoveTo}
            hasDescendants={props.hasDescendants}
            retentionDays={props.retentionDays}
            onDelete={props.onDelete}
            loadLearnerImpact={props.loadLearnerImpact}
            onCloseFocusTarget={props.onCloseFocusTarget}
          />
        </div>

        {props.panelOpen && !isDragging && (
          <div className="mt-3">
            <DetailsPanel
              idBase={row.key}
              kind={row.kind}
              values={{
                description: item.description,
                isPublished: item.isPublished,
                availableFrom: item.availableFrom,
                availableUntil: item.availableUntil,
              }}
              errorMessage={props.panelError}
              onSave={props.onSavePanel}
            />
          </div>
        )}
      </div>
    </li>
  )
}
