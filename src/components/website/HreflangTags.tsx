import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SUPPORTED_LOCALES = [
  'en', 'zh-Hans', 'hi', 'es', 'ar', 'fr', 'bn', 'pt-BR',
  'ru', 'ur', 'id', 'de', 'ja', 'vi', 'tr', 'ko', 'tl', 'it', 'th', 'ms',
];

const BASE_URL = 'https://echolabsme.com';

export function HreflangTags() {
  const { pathname } = useLocation();

  return (
    <Helmet>
      {SUPPORTED_LOCALES.map((locale) => (
        <link
          key={locale}
          rel="alternate"
          hrefLang={locale}
          href={`${BASE_URL}${pathname}?lng=${locale}`}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${BASE_URL}/`} />
    </Helmet>
  );
}
