import { RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import type { SaveQueueState } from '~/lib/save_queue'

const LABELS: Record<SaveQueueState['status'], string> = {
  idle: '',
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  error: '',
}

/**
 * Visible autosave indicator. The live region holds text only; the action
 * buttons sit outside it so they are not re-announced on every change.
 */
export function SaveStatus({
  state,
  onRetry,
  onReload,
}: {
  state: SaveQueueState
  onRetry(): void
  onReload(): void
}) {
  const isError = state.status === 'error'
  const text = isError ? `Erreur : ${state.error?.message ?? ''}` : LABELS[state.status]
  const canReload = state.error?.kind === 'conflict' || state.error?.kind === 'session'

  return (
    <div className="flex items-center gap-2">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn('min-h-5 text-sm', isError ? 'text-destructive' : 'text-muted-foreground')}
      >
        {text}
      </div>
      {isError && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRetry}
            leftIcon={<RotateCcw aria-hidden="true" />}
          >
            Réessayer
          </Button>
          {canReload && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onReload}
              leftIcon={<RefreshCw aria-hidden="true" />}
            >
              Recharger
            </Button>
          )}
        </>
      )}
    </div>
  )
}
