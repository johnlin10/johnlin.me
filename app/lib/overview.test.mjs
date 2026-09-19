// node --test app/lib/overview.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { examWeek, pickAgenda, shiftDate, termProgress } from './overview.ts'

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
    kind: 'in', code: '115-1', week: 1, weeks: 18, daysLeft: 122, ratio: 1 / 123, exams: [],
  })
  assert.equal(termProgress('2026-09-22', terms).week, 2)
  assert.equal(termProgress('2027-01-15', terms).ratio, 1)
  assert.deepEqual(termProgress('2026-08-01', terms), { kind: 'before', code: '115-1', daysUntil: 45 })
  assert.equal(termProgress('2027-02-01', terms), null)
})

test('考試週填哪一天都推回同一週', () => {
  // 2026-11-09 是週一
  for (const date of ['2026-11-09', '2026-11-11', '2026-11-13', '2026-11-15']) {
    assert.equal(examWeek('2026-09-20', 'midterm', date).monday, '2026-11-09')
  }
  assert.deepEqual(examWeek('2026-09-20', 'midterm', '2026-11-11'), {
    kind: 'midterm', monday: '2026-11-09', friday: '2026-11-13', status: 'upcoming', weeksUntil: 8, daysUntil: 50,
  })
  assert.equal(examWeek('2026-11-09', 'midterm', '2026-11-11').status, 'now')
  assert.equal(examWeek('2026-11-15', 'midterm', '2026-11-11').status, 'now')
  assert.equal(examWeek('2026-11-16', 'midterm', '2026-11-11').status, 'done')
  // 週日和下週一看同一場考試，差一週
  assert.equal(examWeek('2026-11-01', 'midterm', '2026-11-11').status, 'upcoming')
  assert.equal(examWeek('2026-11-02', 'midterm', '2026-11-11').status, 'soon')
  // 前一週改看天數，週日是明天
  assert.equal(examWeek('2026-11-02', 'midterm', '2026-11-11').daysUntil, 7)
  assert.equal(examWeek('2026-11-08', 'midterm', '2026-11-11').daysUntil, 1)
})

test('學期中帶出有填的考試週', () => {
  const terms = [
    { code: '115-1', start_date: '2026-09-14', end_date: '2027-01-15', midterm_week: '2026-11-11', final_week: null },
  ]
  const exams = termProgress('2026-09-20', terms).exams
  assert.equal(exams.length, 1)
  assert.equal(exams[0].kind, 'midterm')
})
