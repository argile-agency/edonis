export type SaveErrorKind = 'conflict' | 'validation' | 'session' | 'forbidden' | 'error'

export interface SaveError {
  kind: SaveErrorKind
  status: number | null
  message: string
  body: unknown
}

export interface SaveOp {
  label: string
  apply(): void
  run(): Promise<void>
  rollback(error: SaveError): void
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface SaveQueueState {
  status: SaveStatus
  error: SaveError | null
  pending: number
  failedCount: number
}

const CANCELLED: SaveError = {
  kind: 'error',
  status: null,
  message: 'Annulé après une erreur',
  body: null,
}

function toSaveError(e: unknown): SaveError {
  if (e && typeof e === 'object' && 'kind' in e && 'message' in e) return e as SaveError
  // Fixed text: a thrown Error may carry internals that must not reach the UI.
  return { kind: 'error', status: null, message: 'Erreur inattendue.', body: null }
}

/**
 * Serial save queue: ops apply optimistically at enqueue time and run one at a
 * time in order. A failure stops the queue, rolls back the failed op and every
 * op queued after it (newest first) and keeps them, in order, for retry().
 */
export function createSaveQueue(onChange: (state: SaveQueueState) => void) {
  let queue: SaveOp[] = [] // queue[0] is running while `running` is true
  let failed: SaveOp[] = []
  let error: SaveError | null = null
  let settled: 'idle' | 'saved' = 'idle'
  let running = false
  let state: SaveQueueState = { status: 'idle', error: null, pending: 0, failedCount: 0 }

  function emit() {
    // The error stays visible until retry() or dismiss(), even while later ops save.
    const status = error ? 'error' : queue.length > 0 ? 'saving' : settled
    state = { status, error, pending: queue.length, failedCount: failed.length }
    onChange(state)
  }

  async function drain() {
    running = true
    while (queue.length > 0) {
      const op = queue[0]
      try {
        await op.run()
        queue.shift()
        settled = 'saved'
      } catch (e) {
        error = toSaveError(e)
        const stopped = queue
        queue = []
        for (const o of [...stopped].reverse()) {
          try {
            o.rollback(o === op ? error : CANCELLED)
          } catch {
            // One broken rollback must not skip the others.
          }
        }
        failed.push(...stopped)
      }
      emit()
    }
    running = false
  }

  function enqueue(op: SaveOp) {
    op.apply()
    queue.push(op)
    emit()
    if (!running) void drain()
  }

  return {
    enqueue,
    retry() {
      const ops = failed
      failed = []
      error = null
      if (ops.length === 0) emit()
      ops.forEach(enqueue)
    },
    dismiss() {
      failed = []
      error = null
      settled = 'idle'
      emit()
    },
    getState: () => state,
  }
}
