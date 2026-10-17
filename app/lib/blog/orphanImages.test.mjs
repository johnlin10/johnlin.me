// node --test app/lib/blog/orphanImages.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ORPHAN_GRACE_MS, pickPostImagesToDelete } from './orphanImages.ts'

const NOW = Date.UTC(2026, 9, 17)
const DAY = 24 * 60 * 60 * 1000
const inUse = JSON.stringify([{ cover_image: { url: 'https://img.johnlin.me/posts/images/used/w960.webp' } }])

test('點名的圖：沒人用就馬上刪，不看寬限期', () => {
  const folders = new Map([['fresh', NOW - 60_000]])
  assert.deepEqual(pickPostImagesToDelete(['fresh'], folders, inUse, NOW), ['fresh'])
})

test('點名的圖還有人用就留著', () => {
  assert.deepEqual(pickPostImagesToDelete(['used'], new Map(), inUse, NOW), [])
})

test('掃到的孤兒要超過寬限期才刪', () => {
  const folders = new Map([
    ['old', NOW - ORPHAN_GRACE_MS - DAY],
    ['recent', NOW - 6 * DAY],
    ['used', NOW - 30 * DAY],
  ])
  assert.deepEqual(pickPostImagesToDelete([], folders, inUse, NOW), ['old'])
})

test('點名與掃描重複的只算一次', () => {
  const folders = new Map([['old', NOW - 30 * DAY]])
  assert.deepEqual(pickPostImagesToDelete(['old'], folders, inUse, NOW), ['old'])
})
