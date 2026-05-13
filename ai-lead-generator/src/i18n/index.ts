import en from './en.json'

type Translations = typeof en
type Locale = 'en'

const translations: Record<Locale, Translations> = { en }

let currentLocale: Locale = 'en'

export function t(path: string): string {
  const localeData = translations[currentLocale]
  const keys = path.split('.')
  let value: any = localeData
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      return path
    }
  }
  return typeof value === 'string' ? value : path
}

export function setLocale(locale: Locale) {
  if (locale in translations) {
    currentLocale = locale
  }
}

export function getLocale(): Locale {
  return currentLocale
}

export { en }
export type { Translations, Locale }
