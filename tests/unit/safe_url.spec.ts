import { test } from '@japa/runner'
import { isExternalUrl, isSafeImageSrc, isSafeLink } from '../../inertia/lib/safe_url.js'

test.group('safe_url', () => {
  test('isSafeLink accepts http(s) and root-relative paths', ({ assert }) => {
    for (const url of ['https://x.org/a', 'http://x.org', '/aide']) {
      assert.isTrue(isSafeLink(url), url)
    }
  })

  test('isSafeLink rejects scripts, other schemes, protocol-relative and blanks', ({ assert }) => {
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,x',
      '//evil.example',
      '/\\evil.example',
      'mailto:a@b.c',
      '',
      null,
      undefined,
      '/a b',
    ]) {
      assert.isFalse(isSafeLink(url), String(url))
    }
  })

  test('isSafeImageSrc uses the same accepted set', ({ assert }) => {
    assert.isTrue(isSafeImageSrc('/uploads/logo.png'))
    assert.isFalse(isSafeImageSrc('javascript:x'))
  })

  test('isExternalUrl is true only for absolute http(s)', ({ assert }) => {
    assert.isTrue(isExternalUrl('https://x.org'))
    assert.isFalse(isExternalUrl('/aide'))
  })
})
