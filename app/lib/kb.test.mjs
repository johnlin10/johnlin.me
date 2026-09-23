// node --test app/lib/kb.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTree, extractLinks, hashContent, isNotePath, linkify, planSync, splitNote } from './kb.ts'

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

test('樹：資料夾在前，名稱自然排序，最上層資料夾照樣保留', () => {
  const [school] = buildTree(['學校/第10週.md', '學校/第2週.md', '學校/資料庫/人物/Kotler.md'])
  assert.equal(school.path, '學校/')
  const tree = school.children
  assert.deepEqual(
    tree.map((n) => [n.name, n.path]),
    [
      ['資料庫', '學校/資料庫/'],
      ['第2週', '學校/第2週.md'],
      ['第10週', '學校/第10週.md'],
    ],
  )
  assert.equal(tree[0].children[0].children[0].path, '學校/資料庫/人物/Kotler.md')
})

test('連結換成網址，看不到的只留文字', () => {
  const visible = { 行銷: '/kb/t?p=a', 顧客價值: '/kb/t?p=b', 行銷與銷售: '/kb/t?p=c' }
  const out = linkify(
    '[[行銷]]、[[顧客價值\\|價值]]、[[行銷與銷售#差別]]、[[第2節]]、[[第2節|下一節]]、[[#本篇]]、![[行銷]]',
    (target) => visible[target] ?? null,
  )
  assert.equal(
    out,
    '[行銷](</kb/t?p=a>)、[價值](</kb/t?p=b>)、[行銷與銷售 > 差別](</kb/t?p=c>)、第2節、下一節、本篇、[行銷](</kb/t?p=a>)',
  )
})

test('路徑形式的連結只顯示檔名，文字裡的中括號跳脫', () => {
  assert.equal(linkify('[[資料庫/框架/4C]]', () => '/x'), '[4C](</x>)')
  assert.equal(linkify('[[a|[註]]', () => '/x'), '[\\[註](</x>)')
})

test('標題取檔名，去掉 frontmatter 和重複的 # 標題', () => {
  assert.deepEqual(splitNote('學校/庫/顧客價值.md', '# 顧客價值\n\n定義'), { title: '顧客價值', body: '\n定義' })
  assert.deepEqual(splitNote('學校/課/行銷的定義.md', '---\ntags: [a]\n---\n## 權威定義'), {
    title: '行銷的定義',
    body: '## 權威定義',
  })
  assert.equal(splitNote('x/別的.md', '# 不同標題\n內文').body, '# 不同標題\n內文')
})
