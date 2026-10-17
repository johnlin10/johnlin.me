// node --test app/lib/images/postDerivatives.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { derivePostImage } from './postDerivatives.ts'

const jpeg = (width, height, orientation) => {
  const img = sharp({ create: { width, height, channels: 3, background: '#c86' } }).jpeg()
  return (orientation ? img.withMetadata({ orientation }) : img).toBuffer()
}

test('只產原圖寬度以內的級數，不放大', async () => {
  const steps = await derivePostImage(await jpeg(1200, 800))
  assert.deepEqual(steps.map((s) => s.w), [480, 960])
  const { width } = await sharp(steps[1].body).metadata()
  assert.equal(width, 960)
})

test('比最小一級還窄就只產一張原始寬度', async () => {
  const steps = await derivePostImage(await jpeg(300, 200))
  assert.deepEqual(steps.map((s) => s.w), [300])
})

test('大圖產滿四級', async () => {
  const steps = await derivePostImage(await jpeg(4000, 3000))
  assert.deepEqual(steps.map((s) => s.w), [480, 960, 1440, 2160])
})

test('EXIF 轉 90 度的直式照片用轉正後的寬度', async () => {
  // 存成 1600×1000、orientation 6，轉正後是 1000 寬
  const steps = await derivePostImage(await jpeg(1600, 1000, 6))
  assert.deepEqual(steps.map((s) => s.w), [480, 960])
  const { width, height } = await sharp(steps[1].body).metadata()
  assert.equal(width, 960)
  assert.ok(height > width)
})
