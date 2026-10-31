import { test } from '@japa/runner'
import {
  createSaveQueue,
  type SaveError,
  type SaveOp,
  type SaveQueueState,
} from '../../inertia/lib/save_queue.js'

/**
 * Fake ops: each run() returns a promise the test settles by hand, and every
 * apply/run/rollback call is written to a shared log.
 */
function harness() {
  const log: string[] = []
  const states: SaveQueueState[] = []
  const errors: Record<string, SaveError> = {}
  const pending: Record<string, { resolve(): void; reject(e: unknown): void }> = {}
  const queue = createSaveQueue((s) => states.push(s))

  function op(label: string): SaveOp {
    return {
      label,
      apply: () => log.push(`apply ${label}`),
      run: () =>
        new Promise<void>((resolve, reject) => {
          log.push(`run ${label}`)
          pending[label] = { resolve, reject }
        }),
      rollback: (error) => {
        log.push(`rollback ${label}`)
        errors[label] = error
      },
    }
  }

  return { log, states, errors, pending, queue, op }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

test.group('Save queue', () => {
  test('applies at once and runs ops one at a time in order', async ({ assert }) => {
    const h = harness()
    h.queue.enqueue(h.op('A'))
    h.queue.enqueue(h.op('B'))
    await flush()
    assert.sameMembers(h.log, ['apply A', 'apply B', 'run A'])

    h.pending.A.resolve()
    await flush()
    assert.sameMembers(h.log, ['apply A', 'apply B', 'run A', 'run B'])

    h.pending.B.resolve()
    await flush()
    assert.deepInclude(h.queue.getState(), { status: 'saved', pending: 0 })
  })

  test('reports saving before saved', async ({ assert }) => {
    const h = harness()
    h.queue.enqueue(h.op('A'))
    await flush()
    h.pending.A.resolve()
    await flush()
    const seen = h.states.map((s) => s.status)
    assert.isAbove(seen.lastIndexOf('saved'), seen.indexOf('saving'))
    assert.isAtLeast(seen.indexOf('saving'), 0)
  })

  test('a failure cancels later ops and rolls back in reverse order', async ({ assert }) => {
    const h = harness()
    const conflict: SaveError = { kind: 'conflict', status: 409, message: 'x', body: {} }
    h.queue.enqueue(h.op('A'))
    h.queue.enqueue(h.op('B'))
    h.queue.enqueue(h.op('C'))
    await flush()
    h.pending.A.resolve()
    await flush()
    h.pending.B.reject(conflict)
    await flush()

    assert.notInclude(h.log, 'run C')
    assert.notInclude(h.log, 'rollback A')
    const rollbacks = h.log.filter((l) => l.startsWith('rollback'))
    assert.deepEqual(rollbacks, ['rollback C', 'rollback B'])
    assert.equal(h.errors.B, conflict)
    assert.equal(h.errors.C.kind, 'error')
    assert.deepInclude(h.queue.getState(), { status: 'error', failedCount: 2 })
  })

  test('retry re-applies and replays the failed ops in order', async ({ assert }) => {
    const h = harness()
    h.queue.enqueue(h.op('B'))
    h.queue.enqueue(h.op('C'))
    await flush()
    h.pending.B.reject({ kind: 'conflict', status: 409, message: 'x', body: {} })
    await flush()

    h.log.length = 0
    h.queue.retry()
    await flush()
    assert.sameMembers(h.log, ['apply B', 'apply C', 'run B'])
    h.pending.B.resolve()
    await flush()
    h.pending.C.resolve()
    await flush()
    assert.sameMembers(h.log, ['apply B', 'apply C', 'run B', 'run C'])
    assert.isBelow(h.log.indexOf('apply B'), h.log.indexOf('apply C'))
    assert.isBelow(h.log.indexOf('run B'), h.log.indexOf('run C'))
    assert.deepInclude(h.queue.getState(), { status: 'saved', failedCount: 0, error: null })
  })

  test('dismiss clears the error and the retry list', async ({ assert }) => {
    const h = harness()
    h.queue.enqueue(h.op('A'))
    await flush()
    h.pending.A.reject({ kind: 'session', status: null, message: 'x', body: null })
    await flush()

    h.queue.dismiss()
    assert.deepInclude(h.queue.getState(), { status: 'idle', failedCount: 0, error: null })
    h.queue.retry()
    await flush()
    assert.notInclude(h.log.slice(2), 'apply A')
  })

  test('a non-SaveError rejection is normalised to kind error', async ({ assert }) => {
    const h = harness()
    h.queue.enqueue(h.op('A'))
    await flush()
    h.pending.A.reject(new Error('boom'))
    await flush()
    assert.equal(h.errors.A.kind, 'error')
    assert.equal(h.queue.getState().error?.kind, 'error')
  })
})
