import { test } from '@japa/runner'
import { MAX_SECTION_DEPTH, rowKey } from '../../inertia/lib/builder_tree.js'

test.group('Builder tree contract', () => {
  test('the client module compiles and resolves from the backend runner', ({ assert }) => {
    assert.equal(MAX_SECTION_DEPTH, 1)
    assert.equal(rowKey({ kind: 'content', id: 12 }), 'c-12')
    assert.equal(rowKey({ kind: 'section', id: 12 }), 's-12')
  })
})
