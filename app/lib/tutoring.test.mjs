// node --test app/lib/tutoring.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  durationHours,
  endOf,
  inTerm,
  layoutLanes,
  slotInEffect,
  sumHours,
  timeOverlaps,
  weeksOfMonth,
} from './tutoring.ts'

test('時段最少 1 小時，往上每 0.5 小時一階', () => {
  assert.equal(durationHours('09:00', '10:00'), 1)
  assert.equal(durationHours('09:00', '11:30'), 2.5)
  assert.equal(durationHours('09:00:00', '10:30:00'), 1.5)
  assert.equal(durationHours('09:00', '09:30'), null)
  assert.equal(durationHours('09:00', '10:20'), null)
  assert.equal(durationHours('10:00', '09:00'), null)
})

test('時間接在一起不算重疊', () => {
  const nine = { start: '09:00', end: '11:00' }
  assert.equal(timeOverlaps(nine, { start: '10:00', end: '12:00' }), true)
  assert.equal(timeOverlaps(nine, { start: '08:00', end: '13:00' }), true)
  assert.equal(timeOverlaps(nine, { start: '11:00', end: '13:00' }), false)
  assert.equal(timeOverlaps(nine, { start: '08:00', end: '09:00' }), false)
})

test('重疊的時段並排，同一群欄數一致', () => {
  const lanes = layoutLanes([
    { id: 'a', start: '09:00', end: '11:00' },
    { id: 'b', start: '10:00', end: '12:00' },
    { id: 'c', start: '11:00', end: '13:00' },
    { id: 'd', start: '14:00', end: '15:00' },
  ])
  assert.deepEqual(lanes.get('a'), { lane: 0, lanes: 2 })
  assert.deepEqual(lanes.get('b'), { lane: 1, lanes: 2 })
  // c 跟 a 不重疊，讓回第一欄，但還是同一群所以一樣是 2 欄寬
  assert.deepEqual(lanes.get('c'), { lane: 0, lanes: 2 })
  // d 自己一群，佔滿整欄
  assert.deepEqual(lanes.get('d'), { lane: 0, lanes: 1 })
})

test('時數按人累計，證照輔導不進 40 小時合計', () => {
  const hours = sumHours([
    { program: 'peer', start_time: '19:00', end_time: '21:00', attendees: ['me', 'you'] },
    { program: 'contest', start_time: '14:00', end_time: '17:30', attendees: ['me'] },
    { program: 'license', start_time: '09:00', end_time: '12:00', attendees: ['me'] },
    { program: 'nope', start_time: '09:00', end_time: '12:00', attendees: ['me'] },
  ])
  assert.equal(hours.get('me').peer, 2)
  assert.equal(hours.get('me').contest, 3.5)
  assert.equal(hours.get('me').license, 3)
  assert.equal(hours.get('me').capped, 5.5)
  assert.equal(hours.get('you').capped, 2)
  assert.equal(hours.get('you').contest, 0)
})

test('月份的週從跨月的那一週算起', () => {
  // 2026-09-01 是週二，所以第一週的週一是 8/31
  const weeks = weeksOfMonth('2026-09').map((date) => date.getDate())
  assert.deepEqual(weeks, [31, 7, 14, 21, 28])
})

test('結束時間由開始時間加時長推算，跨午夜回 null', () => {
  assert.equal(endOf('15:20', 2), '17:20')
  assert.equal(endOf('08:00', 1.5), '09:30')
  assert.equal(endOf('23:00', 1), '24:00')
  assert.equal(endOf('23:00', 2), null)
  // 推算出來的長度反過來也要是合規的
  assert.equal(durationHours('15:20', endOf('15:20', 2)), 2)
})

test('課表只在學期期間有效，沒填的日期不設限', () => {
  assert.equal(inTerm('2026-09-01', '2026-09-15', '2027-01-15'), false)
  assert.equal(inTerm('2026-09-15', '2026-09-15', '2027-01-15'), true)
  assert.equal(inTerm('2027-01-15', '2026-09-15', '2027-01-15'), true)
  assert.equal(inTerm('2027-01-16', '2026-09-15', '2027-01-15'), false)
  assert.equal(inTerm('2026-09-01', null, null), true)
  assert.equal(inTerm('2026-09-01', '2026-09-15', null), false)
  assert.equal(inTerm('2099-01-01', '2026-09-15', null), true)
})

test('舊學期沒填日期就不算，最新學期沒填日期照算', () => {
  const terms = [
    { id: 'new', start_date: '2026-09-15', end_date: null },
    { id: 'old', start_date: null, end_date: null },
    { id: 'dated', start_date: '2026-02-16', end_date: '2026-06-30' },
  ]
  assert.equal(slotInEffect('new', '2026-09-16', terms), true)
  assert.equal(slotInEffect('new', '2026-09-01', terms), false)
  assert.equal(slotInEffect('old', '2026-09-16', terms), false)
  assert.equal(slotInEffect('dated', '2026-03-02', terms), true)
  assert.equal(slotInEffect('missing', '2026-03-02', terms), false)
  assert.equal(slotInEffect('new', '2026-09-16', [{ id: 'new', start_date: null, end_date: null }]), true)
})
