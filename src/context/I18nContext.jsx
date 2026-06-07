import { createContext, useContext, useState, useEffect } from 'react'
import zhTW from '../locales/zh-TW.json'
import en from '../locales/en.json'

const LOCALES = { 'zh-TW': zhTW, en }

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('zh-TW')

  useEffect(() => {
    window.api?.settings.getAll().then(s => {
      if (s.language && LOCALES[s.language]) setLang(s.language)
    }).catch(() => {})
  }, [])

  function t(path) {
    const keys = path.split('.')
    let val = LOCALES[lang]
    for (const k of keys) {
      val = val?.[k]
      if (val === undefined) return path
    }
    return val
  }

  async function changeLang(newLang) {
    setLang(newLang)
    await window.api?.settings.set('language', newLang)
  }

  return (
    <I18nContext.Provider value={{ lang, t, changeLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
