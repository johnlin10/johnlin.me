type Language = {
  displayName: string
  shortName: string
  /** 語言自稱，短到能並排當選項用（displayName 太長、shortName 太密碼） */
  nativeName: string
}

export const languages: Record<string, Language> = {
  en: {
    displayName: 'English',
    shortName: 'EN',
    nativeName: 'English',
  },
  'zh-tw': {
    displayName: '繁體中文（台灣）',
    shortName: 'TW',
    nativeName: '中文',
  },
}

export const getLanguageDisplayName = (locale: string) => {
  return languages[locale as keyof typeof languages].displayName
}
