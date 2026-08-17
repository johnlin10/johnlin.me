import Image from 'next/image'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getTranslations } from 'next-intl/server'
import { getAboutChapters } from '@/app/lib/about-chapters'
import Icon from '@/app/components/Icon/Icon'
import ChapterShell from './ChapterShell'
import style from './about.module.scss'

type Props = {
  params: Promise<{
    locale: string
  }>
  searchParams: Promise<{
    chapter?: string | string[]
  }>
}

import { metadata } from '@/app/lib/metadata'

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'AboutPage' })

  return metadata({
    title: t('title'),
    description: t('description'),
    url: '/about',
  })
}

const AVATAR = '/assets/images/johnlin.jpeg'
const EMAIL = 'johnlin@johnlin.me'
const SUBSTACK_URL = 'https://johnlin10.substack.com'
const GITHUB_URL = 'https://github.com/johnlin10'

async function AboutPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { chapter } = await searchParams
  const t = await getTranslations({ locale, namespace: 'AboutPage' })
  const chapters = await getAboutChapters(locale)

  const requested = Array.isArray(chapter) ? chapter[0] : chapter
  const initialChapterId =
    chapters.find((c) => c.id === requested)?.id ?? chapters[0]?.id ?? ''

  // 中文版顯示中英雙名；英文版只顯示英文名字
  const displayName = locale === 'zh-tw' ? '林昌龍 · John Lin' : 'John Lin'

  return (
    <main className={style.about}>
      <ChapterShell
        initialChapterId={initialChapterId}
        chapters={chapters.map(({ id, title }) => ({ id, title }))}
        pageTitle={t('page_title')}
        navLabel={t('chapterNavLabel')}
        sidebar={
          <>
            <Image
              src={AVATAR}
              alt="John Lin"
              width={96}
              height={96}
              className={style.avatar}
              priority
            />
            <p className={style.name}>{displayName}</p>
            <p className={style.tagline}>{t('sidebar.tagline')}</p>
            <div className={style.contacts}>
              <a
                href={SUBSTACK_URL}
                target="_blank"
                rel="me noopener noreferrer"
                className={style.contactLink}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M15 3.604H1v1.891h14v-1.89ZM1 7.208V16l7-3.926L15 16V7.208zM15 0H1v1.89h14z" />
                </svg>
                <span className={style.srOnly}>Substack</span>
              </a>
              <a href={`mailto:${EMAIL}`} className={style.contactLink}>
                <Icon name="envelope" aria-hidden="true" />
                <span className={style.srOnly}>Email</span>
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="me noopener noreferrer"
                className={style.contactLink}
              >
                <Icon name="github" aria-hidden="true" />
                <span className={style.srOnly}>GitHub</span>
              </a>
            </div>
          </>
        }
        panels={chapters.map((c) => (
          <div key={c.id} className={style.chapterBody}>
            <h2 className={style.chapterTitle}>{c.title}</h2>
            {c.isFallbackLocale && (
              <p className={style.fallbackNotice}>{t('fallbackNotice')}</p>
            )}
            <div className={style.prose}>
              <Markdown remarkPlugins={[remarkGfm]}>{c.body}</Markdown>
            </div>
          </div>
        ))}
      />
    </main>
  )
}

export default AboutPage
