// node --test app/lib/holidays.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHolidays } from './holidays.ts'

// 取自真實的 ics，涵蓋四種要分開處理的情況
const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260928',
  'DESCRIPTION:國定假日',
  'SUMMARY:教師節',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261009',
  'DESCRIPTION:國定假日',
  // 折行：接續行以空白開頭
  'SUMMARY:中華民國國慶日',
  ' 補假',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261010',
  'DESCRIPTION:國定假日',
  'SUMMARY:中華民國國慶日',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261222',
  'DESCRIPTION:假日節慶\\n如要隱藏假日節慶\\, 請前往 Google 日曆的 [設定]',
  'SUMMARY:冬至',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20250101',
  'DESCRIPTION:國定假日',
  'SUMMARY:中華民國開國紀念日/元旦',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

test('ics 只留指定年份、平日的國定假日', () => {
  const days = parseHolidays(ICS, ['2026'])
  assert.deepEqual(days, [
    { date: '2026-09-28', label: '教師節' },
    // 折行接回來了
    { date: '2026-10-09', label: '中華民國國慶日補假' },
  ])
  // 10/10 是週六、12/22 是不放假的民俗節日、2025 不在範圍內，三個都濾掉
})

test('換年份就換一批', () => {
  assert.deepEqual(parseHolidays(ICS, ['2025']), [
    { date: '2025-01-01', label: '中華民國開國紀念日/元旦' },
  ])
  assert.deepEqual(parseHolidays(ICS, ['2024']), [])
})
