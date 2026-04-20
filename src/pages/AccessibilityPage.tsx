import { LegalDocument } from '../components/LegalDocument.tsx';

/**
 * AccessibilityPage — renders the structured Accessibility Statement via
 * LegalDocument. Source of truth is `src/content/legal/accessibility.{locale}.json`.
 */
export function AccessibilityPage() {
  return (
    <LegalDocument
      docName="accessibility"
      metaDescription="Accessibility statement for Multiverse Echoes. WCAG 2.1 Level AA commitment, keyboard navigation, screen reader support."
    />
  );
}
