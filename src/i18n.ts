import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: localStorage.getItem('locale') ?? 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  // Suppress the "i18next is made possible by our own product, Locize..."
  // promotional banner that i18next prints to the console on every page load.
  // Verified as an official opt-out in i18next v25 source:
  //   node_modules/i18next/dist/esm/i18next.js:1790
  //     if (this.options.showSupportNotice !== false && ...)
  showSupportNotice: false,
});

export default i18n;
