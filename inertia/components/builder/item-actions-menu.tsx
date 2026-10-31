import { useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { Button } from '~/components/ui/button'
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
import { NOT_EMPTY_MESSAGE, type MoveTarget } from '~/lib/builder_tree'

export interface ItemActionsMenuProps {
  idBase: string
  kind: 'section' | 'content'
  title: string
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp(): void
  onMoveDown(): void
  moveTargets: MoveTarget[]
  onMoveTo(parentId: number | null): void
  canDelete: boolean
  onDelete(): void
  onCloseFocusTarget?: () => HTMLElement | null
}

/**
 * Per-item actions (D-05, D-07): the single-pointer alternative to dragging
 * (WCAG 2.5.7) and the confirmed delete. The dialogs are siblings of the menu,
 * opened through controlled state, so closing the menu does not unmount them.
 */
export function ItemActionsMenu({
  idBase,
  kind,
  title,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  moveTargets,
  onMoveTo,
  canDelete,
  onDelete,
  onCloseFocusTarget,
}: ItemActionsMenuProps) {
  const [moveOpen, setMoveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // True while the menu closes to open a dialog: the dialog takes focus, not the trigger.
  const openingDialog = useRef(false)

  const triggerRef = useRef<HTMLButtonElement>(null)

  // The page's target wins (the trigger may be gone after a delete); else back to the
  // trigger, since a dialog opened from the menu would otherwise restore to <body>.
  const restoreFocus = (e: Event) => {
    const target =
      onCloseFocusTarget?.() ?? (triggerRef.current?.isConnected ? triggerRef.current : null)
    if (target) {
      e.preventDefault()
      target.focus()
    }
  }

  const deleteReasonId = `${idBase}-delete-reason`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions pour « ${title} »`}
            id={`${idBase}-actions`}
          >
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(e) => {
            if (openingDialog.current) {
              openingDialog.current = false
              e.preventDefault()
              return
            }
            restoreFocus(e)
          }}
        >
          <DropdownMenuItem disabled={!canMoveUp} onSelect={onMoveUp}>
            Monter
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canMoveDown} onSelect={onMoveDown}>
            Descendre
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              openingDialog.current = true
              setMoveOpen(true)
            }}
          >
            Déplacer vers…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {canDelete ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => {
                openingDialog.current = true
                setDeleteOpen(true)
              }}
            >
              Supprimer
            </DropdownMenuItem>
          ) : (
            // Not Radix `disabled`: it stays focusable so the reason is discoverable (D-05).
            <DropdownMenuItem
              aria-disabled="true"
              aria-describedby={deleteReasonId}
              onSelect={(e) => e.preventDefault()}
              className="flex-col items-start gap-0 opacity-60"
            >
              <span>Supprimer</span>
              <span id={deleteReasonId} className="text-xs text-muted-foreground">
                {NOT_EMPTY_MESSAGE}
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>Déplacer « {title} »</DialogTitle>
            <DialogDescription>
              Choisissez la section de destination. L'élément sera placé à la fin.
            </DialogDescription>
          </DialogHeader>
          {moveTargets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune destination disponible.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {moveTargets.map((target) => {
                const reasonId = `${idBase}-target-${target.parentId ?? 'root'}-reason`
                const disabled = target.disabledReason !== null
                return (
                  <li key={target.parentId ?? 'root'}>
                    <button
                      type="button"
                      aria-disabled={disabled ? 'true' : undefined}
                      aria-describedby={disabled ? reasonId : undefined}
                      onClick={() => {
                        if (disabled) return
                        onMoveTo(target.parentId)
                        setMoveOpen(false)
                      }}
                      style={{ paddingLeft: `${0.75 + target.depth * 1.25}rem` }}
                      className={
                        disabled
                          ? 'flex w-full cursor-not-allowed flex-col items-start rounded-md py-2 pr-3 text-left text-sm text-muted-foreground'
                          : 'flex w-full flex-col items-start rounded-md py-2 pr-3 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      }
                    >
                      <span>{target.label}</span>
                      {disabled && (
                        <span id={reasonId} className="text-xs">
                          {target.disabledReason}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onCloseAutoFocus={restoreFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {kind === 'section' ? 'Supprimer la section' : 'Supprimer le contenu'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {kind === 'section'
                ? `Supprimer la section « ${title} » ? Cette action est irréversible.`
                : `Supprimer « ${title} » ? La progression des apprenants sur ce contenu sera aussi supprimée. Cette action est irréversible.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
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
