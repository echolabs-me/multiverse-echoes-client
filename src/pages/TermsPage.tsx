import { LegalDocument } from '../components/LegalDocument.tsx';

/**
 * TermsPage — renders the structured Terms of Service JSON via LegalDocument.
 * Source of truth is `src/content/legal/terms.{locale}.json`; LegalDocument
 * handles lazy-loading, fallback, and markdown-inline rendering.
 */
export function TermsPage() {
  return (
    <LegalDocument
      docName="terms"
      metaDescription="Terms of Service for Multiverse Echoes. Governs use of the platform, Echo creation, and community guidelines."
    />
  );
}
