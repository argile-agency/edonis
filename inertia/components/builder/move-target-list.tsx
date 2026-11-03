import type { MoveTarget } from '~/lib/builder_tree'

/**
 * Destination list shared by the per-item and the bulk "Déplacer vers…" dialogs.
 * A disabled target stays focusable with its visible reason (D-05), and does nothing.
 */
export function MoveTargetList({
  idBase,
  targets,
  onChoose,
}: {
  idBase: string
  targets: MoveTarget[]
  onChoose(parentId: number | null): void
}) {
  if (targets.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune destination disponible.</p>
  }
  return (
    <ul className="max-h-80 space-y-1 overflow-y-auto">
      {targets.map((target) => {
        const reasonId = `${idBase}-target-${target.parentId ?? 'root'}-reason`
        const disabled = target.disabledReason !== null
        return (
          <li key={target.parentId ?? 'root'}>
            <button
              type="button"
              aria-disabled={disabled ? 'true' : undefined}
              aria-describedby={disabled ? reasonId : undefined}
              onClick={() => {
                if (!disabled) onChoose(target.parentId)
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
  )
}
