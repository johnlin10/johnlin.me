type Language = {
  displayName: string
}

export const languages: Record<string, Language> = {
  en: {
    displayName: 'English',
  },
  'zh-tw': {
    displayName: '繁體中文（台灣）',
  },
}

export const getLanguageDisplayName = (locale: string) => {
  return languages[locale as keyof typeof languages].displayName
}
