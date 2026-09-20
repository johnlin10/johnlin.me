// node --test app/lib/qr.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import QRCode from 'qrcode'
import { buildPayload, finderOrigins, finderPath, modulesPath, withoutFinders } from './qr.ts'

test('必填沒填完就不出字串', () => {
  assert.equal(buildPayload('wifi', { password: 'x' }), '')
  assert.equal(buildPayload('geo', { lat: '25', lng: '' }), '')
  assert.equal(buildPayload('text', { text: '   ' }), '')
})

test('網址原樣帶過，正規化是呼叫端的事', () => {
  assert.equal(buildPayload('url', { url: ' https://johnlin.me/ ' }), 'https://johnlin.me/')
  assert.equal(buildPayload('url', { url: '' }), '')
})

test('Wi-Fi 有密碼是 WPA，沒密碼是開放網路', () => {
  assert.equal(
    buildPayload('wifi', { ssid: 'Cafe', password: 'pa;ss' }),
    'WIFI:T:WPA;S:Cafe;P:pa\\;ss;;',
  )
  assert.equal(buildPayload('wifi', { ssid: 'Free WiFi' }), 'WIFI:T:nopass;S:Free WiFi;;')
})

test('vCard 只放有填的欄位，分號要跳脫', () => {
  const card = buildPayload('vcard', { name: 'John; Lin', org: '', phone: '0912-345-678' })
  assert.equal(
    card,
    'BEGIN:VCARD\r\nVERSION:3.0\r\nN:;John\\; Lin;;;\r\nFN:John\\; Lin\r\nTEL;TYPE=CELL:0912-345-678\r\nEND:VCARD',
  )
})

test('mailto 的主旨和內文要編碼', () => {
  assert.equal(
    buildPayload('email', { email: 'a@b.com', subject: 'Hi there', body: 'a&b' }),
    'mailto:a@b.com?subject=Hi%20there&body=a%26b',
  )
  assert.equal(buildPayload('email', { email: 'a@b.com' }), 'mailto:a@b.com')
})

test('電話只留數字和加號，座標要在範圍內', () => {
  assert.equal(buildPayload('tel', { phone: '+886 912-345-678' }), 'tel:+886912345678')
  assert.equal(buildPayload('geo', { lat: '25.033', lng: '121.565' }), 'geo:25.033,121.565')
  assert.equal(buildPayload('geo', { lat: '95', lng: '0' }), '')
})

test('矩陣畫成 path，一個深色模組一格', () => {
  assert.equal(modulesPath(2, [1, 0, 0, 1]), 'M0 0h1v1h-1zM1 1h1v1h-1z')
  assert.equal(modulesPath(2, [0, 0, 0, 0]), '')
})

test('定位點永遠是那個樣子，所以可以自己畫', () => {
  // 外環一圈深色、中間一圈淺色、中心 3×3 深色。三個定位點在每個版本都長這樣，
  // finderPath() 就是照這個結構畫的
  const { modules } = QRCode.create('https://johnlin.me/', { errorCorrectionLevel: 'M' })
  const ring = (x, y) => Math.max(Math.abs(x - 3), Math.abs(y - 3))
  for (const [ox, oy] of finderOrigins(modules.size)) {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const expected = ring(x, y) === 2 ? 0 : 1
        assert.equal(modules.data[(oy + y) * modules.size + ox + x], expected)
      }
    }
  }
})

test('點陣不重畫定位點', () => {
  const { modules } = QRCode.create('https://johnlin.me/', { errorCorrectionLevel: 'M' })
  const rest = withoutFinders(modules.size, modules.data)
  const dark = (d) => d.reduce((sum, value) => sum + (value ? 1 : 0), 0)
  // 每個定位點 7×7 裡有 33 格深色（49 − 外環內那圈 16 格）
  assert.equal(dark(modules.data) - dark(rest), 3 * 33)
  // 原本的資料不能被動到
  assert.equal(modules.data[0], 1)
})

test('定位點三層同心，圓到底就是三個圓', () => {
  assert.equal(finderPath(21, 0).match(/M/g).length, 9)
  assert.equal(finderPath(21, 0).includes('a'), false)
  // 每層四段弧，三層三個定位點
  assert.equal(finderPath(21, 1).match(/a/g).length, 3 * 3 * 4)
})

test('定位點往內每層半徑減一格，環的寬度才處處相等', () => {
  // 一個定位點三層的半徑，沒有弧的那層是直角
  const radii = (roundness) =>
    finderPath(21, roundness)
      .split('M')
      .slice(1, 4)
      .map((layer) => Number(layer.match(/a([\d.]+) /)?.[1] ?? 0))

  assert.deepEqual(radii(1), [3.5, 2.5, 1.5])
  assert.deepEqual(radii(0.65), [2.275, 1.275, 0.275])
  // 外圈還不夠圓的時候，內層是直角，不是跟著按比例縮
  assert.deepEqual(radii(0.3), [1.05, 0.05, 0])
  assert.deepEqual(radii(0), [0, 0, 0])
})

test('圓角只倒外側的角', () => {
  // 孤零零一格，四個角都倒
  assert.equal(modulesPath(1, [1], 0.5).match(/a/g)?.length, 4)
  // 橫向相連的兩格，中間那條邊的四個角不倒，剩下四個
  const pair = modulesPath(2, [1, 1, 0, 0], 0.2)
  assert.equal(pair.match(/a/g)?.length, 4)
  // 四格連成一塊，只剩最外面四個角
  assert.equal(modulesPath(2, [1, 1, 1, 1], 0.2).match(/a/g)?.length, 4)
  // 半徑 0 還是走原本的方格寫法
  assert.equal(modulesPath(1, [1], 0), 'M0 0h1v1h-1z')
})
