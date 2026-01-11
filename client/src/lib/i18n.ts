import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
];

const savedLanguage = typeof window !== 'undefined' 
  ? localStorage.getItem('i18nextLng') || 'en' 
  : 'en';

const loadLocale = async (lng: string): Promise<Record<string, any>> => {
  switch (lng) {
    case 'es':
      return (await import('../locales/es.json')).default;
    case 'fr':
      return (await import('../locales/fr.json')).default;
    case 'zh':
      return (await import('../locales/zh.json')).default;
    case 'ar':
      return (await import('../locales/ar.json')).default;
    case 'hi':
      return (await import('../locales/hi.json')).default;
    case 'pt':
      return (await import('../locales/pt.json')).default;
    case 'de':
      return (await import('../locales/de.json')).default;
    case 'ja':
      return (await import('../locales/ja.json')).default;
    case 'ko':
      return (await import('../locales/ko.json')).default;
    default:
      return en;
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

if (savedLanguage !== 'en') {
  loadLocale(savedLanguage).then((translations) => {
    i18n.addResourceBundle(savedLanguage, 'translation', translations, true, true);
    i18n.changeLanguage(savedLanguage);
  });
}

const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lng?: string) => {
  if (lng && lng !== 'en' && !i18n.hasResourceBundle(lng, 'translation')) {
    const translations = await loadLocale(lng);
    i18n.addResourceBundle(lng, 'translation', translations, true, true);
  }
  return originalChangeLanguage(lng);
};

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('i18nextLng', lng);
    const isRtl = languages.find(l => l.code === lng)?.rtl;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
  }
});

if (typeof window !== 'undefined') {
  const isRtl = languages.find(l => l.code === savedLanguage)?.rtl;
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  document.documentElement.lang = savedLanguage;
}

export default i18n;
