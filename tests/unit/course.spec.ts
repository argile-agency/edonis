import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Course from '#models/course'

/**
 * Builds an in-memory Course that passes every non-date guard in canEnroll().
 * No database is touched: the instance is never persisted.
 */
function buildEnrollableCourse(dates: {
  startDate: DateTime | null
  endDate: DateTime | null
}): Course {
  const course = new Course()
  course.allowEnrollment = true
  course.status = 'published'
  course.maxStudents = null
  course.enrolledCount = 0
  course.startDate = dates.startDate
  course.endDate = dates.endDate
  return course
}

test.group('Course.canEnroll - date window', () => {
  test('refuses enrollment when startDate is in the future', ({ assert }) => {
    const course = buildEnrollableCourse({
      startDate: DateTime.now().plus({ days: 7 }),
      endDate: null,
    })

    assert.isFalse(course.canEnroll())
  })

  test('refuses enrollment when endDate is in the past', ({ assert }) => {
    const course = buildEnrollableCourse({
      startDate: null,
      endDate: DateTime.now().minus({ days: 7 }),
    })

    assert.isFalse(course.canEnroll())
  })

  test('allows enrollment inside the date window', ({ assert }) => {
    const course = buildEnrollableCourse({
      startDate: DateTime.now().minus({ days: 7 }),
      endDate: DateTime.now().plus({ days: 7 }),
    })

    assert.isTrue(course.canEnroll())
  })

  test('allows enrollment when both dates are null', ({ assert }) => {
    const course = buildEnrollableCourse({ startDate: null, endDate: null })

    assert.isTrue(course.canEnroll())
  })

  test('refuses enrollment when allowEnrollment is false, even inside the window', ({ assert }) => {
    const course = buildEnrollableCourse({
      startDate: DateTime.now().minus({ days: 7 }),
      endDate: DateTime.now().plus({ days: 7 }),
    })
    course.allowEnrollment = false

    assert.isFalse(course.canEnroll())
  })
})
