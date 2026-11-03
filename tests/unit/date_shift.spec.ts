import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { shiftDate, shiftDays } from '../../app/helpers/date_shift.js'

/** Pure date shift: calendar days, wall-clock time kept, null preserved. */
test.group('date_shift', () => {
  const paris = { zone: 'Europe/Paris' }

  test('days mode returns the number of days', ({ assert }) => {
    assert.equal(shiftDays({ days: 7 }), 7)
    assert.equal(shiftDays({ days: -3 }), -3)
  })

  test('anchor mode returns the calendar-day difference', ({ assert }) => {
    const from = DateTime.fromISO('2026-09-01')
    const to = DateTime.fromISO('2026-09-08')
    assert.equal(shiftDays({ from, to }), 7)
    assert.equal(shiftDays({ from: to, to: from }), -7)
  })

  test('anchor across the DST change gives whole days', ({ assert }) => {
    const from = DateTime.fromISO('2026-03-25T10:00', paris)
    const to = DateTime.fromISO('2026-04-01T10:00', paris)
    assert.strictEqual(shiftDays({ from, to }), 7)
  })

  test('neither or both modes give null', ({ assert }) => {
    const from = DateTime.fromISO('2026-09-01')
    const to = DateTime.fromISO('2026-09-08')
    assert.isNull(shiftDays({}))
    assert.isNull(shiftDays({ days: 3, from, to }))
    assert.isNull(shiftDays({ from }))
  })

  test('null stays null', ({ assert }) => {
    assert.isNull(shiftDate(null, 7))
  })

  test('wall-clock time is kept across DST', ({ assert }) => {
    const shifted = shiftDate(DateTime.fromISO('2026-03-27T09:00', paris), 7)!
    assert.equal(shifted.toISO(), DateTime.fromISO('2026-04-03T09:00', paris).toISO())
    assert.equal(shifted.zoneName, 'Europe/Paris')
  })

  test('spacing between two dates is kept', ({ assert }) => {
    const a = DateTime.fromISO('2026-09-01T08:00')
    const b = a.plus({ days: 3, hours: 4 })
    const gap = b.diff(a).toMillis()
    assert.equal(shiftDate(b, 30)!.diff(shiftDate(a, 30)!).toMillis(), gap)
  })
})
