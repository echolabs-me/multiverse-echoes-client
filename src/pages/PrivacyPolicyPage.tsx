import { LegalDocument } from '../components/LegalDocument.tsx';

/**
 * PrivacyPolicyPage — renders the structured Privacy Policy JSON via
 * LegalDocument. Source of truth is `src/content/legal/privacy.{locale}.json`.
 */
export function PrivacyPolicyPage() {
  return (
    <LegalDocument
      docName="privacy"
      metaDescription="Privacy Policy for Multiverse Echoes. How we collect, use, and protect your data. GDPR and CCPA compliant."
    />
  );
}
