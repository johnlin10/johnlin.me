// node --test app/lib/kb.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTree, extractLinks, hashContent, isNotePath, planSync } from './kb.ts'

test('只收 .md，跳過隱藏資料夾和規則檔', () => {
  assert.equal(isNotePath('學校/115-1/行銷管理/行銷的定義.md'), true)
  assert.equal(isNotePath('學校/CLAUDE.md'), false)
  assert.equal(isNotePath('學校/.claude/skills/x.md'), false)
  assert.equal(isNotePath('學校/.DS_Store'), false)
  assert.equal(isNotePath('學校/圖.png'), false)
})

test('連結去掉別名、標題、.md，表格裡的 \\| 也認得', () => {
  const content = [
    '[[行銷]]是一組活動，[[交換（行銷）|交換]]對顧客',
    '| [[顧客價值\\|價值]] | 差 |',
    '[[行銷與銷售#差別]] [[資料庫/行銷管理/框架/4C.md]] [[#本篇標題]] [[行銷]]',
  ].join('\n')
  assert.deepEqual(extractLinks(content), [
    '行銷',
    '交換（行銷）',
    '顧客價值',
    '行銷與銷售',
    '資料庫/行銷管理/框架/4C',
  ])
})

test('連結統一成 NFC，跟檔名比得起來', () => {
  assert.deepEqual(extractLinks('[[é]]'), ['é'])
})

test('hash 是 64 碼十六進位，內容一樣結果就一樣', async () => {
  const a = await hashContent('# 顧客價值')
  assert.match(a, /^[0-9a-f]{64}$/)
  assert.equal(a, await hashContent('# 顧客價值'))
  assert.notEqual(a, await hashContent('# 顧客價值 '))
})

test('比對出新增、更新、刪除', () => {
  const local = new Map([['a.md', '1'], ['b.md', '2'], ['c.md', '3']])
  const remote = new Map([['b.md', '2'], ['c.md', 'old'], ['d.md', '4']])
  assert.deepEqual(planSync(local, remote), {
    added: ['a.md'],
    changed: ['c.md'],
    removed: ['d.md'],
  })
})

test('樹：資料夾在前，名稱自然排序', () => {
  const tree = buildTree(['學校/第10週.md', '學校/第2週.md', '學校/資料庫/人物/Kotler.md'])
  assert.equal(tree.length, 1)
  assert.deepEqual(
    tree[0].children.map((n) => [n.name, n.path]),
    [
      ['資料庫', '學校/資料庫/'],
      ['第2週', '學校/第2週.md'],
      ['第10週', '學校/第10週.md'],
    ],
  )
  assert.equal(tree[0].children[0].children[0].children[0].path, '學校/資料庫/人物/Kotler.md')
})
