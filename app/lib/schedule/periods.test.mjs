// node --test app/lib/schedule/periods.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { overlaps, periodIndex } from './periods.ts'

test('A 節在第 4、5 節之間，B 節在第 8、9 節之間', () => {
  assert.ok(periodIndex('4') < periodIndex('A'))
  assert.ok(periodIndex('A') < periodIndex('5'))
  assert.ok(periodIndex('8') < periodIndex('B'))
  assert.ok(periodIndex('B') < periodIndex('9'))
  assert.equal(periodIndex('Z'), -1)
})

test('同一天節次有交集才算重疊', () => {
  const tue34 = { day: 2, start: '3', end: '4' }
  assert.equal(overlaps(tue34, { day: 2, start: '4', end: 'A' }), true)
  assert.equal(overlaps(tue34, { day: 2, start: '1', end: '10' }), true)
  assert.equal(overlaps(tue34, { day: 2, start: 'A', end: '6' }), false)
  assert.equal(overlaps(tue34, { day: 2, start: '1', end: '2' }), false)
  assert.equal(overlaps(tue34, { day: 3, start: '3', end: '4' }), false)
})
