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
import type { MoveTarget } from '~/lib/builder_tree'
import { MoveTargetList } from '~/components/builder/move-target-list'
import { dayCount, LearnerImpact } from '~/components/builder/learner-impact'

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
  /** Sections: whether sub-sections or contents go to the trash with it (dialog wording). */
  hasDescendants?: boolean
  retentionDays: number
  onDelete(): void
  /** Learners with progress on the deleted contents; absent when no content is deleted. */
  loadLearnerImpact?: () => Promise<number>
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
  hasDescendants = false,
  retentionDays,
  onDelete,
  loadLearnerImpact,
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
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => {
              openingDialog.current = true
              setDeleteOpen(true)
            }}
          >
            Supprimer
          </DropdownMenuItem>
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
          <MoveTargetList
            idBase={idBase}
            targets={moveTargets}
            onChoose={(parentId) => {
              onMoveTo(parentId)
              setMoveOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onCloseAutoFocus={restoreFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {kind === 'section' ? 'Supprimer la section' : 'Supprimer le contenu'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {kind === 'content'
                ? `« ${title} » sera déplacé dans la corbeille et supprimé définitivement dans ${dayCount(retentionDays)}.`
                : hasDescendants
                  ? `La section « ${title} » sera déplacée dans la corbeille avec ses sous-sections et contenus, et supprimée définitivement dans ${dayCount(retentionDays)}.`
                  : `La section « ${title} » sera déplacée dans la corbeille et supprimée définitivement dans ${dayCount(retentionDays)}.`}
            </AlertDialogDescription>
            {loadLearnerImpact && (
              <LearnerImpact
                open={deleteOpen}
                load={loadLearnerImpact}
                subject={kind === 'section' ? 'cette section' : 'ce contenu'}
                retentionDays={retentionDays}
              />
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {kind === 'section' ? 'Supprimer la section' : 'Supprimer le contenu'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
