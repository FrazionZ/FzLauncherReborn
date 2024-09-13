import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

import langEN from '@assets/translates/EN.json'
import langFR from '@assets/translates/FR.json'

const resources = {
  en: {
    translation: langEN
  },
  fr: {
    translation: langFR
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: 'fr',
    resources: resources,
    supportedLngs: ['en', 'fr'],
    fallbackLng: 'fr',
    debug: true,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;