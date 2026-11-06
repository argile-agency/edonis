import { Head, Link, router } from '@inertiajs/react'
import { useRef, useState, type ComponentProps } from 'react'
import { AlertTriangle, ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import AppHeader from '~/components/layout/app-header'
import { MoveTargetList } from '~/components/builder/move-target-list'
import { dayCount, LearnerImpact } from '~/components/builder/learner-impact'
import { elements } from '~/components/builder/bulk-action-bar'
import { sendJson } from '~/lib/builder_save_queue'
import type { MoveTarget } from '~/lib/builder_tree'

type HeaderProps = ComponentProps<typeof AppHeader>

/** TRASH PAGE CONTRACT (05.2-08 / 05.2-09): props served by GET /courses/:id/trash. */
interface TrashListRow {
  kind: 'section' | 'content'
  id: number
  title: string
  type: string | null
  /** null: the item sat at the course root. */
  originalSection: { id: number; title: string } | null
  /** Content rows whose section is also in the trash (D-05). */
  sectionTrashed: { id: number; title: string } | null
  /** null: the user row is gone. */
  deletedBy: string | null
  deletedAt: string
  daysLeft: number
  batch: string
  descendantCount: number
  contentIds: number[]
}

interface Props {
  course: { id: number; title: string }
  rows: TrashListRow[]
  retentionDays: number
  moveTargets: MoveTarget[]
  permissions: { canPurge: boolean }
  auth: { user: HeaderProps['user'] }
  appSettings: HeaderProps['appSettings']
  menus: HeaderProps['menus']
}

const TYPE_LABELS: Record<string, string> = {
  page: 'Page',
  video: 'Vidéo',
  file: 'Fichier',
  link: 'Lien',
  assignment: 'Devoir',
  quiz: 'Quiz',
}

const typeLabel = (row: TrashListRow) =>
  row.kind === 'section' ? 'Section' : (TYPE_LABELS[row.type ?? ''] ?? row.type ?? '')

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const rowKey = (row: TrashListRow) => `${row.kind}-${row.id}`
const restoreId = (row: TrashListRow) => `trash-restore-${rowKey(row)}`

type DialogState =
  | { type: 'restore'; row: TrashListRow; index: number; step: 1 | 2 }
  | { type: 'delete'; row: TrashListRow; index: number }
  | { type: 'empty' }

function DaysLeftBadge({ daysLeft }: { daysLeft: number }) {
  // D-15: tint, border and icon carry the warning; the text stays text-foreground (contrast).
  if (daysLeft > 3) return <Badge variant="outline">Dans {dayCount(daysLeft)}</Badge>
  return (
    <Badge
      variant="outline"
      className="bg-warning/10 border-warning"
      icon={<AlertTriangle className="h-3 w-3" aria-hidden="true" />}
    >
      {daysLeft <= 0 ? "Aujourd'hui" : `Dans ${dayCount(daysLeft)}`}
    </Badge>
  )
}

export default function CourseTrash({
  course,
  rows,
  retentionDays,
  moveTargets,
  permissions,
  auth,
  appSettings,
  menus,
}: Props) {
  const { canPurge } = permissions
  // The last opened dialog's data stays put while `open` is false, so the exit animation keeps its text.
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [open, setOpen] = useState(false)
  const openDialog = (d: DialogState) => {
    submitted.current = false
    setDialog(d)
    setOpen(true)
  }
  // One page-level flag (T-05.2-35): the key of the clicked button, null when idle.
  const [busy, setBusy] = useState<string | null>(null)
  const processing = busy !== null
  // A confirmed dialog hands focus to the post-visit rule instead of its trigger.
  const submitted = useRef(false)

  // Focus after rows disappear: the same row if it stayed (error flash), else the next
  // surviving row's « Restaurer », else the previous one, else the heading.
  function focusAfter(index: number, before: TrashListRow[]) {
    // Two frames: onSuccess fires before React commits the new rows.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const find = (r: TrashListRow | undefined) =>
          r ? document.getElementById(restoreId(r)) : null
        for (let i = index; i < before.length; i++) {
          const el = find(before[i])
          if (el) return el.focus()
        }
        for (let i = index - 1; i >= 0; i--) {
          const el = find(before[i])
          if (el) return el.focus()
        }
        document.getElementById('trash-heading')?.focus()
      })
    )
  }

  function post(
    path: string,
    data: Record<string, string | number | boolean | null>,
    busyKey: string,
    index: number
  ) {
    const before = rows
    router.post(`/courses/${course.id}/trash/${path}`, data, {
      preserveScroll: true,
      onStart: () => setBusy(busyKey),
      onFinish: () => setBusy(null),
      onSuccess: () => focusAfter(index, before),
    })
  }

  function restore(row: TrashListRow, index: number) {
    if (row.sectionTrashed) {
      openDialog({ type: 'restore', row, index, step: 1 })
      return
    }
    post('restore', { kind: row.kind, id: row.id }, restoreId(row), index)
  }

  const learnerImpact = (contentIds: number[]) =>
    sendJson<{ learners: number }>('POST', `/courses/${course.id}/builder/delete-impact`, {
      contentIds,
    }).then((r) => r.learners)

  const closeAutoFocus = (e: Event) => {
    // Consumed here whichever ends first, the exit animation or the visit.
    if (submitted.current) e.preventDefault()
    submitted.current = false
  }
  const submitConfirmed = () => {
    submitted.current = true
    setOpen(false)
  }

  const allContentIds = rows.flatMap((r) => r.contentIds)
  const restoreDialog = dialog?.type === 'restore' ? dialog : null
  const deleteDialog = dialog?.type === 'delete' ? dialog : null

  return (
    <>
      <Head title={`Corbeille - ${course.title}`} />

      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <main id="main-content" className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
          <div>
            <Link href={`/courses/${course.id}/builder`}>
              <Button variant="ghost" size="sm" className="mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                Retour à l'éditeur
              </Button>
            </Link>
            <h1 id="trash-heading" tabIndex={-1} className="text-3xl font-bold outline-none">
              Corbeille
            </h1>
            <p className="text-muted-foreground mt-2">{course.title}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les éléments sont supprimés définitivement {dayCount(retentionDays)} après leur mise à
              la corbeille.
            </p>
          </div>
          {canPurge && rows.length > 0 && (
            <Button
              variant="outline"
              disabled={processing}
              aria-busy={busy === 'empty' ? 'true' : undefined}
              onClick={() => openDialog({ type: 'empty' })}
            >
              <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
              Vider la corbeille
            </Button>
          )}
        </div>

        {!canPurge && rows.length > 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            Seuls le propriétaire du cours et les administrateurs peuvent supprimer définitivement
            des éléments.
          </p>
        )}

        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
              <h2 className="text-lg font-semibold mb-2">La corbeille est vide</h2>
              <p className="text-muted-foreground mb-4">
                Les sections et contenus supprimés dans l'éditeur apparaissent ici pendant{' '}
                {dayCount(retentionDays)}. Vous pouvez les restaurer à leur place d'origine.
              </p>
              <Link href={`/courses/${course.id}/builder`}>
                <Button variant="outline">Retour à l'éditeur</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption className="sr-only">
                    Éléments de la corbeille, du plus récent au plus ancien
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Élément</TableHead>
                      <TableHead className="hidden md:table-cell">Type</TableHead>
                      <TableHead className="hidden lg:table-cell">Section d'origine</TableHead>
                      <TableHead className="hidden lg:table-cell">Supprimé par</TableHead>
                      <TableHead className="hidden sm:table-cell">Supprimé le</TableHead>
                      <TableHead>Suppression définitive</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => {
                      const date = formatDate(row.deletedAt)
                      const deleteKey = `trash-delete-${rowKey(row)}`
                      return (
                        <TableRow key={rowKey(row)}>
                          <TableCell>
                            <p className="font-medium">{row.title}</p>
                            {row.kind === 'section' && row.descendantCount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                avec {elements(row.descendantCount)}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {typeLabel(row)} · {date}
                            </p>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {typeLabel(row)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {row.sectionTrashed ? (
                              <>
                                « {row.sectionTrashed.title} »{' '}
                                <span className="text-muted-foreground">(dans la corbeille)</span>
                              </>
                            ) : (
                              (row.originalSection?.title ?? 'Racine du cours')
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {row.deletedBy ?? 'Utilisateur supprimé'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                            <time dateTime={row.deletedAt}>{date}</time>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <DaysLeftBadge daysLeft={row.daysLeft} />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <Button
                                id={restoreId(row)}
                                variant="outline"
                                size="sm"
                                disabled={processing}
                                aria-busy={busy === restoreId(row) ? 'true' : undefined}
                                aria-label={`Restaurer « ${row.title} »`}
                                onClick={() => restore(row, index)}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                                Restaurer
                              </Button>
                              {canPurge && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={processing}
                                  aria-busy={busy === deleteKey ? 'true' : undefined}
                                  aria-label={`Supprimer définitivement « ${row.title} »`}
                                  onClick={() => openDialog({ type: 'delete', row, index })}
                                >
                                  Supprimer définitivement
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* R1 — D-05: the content's section is in the trash too. */}
      <Dialog open={open && restoreDialog !== null} onOpenChange={setOpen}>
        {restoreDialog && restoreDialog.row.sectionTrashed && (
          <DialogContent onCloseAutoFocus={closeAutoFocus}>
            <DialogHeader>
              <DialogTitle>Restaurer « {restoreDialog.row.title} »</DialogTitle>
              <DialogDescription>
                {restoreDialog.step === 1
                  ? `Sa section « ${restoreDialog.row.sectionTrashed.title} » est aussi dans la corbeille.`
                  : 'Choisissez la section de destination. Le contenu sera placé à la fin.'}
              </DialogDescription>
            </DialogHeader>
            {restoreDialog.step === 1 ? (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    const { row, index } = restoreDialog
                    submitConfirmed()
                    post(
                      'restore',
                      { kind: row.kind, id: row.id, withSection: true },
                      restoreId(row),
                      index
                    )
                  }}
                >
                  Restaurer aussi la section « {restoreDialog.row.sectionTrashed.title} »
                </Button>
                <Button
                  id="trash-restore-other"
                  variant="outline"
                  onClick={() => {
                    setDialog({ ...restoreDialog, step: 2 })
                    requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLButtonElement>(`#trash-restore-targets button`)
                        ?.focus()
                    )
                  }}
                >
                  Restaurer dans une autre section…
                </Button>
              </div>
            ) : (
              <div id="trash-restore-targets" className="space-y-2">
                <MoveTargetList
                  idBase={`trash-${restoreDialog.row.id}`}
                  targets={moveTargets}
                  onChoose={(moduleId) => {
                    const { row, index } = restoreDialog
                    submitConfirmed()
                    post('restore', { kind: row.kind, id: row.id, moduleId }, restoreId(row), index)
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDialog({ ...restoreDialog, step: 1 })
                    requestAnimationFrame(() =>
                      document.getElementById('trash-restore-other')?.focus()
                    )
                  }}
                >
                  Retour aux options
                </Button>
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* P1 — permanent delete of one row. */}
      <AlertDialog open={open && deleteDialog !== null} onOpenChange={setOpen}>
        {deleteDialog && (
          <AlertDialogContent onCloseAutoFocus={closeAutoFocus}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Supprimer définitivement « {deleteDialog.row.title} »
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteDialog.row.kind === 'section'
                  ? 'Cette section sera supprimée définitivement avec ses sous-sections et contenus, y compris ceux mis à la corbeille séparément. Cette action est irréversible.'
                  : 'Ce contenu sera supprimé définitivement. Cette action est irréversible.'}
              </AlertDialogDescription>
              {deleteDialog.row.contentIds.length > 0 && (
                <LearnerImpact
                  open={open}
                  variant="permanent"
                  load={() => learnerImpact(deleteDialog.row.contentIds)}
                  subject={deleteDialog.row.kind === 'section' ? 'cette section' : 'ce contenu'}
                />
              )}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  const { row, index } = deleteDialog
                  submitConfirmed()
                  post(
                    'delete',
                    { kind: row.kind, id: row.id },
                    `trash-delete-${rowKey(row)}`,
                    index
                  )
                }}
              >
                Supprimer définitivement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {/* P2 — empty the trash. */}
      <AlertDialog open={open && dialog?.type === 'empty'} onOpenChange={setOpen}>
        <AlertDialogContent onCloseAutoFocus={closeAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>Vider la corbeille</AlertDialogTitle>
            <AlertDialogDescription>
              Les {elements(rows.length)} de la corbeille seront supprimés définitivement, avec
              leurs sous-sections et contenus. Cette action est irréversible.
            </AlertDialogDescription>
            {allContentIds.length > 0 && (
              <LearnerImpact
                open={open && dialog?.type === 'empty'}
                variant="permanent"
                load={() => learnerImpact(allContentIds)}
                subject="les éléments de la corbeille"
              />
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                submitConfirmed()
                post('empty', {}, 'empty', 0)
              }}
            >
              Vider la corbeille
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
