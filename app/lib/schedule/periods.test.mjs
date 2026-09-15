// node --test app/lib/schedule/periods.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { overlaps, periodIndex } from './periods.ts'

test('N 節排在第 4 和第 5 節之間', () => {
  assert.ok(periodIndex('4') < periodIndex('N'))
  assert.ok(periodIndex('N') < periodIndex('5'))
  assert.equal(periodIndex('Z'), -1)
})

test('同一天節次有交集才算重疊', () => {
  const tue34 = { day: 2, start: '3', end: '4' }
  assert.equal(overlaps(tue34, { day: 2, start: '4', end: 'N' }), true)
  assert.equal(overlaps(tue34, { day: 2, start: '1', end: '10' }), true)
  assert.equal(overlaps(tue34, { day: 2, start: 'N', end: '6' }), false)
  assert.equal(overlaps(tue34, { day: 2, start: '1', end: '2' }), false)
  assert.equal(overlaps(tue34, { day: 3, start: '3', end: '4' }), false)
})
