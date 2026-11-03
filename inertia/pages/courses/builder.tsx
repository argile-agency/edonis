import { Head, Link, router, useForm } from '@inertiajs/react'
import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { createPortal } from 'react-dom'
import {
  closestCenter,
  DndContext,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Eye, FileText, Plus } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Card, CardContent } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import AppHeader from '~/components/layout/app-header'
import { BuilderRow, type BuilderRowProps } from '~/components/builder/builder-row'
import type { DetailsValues } from '~/components/builder/details-panel'
import { SaveStatus } from '~/components/builder/save-status'
import { sendJson, useSaveQueue } from '~/lib/builder_save_queue'
import type { SaveError } from '~/lib/save_queue'
import {
  applyContentMove,
  applySectionMove,
  buildRows,
  canDeleteSection,
  moveTargets,
  projectContentDrop,
  projectSectionDrop,
  sectionRowsForDrag,
  siblingPlacement,
  type BuilderContent,
  type BuilderRow as Row,
  type BuilderSection,
  type ContentType,
  type ItemRef,
  type Placement,
} from '~/lib/builder_tree'

type HeaderProps = ComponentProps<typeof AppHeader>

interface Props {
  course: { id: number; title: string; code: string }
  sections: BuilderSection[]
  contents: BuilderContent[]
  auth: { user: HeaderProps['user'] }
  appSettings: HeaderProps['appSettings']
  menus: HeaderProps['menus']
}

type ItemPatch = Partial<
  Pick<
    BuilderSection,
    'title' | 'description' | 'isPublished' | 'availableFrom' | 'availableUntil' | 'updatedAt'
  >
>
type Saved = { item: { id: number; updatedAt?: string | null } }
type Snapshot = { sections: BuilderSection[]; contents: BuilderContent[] }
type Projection = (Placement & { depth?: number }) | null

/** Row indentation; also the horizontal drag distance for one section level. */
const INDENT_PX = 24
const ROOT_LABEL = 'Racine du cours'
const DRAG_INSTRUCTIONS =
  "Pour déplacer, appuyez sur Espace, utilisez les flèches haut et bas (gauche et droite pour changer le niveau d'une section), puis Espace pour déposer ou Échap pour annuler."

/** Sections: Up/Down keep the level shift, Left/Right change the level. Contents: vertical only. */
const builderKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  if (!String(args.active).startsWith('s-')) return sortableKeyboardCoordinates(event, args)
  const { currentCoordinates } = args
  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    event.preventDefault()
    const shift = event.code === 'ArrowRight' ? INDENT_PX : -INDENT_PX
    return { ...currentCoordinates, x: currentCoordinates.x + shift }
  }
  const next = sortableKeyboardCoordinates(event, args)
  return next && { ...next, x: currentCoordinates.x }
}

const urlOf = (ref: ItemRef) =>
  ref.kind === 'section' ? `/modules/${ref.id}` : `/contents/${ref.id}`
const refOf = (row: Row): ItemRef => ({ kind: row.kind, id: row.id })

/** Snapshot rows with the current `updatedAt` of every item still present. */
function withCurrentTokens<T extends { id: number; updatedAt: string | null }>(
  snapshot: T[],
  current: T[]
): T[] {
  const tokens = new Map(current.map((item) => [item.id, item.updatedAt]))
  return snapshot.map((item) =>
    tokens.has(item.id) ? { ...item, updatedAt: tokens.get(item.id) ?? null } : item
  )
}

export default function CourseBuilder(props: Props) {
  const { course, auth, appSettings, menus } = props

  // Local optimistic state. The refs are written only by commitSections / commitContents,
  // synchronously, because the queue starts the next op's run() before React re-renders.
  const [sections, setSections] = useState(props.sections)
  const [contents, setContents] = useState(props.contents)
  const sectionsRef = useRef(props.sections)
  const contentsRef = useRef(props.contents)
  const commitSections = (next: BuilderSection[]) => {
    sectionsRef.current = next
    setSections(next)
  }
  const commitContents = (next: BuilderContent[]) => {
    contentsRef.current = next
    setContents(next)
  }

  const [expanded, setExpanded] = useState(() => new Set(props.sections.map((s) => s.id)))
  const knownSectionIdsRef = useRef(new Set(props.sections.map((s) => s.id)))
  const latestPropsRef = useRef<Snapshot>({ sections: props.sections, contents: props.contents })
  const appliedPropsRef = useRef(latestPropsRef.current)

  const [editing, setEditing] = useState<{ key: string; draft?: string; error?: string } | null>(
    null
  )
  const [openPanels, setOpenPanels] = useState<Set<string>>(() => new Set())
  const [panelErrors, setPanelErrors] = useState<Record<string, string>>({})
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null)
  const pendingFocusRef = useRef<string | null>(null)

  const queue = useSaveQueue()

  // Props re-sync: new server props (creation, "Recharger") are applied once no save is in flight.
  useEffect(() => {
    const latest = latestPropsRef.current
    if (latest.sections !== props.sections || latest.contents !== props.contents) {
      latestPropsRef.current = { sections: props.sections, contents: props.contents }
    }
    if (queue.pending > 0 || latestPropsRef.current === appliedPropsRef.current) return
    const next = latestPropsRef.current
    appliedPropsRef.current = next
    commitSections(next.sections)
    commitContents(next.contents)
    const fresh = next.sections.filter((s) => !knownSectionIdsRef.current.has(s.id))
    if (fresh.length > 0) {
      for (const s of fresh) knownSectionIdsRef.current.add(s.id)
      setExpanded((prev) => new Set([...prev, ...fresh.map((s) => s.id)]))
    }
  }, [props.sections, props.contents, queue.pending])

  // The ref is kept: Radix asks onCloseFocusTarget later (setTimeout on unmount), which consumes it.
  useEffect(() => {
    if (!pendingFocusId) return
    document.getElementById(pendingFocusId)?.focus()
    setPendingFocusId(null)
  }, [pendingFocusId])

  const takeFocusTarget = () => {
    const id = pendingFocusRef.current
    pendingFocusRef.current = null
    return id ? document.getElementById(id) : null
  }

  const focusLater = (id: string | null) => {
    pendingFocusRef.current = id
    setPendingFocusId(id)
  }

  const expand = (id: number) => setExpanded((prev) => new Set(prev).add(id))

  const reload = () =>
    router.reload({ only: ['sections', 'contents'], onFinish: () => queue.dismiss() })

  // --- state helpers (whole arrays and id lists, so bulk actions can reuse them) ---

  const tokenOf = (ref: ItemRef) =>
    (ref.kind === 'section'
      ? sectionsRef.current.find((s) => s.id === ref.id)?.updatedAt
      : contentsRef.current.find((c) => c.id === ref.id)?.updatedAt) ?? null

  const patchItem = (ref: ItemRef, patch: ItemPatch) => {
    if (ref.kind === 'section') {
      commitSections(sectionsRef.current.map((s) => (s.id === ref.id ? { ...s, ...patch } : s)))
    } else {
      commitContents(contentsRef.current.map((c) => (c.id === ref.id ? { ...c, ...patch } : c)))
    }
  }

  const removeItems = (sectionIds: number[], contentIds: number[]) => {
    if (sectionIds.length > 0) {
      commitSections(sectionsRef.current.filter((s) => !sectionIds.includes(s.id)))
    }
    if (contentIds.length > 0) {
      commitContents(contentsRef.current.filter((c) => !contentIds.includes(c.id)))
    }
  }

  /** One optimistic op: snapshot + mutate on apply, token read at run time, snapshot restored on failure. */
  const save = (
    label: string,
    ref: ItemRef,
    mutate: () => void,
    send: (token: string | null) => Promise<Saved>,
    onError?: (error: SaveError) => void
  ) => {
    let snapshot: Snapshot = { sections: sectionsRef.current, contents: contentsRef.current }
    queue.enqueue({
      label,
      apply() {
        snapshot = { sections: sectionsRef.current, contents: contentsRef.current }
        mutate()
      },
      async run() {
        const res = await send(tokenOf(ref))
        if (res.item.updatedAt !== undefined) patchItem(ref, { updatedAt: res.item.updatedAt })
      },
      rollback(error) {
        // Tokens are server truth: an earlier op may have saved since the snapshot.
        commitSections(withCurrentTokens(snapshot.sections, sectionsRef.current))
        commitContents(withCurrentTokens(snapshot.contents, contentsRef.current))
        onError?.(error)
      },
    })
  }

  // --- actions ---

  const rename = (row: Row, value: string) => {
    const ref = refOf(row)
    setEditing(null)
    const current = row.kind === 'section' ? row.section.title : row.content.title
    if (value === current) return
    save(
      'Renommer',
      ref,
      () => patchItem(ref, { title: value }),
      (token) => sendJson('PUT', urlOf(ref), { title: value, updatedAt: token }),
      (error) => {
        if (error.kind !== 'conflict') return
        // D-09: take the fresh title and token, keep what the teacher typed.
        const fresh = (error.body as { item?: { title?: string; updatedAt?: string | null } })?.item
        if (fresh) patchItem(ref, { title: fresh.title, updatedAt: fresh.updatedAt ?? null })
        setEditing({ key: row.key, draft: value, error: error.message })
      }
    )
  }

  const saveDetails = (row: Row, patch: Partial<DetailsValues>) => {
    const ref = refOf(row)
    setPanelErrors((prev) => {
      const next = { ...prev }
      delete next[row.key]
      return next
    })
    save(
      'Détails',
      ref,
      () => patchItem(ref, patch),
      (token) => sendJson('PUT', urlOf(ref), { ...patch, updatedAt: token }),
      (error) => {
        if (error.kind === 'conflict') {
          const fresh = (error.body as { item?: { updatedAt?: string | null } })?.item
          if (fresh) patchItem(ref, { updatedAt: fresh.updatedAt ?? null })
        }
        setPanelErrors((prev) => ({ ...prev, [row.key]: error.message }))
      }
    )
  }

  const move = (row: Row, placement: Placement, focusActions = true) => {
    const ref = refOf(row)
    save(
      'Déplacer',
      ref,
      () => {
        if (ref.kind === 'content') {
          commitContents(applyContentMove(contentsRef.current, ref.id, placement))
        } else {
          commitSections(applySectionMove(sectionsRef.current, ref.id, placement))
        }
      },
      (token) =>
        sendJson(
          'POST',
          `${urlOf(ref)}/move`,
          ref.kind === 'content'
            ? { moduleId: placement.parentId, position: placement.position, updatedAt: token }
            : { parentId: placement.parentId, position: placement.position, updatedAt: token }
        )
    )
    // The destination must be open, or the moved row (and its focus target) disappears.
    if (placement.parentId !== null) expand(placement.parentId)
    if (focusActions) focusLater(`${row.key}-actions`)
  }

  /** "Déplacer vers…": the item goes to the end of the destination. */
  const moveTo = (row: Row, parentId: number | null) => {
    const position =
      row.kind === 'content'
        ? contentsRef.current.filter((c) => c.moduleId === parentId && c.id !== row.id).length
        : sectionsRef.current.filter((s) => s.parentId === parentId && s.id !== row.id).length
    move(row, { parentId, position })
  }

  const remove = (row: Row, rows: Row[]) => {
    const ref = refOf(row)
    const index = rows.findIndex((r) => r.key === row.key)
    const neighbour = rows[index + 1] ?? rows[index - 1]
    save(
      'Supprimer',
      ref,
      () => (ref.kind === 'section' ? removeItems([ref.id], []) : removeItems([], [ref.id])),
      () => sendJson('DELETE', urlOf(ref))
    )
    focusLater(neighbour ? `${neighbour.key}-title` : null)
  }

  // --- creation (Inertia forms, unchanged endpoints) ---

  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false)
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false)
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null)

  const moduleForm = useForm({
    courseId: course.id,
    parentId: null as number | null,
    title: '',
    description: '',
    isPublished: true,
  })

  const contentForm = useForm({
    moduleId: 0,
    contentType: 'page' as ContentType,
    title: '',
    description: '',
    content: '',
    externalUrl: '',
    isPublished: true,
  })

  const handleCreateModule = (parentId: number | null = null) => {
    moduleForm.setData({ ...moduleForm.data, courseId: course.id, parentId })
    setIsModuleDialogOpen(true)
  }

  const handleCreateContent = (moduleId: number) => {
    setSelectedModuleId(moduleId)
    expand(moduleId)
    contentForm.setData({ ...contentForm.data, moduleId })
    setIsContentDialogOpen(true)
  }

  // preserveState keeps this component mounted, so expansion and the save queue survive.
  const submitModule = (e: React.FormEvent) => {
    e.preventDefault()
    moduleForm.post(`/courses/${course.id}/modules`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setIsModuleDialogOpen(false)
        moduleForm.reset()
      },
    })
  }

  const submitContent = (e: React.FormEvent) => {
    e.preventDefault()
    contentForm.post(`/modules/${selectedModuleId}/contents`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setIsContentDialogOpen(false)
        contentForm.reset()
      },
    })
  }

  // --- rows and drag ---

  const rows = buildRows(sections, contents, expanded)

  // DragOverlay portals into document.body, which only exists after hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [projectedDepth, setProjectedDepth] = useState<number | undefined>(undefined)
  const activeRow = activeKey ? rows.find((r) => r.key === activeKey) : undefined
  // A dragged section moves among sections only, without its own sub-tree.
  const dragRows = activeKey?.startsWith('s-') ? sectionRowsForDrag(rows, activeKey) : rows
  const depthOffsetRef = useRef(0)
  const projectionRef = useRef<Projection>(null)
  const depthChangedRef = useRef(false)
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: builderKeyboardCoordinates })
  )

  const titleOf = (key: string) => {
    const r = rows.find((x) => x.key === key)
    return r ? (r.kind === 'section' ? r.section.title : r.content.title) : ''
  }
  const placeOf = (p: Placement) =>
    `« ${p.parentId === null ? ROOT_LABEL : (sections.find((s) => s.id === p.parentId)?.title ?? '')} », position ${p.position + 1}`

  const project = (key: string, overKey: string | null): Projection => {
    if (!overKey) return null
    return key.startsWith('s-')
      ? projectSectionDrop(dragRows, key, overKey, depthOffsetRef.current, sections)
      : projectContentDrop(dragRows, key, overKey)
  }

  const refresh = (key: string, overKey: string | null) => {
    const next = project(key, overKey)
    depthChangedRef.current = next?.depth !== projectionRef.current?.depth
    projectionRef.current = next
    if (key.startsWith('s-')) setProjectedDepth(next?.depth)
  }

  /** Index among the row's siblings, the same meaning as a Placement position. */
  const currentPlacement = (row: Row): Placement => ({
    parentId: row.parentId,
    position: rows
      .filter((r) => r.kind === row.kind && r.parentId === row.parentId)
      .findIndex((r) => r.key === row.key),
  })

  const endDrag = () => {
    clearTimeout(expandTimerRef.current)
    depthOffsetRef.current = 0
    setActiveKey(null)
    setProjectedDepth(undefined)
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    depthOffsetRef.current = 0
    projectionRef.current = null
    setActiveKey(String(active.id))
  }

  const onDragMove = ({ active, over, delta }: DragMoveEvent) => {
    depthOffsetRef.current = Math.round(delta.x / INDENT_PX)
    refresh(String(active.id), over ? String(over.id) : null)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    clearTimeout(expandTimerRef.current)
    const target = over ? rows.find((r) => r.key === over.id) : undefined
    // D-03: a collapsed section opens after a short hover so a content can land inside it.
    if (String(active.id).startsWith('c-') && target?.kind === 'section' && target.collapsed) {
      expandTimerRef.current = setTimeout(() => expand(target.id), 600)
    }
    refresh(String(active.id), over ? String(over.id) : null)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const key = String(active.id)
    const projection = project(key, over ? String(over.id) : null)
    projectionRef.current = projection
    endDrag()
    const row = rows.find((r) => r.key === key)
    if (!row || !projection) return
    const current = currentPlacement(row)
    if (current.parentId === projection.parentId && current.position === projection.position) return
    // Same save path as the menu; focus stays on the handle (dnd-kit restoreFocus).
    move(row, { parentId: projection.parentId, position: projection.position }, false)
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `« ${titleOf(String(active.id))} » saisi.`,
    onDragMove: () =>
      depthChangedRef.current
        ? projectionRef.current
          ? `Sera déposé dans ${placeOf(projectionRef.current)}.`
          : 'Emplacement impossible ici.'
        : undefined,
    // At pick-up `over` is the row itself: keep "saisi." audible instead of the unchanged slot.
    onDragOver: ({ active, over }) =>
      over?.id === active.id && depthOffsetRef.current === 0
        ? undefined
        : projectionRef.current
          ? `Sera déposé dans ${placeOf(projectionRef.current)}.`
          : 'Emplacement impossible ici.',
    onDragEnd: ({ active }) => {
      const key = String(active.id)
      if (projectionRef.current) {
        return `« ${titleOf(key)} » déposé dans ${placeOf(projectionRef.current)}.`
      }
      return key.startsWith('s-')
        ? 'Déplacement impossible : profondeur maximale de 2 niveaux.'
        : 'Déplacement impossible : un contenu doit rester dans une section.'
    },
    onDragCancel: ({ active }) =>
      `Déplacement annulé. « ${titleOf(String(active.id))} » est revenu à sa place.`,
  }

  function rowProps(row: Row): BuilderRowProps {
    const ref = refOf(row)
    const up = siblingPlacement(sections, contents, ref, 'up')
    const down = siblingPlacement(sections, contents, ref, 'down')
    const isEditing = editing?.key === row.key
    return {
      row,
      expanded: row.kind === 'section' ? expanded.has(row.id) : undefined,
      onToggleExpanded: () =>
        setExpanded((prev) => {
          const next = new Set(prev)
          if (next.has(row.id)) next.delete(row.id)
          else next.add(row.id)
          return next
        }),
      editing: isEditing,
      initialDraft: isEditing ? editing?.draft : undefined,
      titleError: isEditing ? (editing?.error ?? null) : null,
      onStartEdit: () => setEditing({ key: row.key }),
      onCancelEdit: () => setEditing(null),
      onSubmitTitle: (value) => rename(row, value),
      panelOpen: openPanels.has(row.key),
      onTogglePanel: () =>
        setOpenPanels((prev) => {
          const next = new Set(prev)
          if (next.has(row.key)) next.delete(row.key)
          else next.add(row.key)
          return next
        }),
      panelError: panelErrors[row.key] ?? null,
      onSavePanel: (patch) => saveDetails(row, patch),
      canMoveUp: up !== null,
      canMoveDown: down !== null,
      onMoveUp: () => up && move(row, up),
      onMoveDown: () => down && move(row, down),
      moveTargets: moveTargets(sections, contents, ref),
      onMoveTo: (parentId) => moveTo(row, parentId),
      canDelete: row.kind === 'content' || canDeleteSection(sections, contents, row.id),
      onDelete: () => remove(row, rows),
      onCloseFocusTarget: () => takeFocusTarget(),
      onAddContent: row.kind === 'section' ? () => handleCreateContent(row.id) : undefined,
      onAddSubSection: row.kind === 'section' ? () => handleCreateModule(row.id) : undefined,
      projectedDepth: row.key === activeKey ? projectedDepth : undefined,
    }
  }

  return (
    <>
      <Head title={`Éditeur - ${course.title}`} />

      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href={`/courses/${course.id}`}>
                <Button variant="ghost" size="sm">
                  ← Retour au cours
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold">{course.title}</h1>
            <p className="text-muted-foreground mt-2">Éditeur de contenu</p>
          </div>

          <div className="flex items-center gap-2">
            <div id="save-status">
              <SaveStatus state={queue} onRetry={queue.retry} onReload={reload} />
            </div>
            <Link href={`/courses/${course.id}/learn`}>
              <Button variant="outline">
                <Eye className="mr-2 h-4 w-4" />
                Aperçu
              </Button>
            </Link>
            <Button onClick={() => handleCreateModule()}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau module
            </Button>
          </div>
        </div>

        {sections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun contenu</h3>
              <p className="text-muted-foreground mb-4">
                Commencez par créer un module pour organiser votre contenu
              </p>
              <Button onClick={() => handleCreateModule()}>
                <Plus className="mr-2 h-4 w-4" />
                Créer le premier module
              </Button>
            </CardContent>
          </Card>
        ) : (
          <DndContext
            id="course-builder"
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            accessibility={{
              announcements,
              screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS },
            }}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={endDrag}
          >
            <SortableContext
              items={dragRows.map((r) => r.key)}
              strategy={verticalListSortingStrategy}
            >
              <ul aria-label="Plan du cours">
                {dragRows.map((row) => (
                  <BuilderRow key={row.key} {...rowProps(row)} />
                ))}
              </ul>
            </SortableContext>
            {mounted &&
              createPortal(
                <DragOverlay>
                  {activeRow && (
                    <div className="rounded-lg border bg-card p-3 font-medium shadow-lg">
                      {activeRow.kind === 'section'
                        ? activeRow.section.title
                        : activeRow.content.title}
                    </div>
                  )}
                </DragOverlay>,
                document.body
              )}
          </DndContext>
        )}
      </div>

      {/* Create Module Dialog */}
      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau module</DialogTitle>
            <DialogDescription>
              Créez un nouveau module pour organiser votre contenu de cours
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitModule}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={moduleForm.data.title}
                  onChange={(e) => moduleForm.setData('title', e.target.value)}
                  required
                />
                {moduleForm.errors.title && (
                  <p className="text-sm text-red-500">{moduleForm.errors.title}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={moduleForm.data.description}
                  onChange={(e) => moduleForm.setData('description', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isPublished"
                  checked={moduleForm.data.isPublished}
                  onCheckedChange={(checked) => moduleForm.setData('isPublished', checked)}
                />
                <Label htmlFor="isPublished">Publier immédiatement</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModuleDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={moduleForm.processing}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Content Dialog */}
      <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouveau contenu</DialogTitle>
            <DialogDescription>Ajoutez du contenu à votre module</DialogDescription>
          </DialogHeader>

          <form onSubmit={submitContent}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="contentType">Type de contenu *</Label>
                <Select
                  value={contentForm.data.contentType}
                  onValueChange={(value: ContentType) => contentForm.setData('contentType', value)}
                >
                  <SelectTrigger id="contentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page">Page de texte</SelectItem>
                    <SelectItem value="video">Vidéo</SelectItem>
                    <SelectItem value="file">Fichier</SelectItem>
                    <SelectItem value="link">Lien externe</SelectItem>
                    <SelectItem value="assignment">Devoir</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contentTitle">Titre *</Label>
                <Input
                  id="contentTitle"
                  value={contentForm.data.title}
                  onChange={(e) => contentForm.setData('title', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contentDescription">Description</Label>
                <Textarea
                  id="contentDescription"
                  value={contentForm.data.description}
                  onChange={(e) => contentForm.setData('description', e.target.value)}
                  rows={2}
                />
              </div>

              {contentForm.data.contentType === 'page' && (
                <div className="space-y-2">
                  <Label htmlFor="content">Contenu</Label>
                  <Textarea
                    id="content"
                    value={contentForm.data.content}
                    onChange={(e) => contentForm.setData('content', e.target.value)}
                    rows={6}
                    placeholder="Contenu HTML ou texte..."
                  />
                </div>
              )}

              {(contentForm.data.contentType === 'video' ||
                contentForm.data.contentType === 'link') && (
                <div className="space-y-2">
                  <Label htmlFor="externalUrl">URL *</Label>
                  <Input
                    id="externalUrl"
                    type="url"
                    value={contentForm.data.externalUrl}
                    onChange={(e) => contentForm.setData('externalUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="contentIsPublished"
                  checked={contentForm.data.isPublished}
                  onCheckedChange={(checked) => contentForm.setData('isPublished', checked)}
                />
                <Label htmlFor="contentIsPublished">Publier immédiatement</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsContentDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={contentForm.processing}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
