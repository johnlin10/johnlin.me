// 跑法：node app/lib/notes/links.test.mjs（Node 內建 TS type stripping，免框架）
import assert from 'node:assert/strict'
import { findFirstUrl, splitLinks, stripTrailingUrl } from './links.ts'

const urls = (text) => splitLinks(text).filter((s) => s.type === 'link').map((s) => s.value)

assert.deepEqual(urls('看這個https://youtu.be/abc很棒'), ['https://youtu.be/abc'])
assert.deepEqual(urls('結尾句點 https://a.com/x.'), ['https://a.com/x'])
assert.deepEqual(urls('（https://a.com/x）'), ['https://a.com/x'])
assert.deepEqual(urls('(see https://a.com/x)'), ['https://a.com/x'])
assert.deepEqual(urls('https://en.wikipedia.org/wiki/Foo_(bar)'), ['https://en.wikipedia.org/wiki/Foo_(bar)'])
assert.deepEqual(urls('a https://a.com?q=1&b=2#h, b http://b.com'), ['https://a.com?q=1&b=2#h', 'http://b.com'])
assert.deepEqual(urls('沒有網址 ftp://x.com'), [])

assert.equal(splitLinks('前 https://a.com 後').map((s) => s.value).join(''), '前 https://a.com 後')

assert.equal(findFirstUrl('x https://a.com y https://b.com'), 'https://a.com')
assert.equal(findFirstUrl('nothing'), null)

assert.equal(stripTrailingUrl('好看\n\nhttps://youtu.be/abc  \n', 'https://youtu.be/abc'), '好看')
assert.equal(stripTrailingUrl('看 https://a.com 這個', 'https://a.com'), '看 https://a.com 這個')
assert.equal(stripTrailingUrl('https://a.com', 'https://a.com'), '')

console.log('links ok')
