import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Dialog,
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
import { MoveTargetList } from '~/components/builder/move-target-list'
import {
  BULK_DELETE_BLOCKED_MESSAGE,
  type ContentType,
  type MoveTarget,
  type QuickSelection,
} from '~/lib/builder_tree'

/** The master checkbox: focus lands here when the bar disappears (delete, "Désélectionner"). */
export const SELECT_ALL_ID = 'bulk-select-all'

const TYPE_LABELS: [ContentType, string][] = [
  ['page', 'Pages'],
  ['video', 'Vidéos'],
  ['file', 'Fichiers'],
  ['link', 'Liens'],
  ['assignment', 'Devoirs'],
  ['quiz', 'Quiz'],
]

const elements = (n: number) => `${n} élément${n > 1 ? 's' : ''}`

function countText(n: number) {
  if (n === 0) return 'Aucun élément sélectionné'
  return `${elements(n)} sélectionné${n > 1 ? 's' : ''}`
}

const focusSelectAll = () => document.getElementById(SELECT_ALL_ID)?.focus()

export function SelectionControls({
  total,
  selectedCount,
  onSelectAll,
  onClear,
  onQuickSelect,
}: {
  total: number
  selectedCount: number
  onSelectAll(): void
  onClear(): void
  onQuickSelect(q: QuickSelection): void
}) {
  const state = selectedCount === 0 ? false : selectedCount >= total ? true : 'indeterminate'
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id={SELECT_ALL_ID}
          checked={state}
          onCheckedChange={() => (state === true ? onClear() : onSelectAll())}
        />
        <Label htmlFor={SELECT_ALL_ID}>Tout sélectionner</Label>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Sélection rapide
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onSelectAll}>Tout sélectionner</DropdownMenuItem>
          <DropdownMenuItem onSelect={onClear}>Tout désélectionner</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onQuickSelect('published')}>
            Éléments publiés
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onQuickSelect('unpublished')}>
            Éléments non publiés
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {TYPE_LABELS.map(([contentType, label]) => (
            <DropdownMenuItem key={contentType} onSelect={() => onQuickSelect({ contentType })}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* No status role: the save indicator is the page's only status region. */}
      <p
        id="builder-selection-count"
        aria-live="polite"
        aria-atomic="true"
        className="text-sm text-muted-foreground"
      >
        {countText(selectedCount)}
      </p>
    </div>
  )
}

type Availability = { availableFrom: string | null; availableUntil: string | null }
type Shift = { days: number } | { from: string; to: string }
type Open = 'availability' | 'shift' | 'move' | 'delete' | null

const SHIFT_HELP =
  'Toutes les dates des éléments sélectionnés (disponibilité et échéance) bougent du même nombre de jours : les écarts sont conservés et les dates vides restent vides.'

export function BulkActionBar({
  count,
  deleteBlocked,
  moveTargets,
  onPublish,
  onUnpublish,
  onAvailability,
  onShift,
  onMove,
  onDuplicate,
  onDelete,
  onClear,
}: {
  count: number
  deleteBlocked: boolean
  moveTargets: MoveTarget[]
  onPublish(): void
  onUnpublish(): void
  onAvailability(v: Availability): void
  onShift(v: Shift): void
  onMove(parentId: number | null): void
  onDuplicate(): void
  onDelete(): void
  onClear(): void
}) {
  const [open, setOpen] = useState<Open>(null)
  const [from, setFrom] = useState('')
  const [until, setUntil] = useState('')
  const [mode, setMode] = useState<'days' | 'anchor'>('days')
  const [days, setDays] = useState('')
  const [anchorFrom, setAnchorFrom] = useState('')
  const [anchorTo, setAnchorTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const deleted = useRef(false)

  const show = (dialog: Open) => {
    setError(null)
    setOpen(dialog)
  }
  const onOpenChange = (value: boolean) => {
    if (!value) setOpen(null)
  }

  const applyAvailability = (e: React.FormEvent) => {
    e.preventDefault()
    // <input type="date"> yields YYYY-MM-DD, the format the server accepts; compared as strings.
    if (from && until && until < from) {
      setError('La date de fin doit être postérieure à la date de début.')
      return
    }
    onAvailability({ availableFrom: from || null, availableUntil: until || null })
    setOpen(null)
  }

  const applyShift = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'days') {
      const n = Number(days)
      if (days.trim() === '' || !Number.isInteger(n) || n === 0 || Math.abs(n) > 3650) {
        setError('Indiquez un nombre entier de jours, différent de 0 (au plus 3650).')
        return
      }
      onShift({ days: n })
    } else {
      if (!anchorFrom || !anchorTo || anchorFrom === anchorTo) {
        setError('Indiquez les deux dates de début, différentes l’une de l’autre.')
        return
      }
      onShift({ from: anchorFrom, to: anchorTo })
    }
    setOpen(null)
  }

  const errorProps = (id: string) =>
    error ? { 'aria-invalid': true, 'aria-describedby': id } : {}

  return (
    <>
      <div
        role="group"
        aria-label="Actions sur la sélection"
        className="mb-3 flex flex-wrap items-start gap-2 rounded-lg border bg-muted/40 p-2"
      >
        <Button size="sm" onClick={onPublish}>
          Publier
        </Button>
        <Button size="sm" variant="outline" onClick={onUnpublish}>
          Dépublier
        </Button>
        <Button size="sm" variant="outline" onClick={() => show('availability')}>
          Disponibilité…
        </Button>
        <Button size="sm" variant="outline" onClick={() => show('shift')}>
          Décaler les dates…
        </Button>
        <Button size="sm" variant="outline" onClick={() => show('move')}>
          Déplacer vers…
        </Button>
        <Button size="sm" variant="outline" onClick={onDuplicate}>
          Dupliquer
        </Button>
        {deleteBlocked ? (
          // Not `disabled`: it stays focusable so the reason is discoverable (D-05).
          <div className="flex flex-col">
            <Button
              size="sm"
              variant="outline"
              aria-disabled="true"
              aria-describedby="bulk-delete-reason"
              className="cursor-not-allowed opacity-60"
              onClick={(e) => e.preventDefault()}
            >
              Supprimer…
            </Button>
            <span id="bulk-delete-reason" className="mt-1 text-xs text-muted-foreground">
              {BULK_DELETE_BLOCKED_MESSAGE}
            </span>
          </div>
        ) : (
          // No red text here: the destructive colour fails AA contrast at this size; the dialog warns.
          <Button size="sm" variant="outline" onClick={() => show('delete')}>
            Supprimer…
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onClear()
            focusSelectAll()
          }}
        >
          Désélectionner
        </Button>
      </div>

      <Dialog open={open === 'availability'} onOpenChange={onOpenChange}>
        <DialogContent>
          <form onSubmit={applyAvailability} noValidate>
            <DialogHeader>
              <DialogTitle>Disponibilité des éléments sélectionnés</DialogTitle>
              <DialogDescription>Laissez une date vide pour ne pas la limiter.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-available-from">Disponible à partir du</Label>
                <Input
                  id="bulk-available-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-available-until">Disponible jusqu'au</Label>
                <Input
                  id="bulk-available-until"
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  {...errorProps('bulk-availability-error')}
                />
              </div>
              {error && (
                <p id="bulk-availability-error" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(null)}>
                Annuler
              </Button>
              <Button type="submit">Appliquer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'shift'} onOpenChange={onOpenChange}>
        <DialogContent>
          <form onSubmit={applyShift} noValidate>
            <DialogHeader>
              <DialogTitle>Décaler les dates</DialogTitle>
              <DialogDescription id="bulk-shift-help">{SHIFT_HELP}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Mode de décalage</legend>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="bulk-shift-mode-days"
                    name="bulk-shift-mode"
                    checked={mode === 'days'}
                    onChange={() => {
                      setMode('days')
                      setError(null)
                    }}
                  />
                  <Label htmlFor="bulk-shift-mode-days">D'un nombre de jours</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="bulk-shift-mode-anchor"
                    name="bulk-shift-mode"
                    checked={mode === 'anchor'}
                    onChange={() => {
                      setMode('anchor')
                      setError(null)
                    }}
                  />
                  <Label htmlFor="bulk-shift-mode-anchor">
                    D'une ancienne date de début à une nouvelle
                  </Label>
                </div>
              </fieldset>
              {mode === 'days' ? (
                <div className="space-y-2">
                  <Label htmlFor="bulk-shift-days">Nombre de jours (négatif pour avancer)</Label>
                  <Input
                    id="bulk-shift-days"
                    type="number"
                    step={1}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    {...errorProps('bulk-shift-error')}
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-shift-from">Ancienne date de début</Label>
                    <Input
                      id="bulk-shift-from"
                      type="date"
                      value={anchorFrom}
                      onChange={(e) => setAnchorFrom(e.target.value)}
                      {...errorProps('bulk-shift-error')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-shift-to">Nouvelle date de début</Label>
                    <Input
                      id="bulk-shift-to"
                      type="date"
                      value={anchorTo}
                      onChange={(e) => setAnchorTo(e.target.value)}
                      {...errorProps('bulk-shift-error')}
                    />
                  </div>
                </>
              )}
              {error && (
                <p id="bulk-shift-error" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(null)}>
                Annuler
              </Button>
              <Button type="submit">Appliquer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'move'} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déplacer {elements(count)}</DialogTitle>
            <DialogDescription>
              Choisissez la destination. Les éléments seront placés à la fin, dans l'ordre du
              plan.
            </DialogDescription>
          </DialogHeader>
          <MoveTargetList
            idBase="bulk"
            targets={moveTargets}
            onChoose={(parentId) => {
              onMove(parentId)
              setOpen(null)
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={open === 'delete'} onOpenChange={onOpenChange}>
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            // The deleted rows leave the selection, so the bar and its trigger unmount.
            if (!deleted.current) return
            deleted.current = false
            e.preventDefault()
            focusSelectAll()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {elements(count)}</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer les éléments sélectionnés ? Une section supprimée emporte son contenu, qui
              est sélectionné lui aussi. La progression des apprenants sur les contenus supprimés
              sera aussi supprimée. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleted.current = true
                onDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
