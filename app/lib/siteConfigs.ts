export const SITE_CONFIG = {
  version: '1.0',
  name: {
    zh_tw: 'John Lin | 林昌龍',
    en: 'John Lin',
  },
  shortName: {
    zh_tw: 'John Lin',
    en: 'John Lin',
  },
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://johnlin.me').replace(
    /\/$/,
    ''
  ),
  locale: 'zh-TW',
  creator: {
    zh_tw: '林昌龍',
    en: 'John Lin',
  },
  publisher: {
    zh_tw: '林昌龍',
    en: 'John Lin',
  },
  keywords: [
    'John Lin',
    '林昌龍',
    'John',
    '昌龍',
    'Web Design',
    '網頁設計',
    'Blog',
    '部落格',
    'Personal Website',
    '個人網站',
    'Portfolio',
    '作品集',
    'Web Development',
    '網站開發',
    'Website Developer',
    '網站開發者',
    'Full-stack Engineer',
    '全端工程師',
    'Full-stack Developer',
    '全端開發者',
    'Web Designer',
    '網頁設計師',
  ],
} as const
