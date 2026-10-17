// node --test app/lib/blog/postImageUrls.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { postImageUrls } from './postImageUrls.ts'

test('封面加兩個語言內文的 img，srcset 裡的網址不重複列', () => {
  const urls = postImageUrls({
    coverImage: { url: 'https://img.johnlin.me/posts/images/a/w1440.webp', alt: '', srcset: 'x 480w' },
    locales: {
      'zh-tw': {
        content:
          '<p>文<img class="editor-image" src="https://img.johnlin.me/posts/images/b/w960.webp" srcset="https://img.johnlin.me/posts/images/b/w480.webp 480w" sizes="100vw"></p>',
      },
      en: { content: '<img src="https://example.com/c.png">' },
    },
  })
  assert.deepEqual(urls, [
    'https://img.johnlin.me/posts/images/a/w1440.webp',
    'https://img.johnlin.me/posts/images/b/w960.webp',
    'https://example.com/c.png',
  ])
})

test('沒有封面、沒有內文也不會壞', () => {
  assert.deepEqual(postImageUrls({ coverImage: null, locales: { 'zh-tw': { content: '' } } }), [])
  assert.deepEqual(postImageUrls({}), [])
})
