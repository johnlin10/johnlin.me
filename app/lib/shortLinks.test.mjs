// node --test app/lib/shortLinks.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidSlug, normalizeTarget, randomSlug } from './shortLinks.ts'

test('隨機 slug 只用去掉 l、o、0、1 的小寫英數', () => {
  for (let i = 0; i < 1000; i++) assert.match(randomSlug(), /^[a-km-np-z2-9]{6}$/)
})

test('自訂 slug 跟資料庫的規則一致', () => {
  assert.equal(isValidSlug('cv'), true)
  assert.equal(isValidSlug('my-site-2'), true)
  assert.equal(isValidSlug('My'), false)
  assert.equal(isValidSlug('-a'), false)
  assert.equal(isValidSlug('a--b'), false)
  assert.equal(isValidSlug('author'), false)
  assert.equal(isValidSlug('a'.repeat(65)), false)
})

test('目標網址沒寫協定就補 https，只收 http(s)', () => {
  assert.equal(normalizeTarget('example.com'), 'https://example.com/')
  assert.equal(normalizeTarget(' http://a.tw/x?y=1 '), 'http://a.tw/x?y=1')
  assert.equal(normalizeTarget('javascript:alert(1)'), null)
  assert.equal(normalizeTarget('ftp://a.tw'), null)
  assert.equal(normalizeTarget('   '), null)
})
