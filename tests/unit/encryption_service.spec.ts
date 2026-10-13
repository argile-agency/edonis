import { test } from '@japa/runner'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import EncryptionService from '#services/encryption_service'
import DecryptionException from '#exceptions/decryption_exception'

type LoggedCall = unknown[]

/**
 * Runs `fn` with `logger.error` replaced by a recorder, then restores it.
 * The service calls `logger.error` on the same imported singleton, so the
 * recorder sees every failure report.
 */
async function captureErrors<T>(fn: () => T | Promise<T>): Promise<{ calls: LoggedCall[] }> {
  const calls: LoggedCall[] = []
  const original = logger.error
  logger.error = ((...args: unknown[]) => {
    calls.push(args)
  }) as typeof logger.error
  try {
    await fn()
  } finally {
    logger.error = original
  }
  return { calls }
}

/**
 * Sets PII_DECRYPT_STRICT for the duration of `fn` and always restores the
 * previous value, so later specs in the same process see the default.
 */
async function withStrict<T>(value: 'true' | 'false', fn: () => T | Promise<T>): Promise<T> {
  const previous = env.get('PII_DECRYPT_STRICT')
  env.set('PII_DECRYPT_STRICT', value)
  try {
    return await fn()
  } finally {
    env.set('PII_DECRYPT_STRICT', String(previous ?? 'false'))
  }
}

function assertSafePayload(
  assert: import('@japa/assert').Assert,
  call: LoggedCall,
  input: string,
  strict: boolean
) {
  const [payload, message] = call
  assert.isObject(payload)
  const record = payload as Record<string, unknown>
  assert.properties(record, ['column', 'id', 'length', 'strict'])
  assert.notProperty(record, 'value')
  assert.equal(record.column, 'phone')
  assert.equal(record.id, 42)
  assert.equal(record.length, input.length)
  assert.equal(record.strict, strict)
  for (const part of call) {
    assert.notEqual(part, input)
  }
  assert.notInclude(JSON.stringify(call), input)
  assert.isString(message)
}

const PLAIN = 'plain-text-value'
const CONTEXT = { column: 'phone', id: 42 }

test.group('EncryptionService.decrypt', () => {
  // Must stay first: once any test calls env.set, the "unset" state cannot be
  // recreated (restoring writes 'false', which is behaviourally equivalent).
  test('default (flag unset) returns null for undecryptable input and logs once', async ({
    assert,
  }) => {
    assert.isUndefined(env.get('PII_DECRYPT_STRICT'))
    assert.isFalse(EncryptionService.isStrict())

    let result: string | null | undefined = 'sentinel'
    const { calls } = await captureErrors(() => {
      result = EncryptionService.decrypt(PLAIN, CONTEXT)
    })

    assert.isNull(result)
    assert.notEqual(result, PLAIN)
    assert.lengthOf(calls, 1)
    assertSafePayload(assert, calls[0], PLAIN, false)
  })

  test('passes null, undefined and empty string through in both modes', async ({ assert }) => {
    for (const mode of ['true', 'false'] as const) {
      await withStrict(mode, () => {
        assert.isNull(EncryptionService.decrypt(null))
        assert.isUndefined(EncryptionService.decrypt(undefined))
        assert.strictEqual(EncryptionService.decrypt(''), '')
      })
    }
  })

  test('valid ciphertext round-trips in both modes', async ({ assert }) => {
    const cipher = EncryptionService.encrypt('0612345678')!
    for (const mode of ['true', 'false'] as const) {
      await withStrict(mode, async () => {
        const { calls } = await captureErrors(() => {
          assert.equal(EncryptionService.decrypt(cipher, CONTEXT), '0612345678')
        })
        assert.lengthOf(calls, 0)
      })
    }
  })

  test('strict on: plaintext and truncated ciphertext throw DecryptionException', async ({
    assert,
  }) => {
    const truncated = EncryptionService.encrypt('0612345678')!.slice(0, -10)

    await withStrict('true', async () => {
      assert.isTrue(EncryptionService.isStrict())

      for (const input of [PLAIN, truncated]) {
        let thrown: unknown
        const { calls } = await captureErrors(() => {
          try {
            EncryptionService.decrypt(input, CONTEXT)
          } catch (error) {
            thrown = error
          }
        })

        assert.instanceOf(thrown, DecryptionException)
        const exception = thrown as DecryptionException
        assert.equal(exception.code, 'E_PII_DECRYPTION_FAILED')
        assert.equal(exception.status, 500)
        assert.notInclude(exception.message, input)
        assert.lengthOf(calls, 1)
        assertSafePayload(assert, calls[0], input, true)
      }
    })
  })

  test('strict off: plaintext and truncated ciphertext return null without throwing', async ({
    assert,
  }) => {
    const truncated = EncryptionService.encrypt('0612345678')!.slice(0, -10)

    await withStrict('false', async () => {
      assert.isFalse(EncryptionService.isStrict())

      for (const input of [PLAIN, truncated]) {
        let result: string | null | undefined = 'sentinel'
        const { calls } = await captureErrors(() => {
          result = EncryptionService.decrypt(input, CONTEXT)
        })

        assert.isNull(result)
        assert.notEqual(result, input)
        assert.lengthOf(calls, 1)
        assertSafePayload(assert, calls[0], input, false)
      }
    })
  })

  test('strict flag is restored to the default after toggling', ({ assert }) => {
    assert.isFalse(EncryptionService.isStrict())
  })
})
