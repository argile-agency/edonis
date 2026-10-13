import { test } from '@japa/runner'
import {
  createPending,
  readPending,
  recordFailedAttempt,
  TWO_FACTOR_MAX_ATTEMPTS,
  TWO_FACTOR_PENDING_TTL_MS,
} from '../../app/helpers/two_factor_pending.js'

const TTL = TWO_FACTOR_PENDING_TTL_MS
const now = 1_700_000_000_000

test.group('Two-factor pending state', () => {
  test('locks the TTL to 10 minutes and the attempts cap to 5', ({ assert }) => {
    assert.equal(TWO_FACTOR_PENDING_TTL_MS, 600000)
    assert.equal(TWO_FACTOR_MAX_ATTEMPTS, 5)
  })

  test('returns none when nothing is stored', ({ assert }) => {
    assert.deepEqual(readPending(undefined, now), { status: 'none' })
    assert.deepEqual(readPending(null, now), { status: 'none' })
    assert.deepEqual(readPending(42, now), { status: 'none' })
    assert.deepEqual(readPending({}, now), { status: 'none' })
  })

  test('returns none for a malformed record', ({ assert }) => {
    assert.deepEqual(readPending({ userId: 'x', expiresAt: 1 }, now), { status: 'none' })
    assert.deepEqual(readPending({ userId: 7, expiresAt: '1' }, now), { status: 'none' })
  })

  test('returns ok for a freshly created record', ({ assert }) => {
    assert.deepEqual(readPending(createPending(7, now), now), {
      status: 'ok',
      pending: { userId: 7, expiresAt: now + TTL, attempts: 0 },
    })
  })

  test('is still ok one millisecond before expiry', ({ assert }) => {
    const result = readPending(createPending(7, now), now + TTL - 1)
    assert.equal(result.status, 'ok')
  })

  test('is expired exactly at expiresAt (inclusive boundary)', ({ assert }) => {
    assert.deepEqual(readPending(createPending(7, now), now + TTL), { status: 'expired' })
  })

  test('normalizes an invalid attempts value to 0', ({ assert }) => {
    const expiresAt = now + TTL
    for (const attempts of [undefined, -1, 1.5, 'x', null]) {
      assert.deepEqual(readPending({ userId: 7, expiresAt, attempts }, now), {
        status: 'ok',
        pending: { userId: 7, expiresAt, attempts: 0 },
      })
    }
  })

  test('increments attempts without locking under the cap', ({ assert }) => {
    const expiresAt = now + TTL
    assert.deepEqual(recordFailedAttempt({ userId: 7, expiresAt, attempts: 3 }), {
      locked: false,
      pending: { userId: 7, expiresAt, attempts: 4 },
    })
  })

  test('locks on the 5th failure', ({ assert }) => {
    const expiresAt = now + TTL
    const result = recordFailedAttempt({ userId: 7, expiresAt, attempts: 4 })
    assert.isTrue(result.locked)
    assert.equal(result.pending.attempts, 5)
  })
})
