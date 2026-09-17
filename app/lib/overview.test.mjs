// node --test app/lib/overview.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickAgenda, shiftDate, termProgress } from './overview.ts'

test('日期跨月跨年', () => {
  assert.equal(shiftDate('2026-09-30', 1), '2026-10-01')
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01')
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28')
})

test('今天還有沒結束的就顯示今天，都結束了就往後找', () => {
  const plan = {
    '2026-09-17': [{ end: '10:00' }, { end: '15:00' }],
    '2026-09-21': [{ end: '12:00' }],
  }
  const itemsOn = (date) => plan[date] ?? []
  assert.equal(pickAgenda('2026-09-17', '09:00', itemsOn).date, '2026-09-17')
  assert.equal(pickAgenda('2026-09-17', '14:59', itemsOn).items.length, 2)
  assert.equal(pickAgenda('2026-09-17', '15:00', itemsOn).date, '2026-09-21')
  assert.equal(pickAgenda('2026-09-22', '08:00', itemsOn), null)
})

test('學期中算第幾週，放假算離開學幾天', () => {
  const terms = [
    { code: '115-1', start_date: '2026-09-15', end_date: '2027-01-15' },
    { code: '114-2', start_date: '2026-02-25', end_date: '2026-06-19' },
    { code: '113-1', start_date: null, end_date: null },
  ]
  assert.deepEqual(termProgress('2026-09-15', terms), {
    kind: 'in', code: '115-1', week: 1, weeks: 18, daysLeft: 122, ratio: 1 / 123,
  })
  assert.equal(termProgress('2026-09-22', terms).week, 2)
  assert.equal(termProgress('2027-01-15', terms).ratio, 1)
  assert.deepEqual(termProgress('2026-08-01', terms), { kind: 'before', code: '115-1', daysUntil: 45 })
  assert.equal(termProgress('2027-02-01', terms), null)
})
