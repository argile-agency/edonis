import { test } from '@japa/runner'
import type { ApiRequest } from '@japa/api-client'
import type { Assert } from '@japa/assert'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import Tokens from 'csrf'
import User from '#models/user'
import AuditLog from '#models/audit_log'
import PiiScanService, { classifyPiiValue, PII_COLUMNS } from '#services/pii_scan_service'

/**
 * Spec-local CSRF helper: does exactly what `@adonisjs/shield`'s
 * `shieldApiClient().withCsrfToken()` does (session `csrf-secret` + matching
 * `x-csrf-token` header). Temporary: plan 02-07 replaces every call with
 * `.withCsrfToken()` once `shieldApiClient()` is registered in bootstrap.
 */
function withCsrf<T extends ApiRequest>(request: T): T {
  const tokens = new Tokens()
  const secret = tokens.secretSync()
  return request
    .withSession({ 'csrf-secret': secret })
    .header('x-csrf-token', tokens.create(secret))
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@test.com`
}

async function createUser(prefix: string) {
  return User.create({
    email: uniqueEmail(prefix),
    password: 'password',
    fullName: `Test ${prefix}`,
  })
}

test.group('PII - column capacity', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * NOTE: on SQLite this test passes even without the widen migration, because
   * SQLite does not enforce varchar length. The CI PostgreSQL / MySQL matrix is
   * what proves `users.phone` / `users.mobile_phone` can hold the ~110-char
   * ciphertext.
   */
  test('a phone number saved via the profile form is stored encrypted and reads back', async ({
    client,
    route,
    assert,
  }) => {
    const user = await createUser('pii-profile')

    // Do not follow the redirect: the target page would render the full
    // Inertia HTML layout, which requires a built Vite manifest.
    const response = await withCsrf(
      client.post(route('user.profile.update')).loginAs(user).redirects(0)
    ).form({
      email: user.email,
      firstName: 'Pii',
      lastName: 'Tester',
      phone: '0612345678',
      mobilePhone: '0712345678',
    })

    response.assertStatus(302)
    assert.isUndefined(response.flashMessage('errorsBag.E_BAD_CSRF_TOKEN'))
    assert.isUndefined(response.flashMessage('error'))
    assert.equal(response.flashMessage('success'), 'Profil mis à jour avec succès')

    const raw = await db.from('users').where('id', user.id).first()
    assert.isString(raw.phone)
    assert.isAbove(raw.phone.length, 20)
    assert.notEqual(raw.phone, '0612345678')
    assert.isString(raw.mobile_phone)
    assert.isAbove(raw.mobile_phone.length, 20)

    const reloaded = await User.findOrFail(user.id)
    assert.equal(reloaded.phone, '0612345678')
    assert.equal(reloaded.mobilePhone, '0712345678')
  })
})

/**
 * Seeds three users and overwrites their raw `phone` cell (bypassing the
 * model's `prepare` hook):
 * - A: valid ciphertext        -> ok
 * - B: legacy plaintext        -> legacy-plaintext
 * - C: truncated ciphertext    -> undecryptable
 */
async function seedScanFixtures() {
  const a = await createUser('pii-scan-a')
  const b = await createUser('pii-scan-b')
  const c = await createUser('pii-scan-c')

  const cipherA = encryption.encrypt('0612345678')
  const plainB = '0699999999'
  const cipherC = encryption.encrypt('0611111111').slice(0, -10)

  await db.from('users').where('id', a.id).update({ phone: cipherA })
  await db.from('users').where('id', b.id).update({ phone: plainB })
  await db.from('users').where('id', c.id).update({ phone: cipherC })

  return { a, b, c, cipherA, plainB, cipherC }
}

type ScanRow = { userId: number; column: string; classification: string }

function classificationOf(rows: ScanRow[], userId: number, column = 'phone') {
  return rows.find((r) => r.userId === userId && r.column === column)?.classification
}

async function rawPhones(ids: number[]) {
  const rows = await db.from('users').whereIn('id', ids).select('id', 'phone').orderBy('id')
  return rows.map((r) => ({ id: r.id, phone: r.phone }))
}

async function piiAuditRows(ids: number[]) {
  return AuditLog.query()
    .where('action', 'like', 'cli.pii.%')
    .whereIn(
      'resource_id',
      ids.map((id) => String(id))
    )
    .orderBy('id')
}

test.group('PII - classifyPiiValue', () => {
  test('classifies empty, encrypted, plaintext and undecryptable values', ({ assert }) => {
    assert.deepEqual(PII_COLUMNS, ['phone', 'mobile_phone', 'address', 'identification_number'])

    assert.equal(classifyPiiValue(null), 'empty')
    assert.equal(classifyPiiValue(undefined), 'empty')
    assert.equal(classifyPiiValue(''), 'empty')

    assert.equal(classifyPiiValue(encryption.encrypt('0612345678')), 'ok')
    assert.equal(classifyPiiValue(encryption.encrypt('12 rue de la Paix, 75002 Paris')), 'ok')

    assert.equal(classifyPiiValue('0699999999'), 'legacy-plaintext')
    assert.equal(classifyPiiValue('12 rue St. Paul. Paris'), 'legacy-plaintext')
    assert.equal(classifyPiiValue(12345), 'legacy-plaintext')

    const otherKey = encryption.child({ secret: 'a-completely-different-app-key-0123456789' })
    assert.equal(classifyPiiValue(otherKey.encrypt('0612345678')), 'undecryptable')
    assert.equal(classifyPiiValue(encryption.encrypt('0612345678').slice(0, -10)), 'undecryptable')
  })
})

test.group('PII - scan', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('report-only scan classifies cells, changes nothing and writes no audit', async ({
    assert,
  }) => {
    const { a, b, c } = await seedScanFixtures()
    const ids = [a.id, b.id, c.id]
    const before = await rawPhones(ids)

    const result = await PiiScanService.scan({ fix: false })

    assert.equal(classificationOf(result.rows, a.id), 'ok')
    assert.equal(classificationOf(result.rows, b.id), 'legacy-plaintext')
    assert.equal(classificationOf(result.rows, c.id), 'undecryptable')
    assert.isAtLeast(result.counts.ok, 1)
    assert.isAtLeast(result.counts['legacy-plaintext'], 1)
    assert.isAtLeast(result.counts.undecryptable, 1)

    // No report row exposes a value: keys are exactly userId, column, classification.
    for (const row of result.rows) {
      assert.sameMembers(Object.keys(row), ['userId', 'column', 'classification'])
    }

    assert.deepEqual(await rawPhones(ids), before)
    assert.lengthOf(await piiAuditRows(ids), 0)
  })

  test('scan defaults to report-only when no option is passed', async ({ assert }) => {
    const { a, b, c } = await seedScanFixtures()
    const ids = [a.id, b.id, c.id]
    const before = await rawPhones(ids)

    await PiiScanService.scan({})

    assert.deepEqual(await rawPhones(ids), before)
    assert.lengthOf(await piiAuditRows(ids), 0)
  })

  test('fix re-encrypts legacy plaintext, leaves undecryptable cells alone and audits the change', async ({
    assert,
  }) => {
    const { a, b, c, cipherA, plainB, cipherC } = await seedScanFixtures()
    const ids = [a.id, b.id, c.id]

    await PiiScanService.scan({ fix: true })

    const rescan = await PiiScanService.scan({ fix: false })
    assert.equal(classificationOf(rescan.rows, a.id), 'ok')
    assert.equal(classificationOf(rescan.rows, b.id), 'ok')
    assert.equal(classificationOf(rescan.rows, c.id), 'undecryptable')

    const reloadedB = await User.findOrFail(b.id)
    assert.equal(reloadedB.phone, '0699999999')

    const [rawA, rawB, rawC] = await rawPhones(ids)
    assert.equal(rawA.phone, cipherA)
    assert.notEqual(rawB.phone, plainB)
    assert.equal(rawC.phone, cipherC)

    const audits = await piiAuditRows(ids)
    assert.lengthOf(audits, 1)
    assert.equal(audits[0].action, 'cli.pii.reencrypt')
    assert.equal(audits[0].resourceType, 'User')
    assert.equal(audits[0].resourceId, String(b.id))
    assert.isNull(audits[0].userId)
    assert.deepEqual(audits[0].metadata, { column: 'phone', classification: 'legacy-plaintext' })

    assertNoValueInAudits(assert, audits, [plainB, '0612345678', cipherA, cipherC])
  })

  test('nullUndecryptable nulls undecryptable cells and audits each one', async ({ assert }) => {
    const { a, b, c, cipherA, plainB, cipherC } = await seedScanFixtures()
    const ids = [a.id, b.id, c.id]

    await PiiScanService.scan({ fix: true, nullUndecryptable: true })

    const [rawA, , rawC] = await rawPhones(ids)
    assert.equal(rawA.phone, cipherA)
    assert.isNull(rawC.phone)

    const rescan = await PiiScanService.scan({ fix: false })
    assert.isUndefined(classificationOf(rescan.rows, c.id))

    const audits = await piiAuditRows(ids)
    const nulled = audits.filter((row) => row.action === 'cli.pii.null_undecryptable')
    assert.lengthOf(nulled, 1)
    assert.equal(nulled[0].resourceId, String(c.id))
    assert.isNull(nulled[0].userId)
    assert.deepEqual(nulled[0].metadata, { column: 'phone', classification: 'undecryptable' })

    const reencrypted = audits.filter((row) => row.action === 'cli.pii.reencrypt')
    assert.lengthOf(reencrypted, 1)
    assert.equal(reencrypted[0].resourceId, String(b.id))

    assertNoValueInAudits(assert, audits, [plainB, '0612345678', cipherA, cipherC])
  })
})

function assertNoValueInAudits(assert: Assert, audits: AuditLog[], values: string[]) {
  for (const audit of audits) {
    assert.isNull(audit.oldValues)
    assert.isNull(audit.newValues)
    const serialized = JSON.stringify({
      metadata: audit.metadata,
      oldValues: audit.oldValues,
      newValues: audit.newValues,
    })
    for (const value of values) {
      // Ciphertexts are checked by prefix: any fragment of the cell is a leak.
      assert.notInclude(serialized, value.slice(0, 20))
    }
  }
}
