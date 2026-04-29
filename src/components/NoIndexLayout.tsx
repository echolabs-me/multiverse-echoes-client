import { Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

/**
 * Layout wrapper that emits `<meta name="robots" content="noindex, nofollow">`
 * for every nested route.
 *
 * Used for pre-auth (register, login, verify, forgot/reset password, onboarding,
 * payment success/cancelled, tip) and any other route that should never surface
 * in search results. Authenticated app-shell routes emit the same directive
 * directly inside `AppLayout`.
 *
 * Why: without this, Googlebot happily crawls and tries to index sign-in pages
 * reached via external backlinks, and then files them as low-quality duplicates
 * of the home page (they share the SPA's index.html pre-hydration), surfacing
 * in GSC as "Crawled – currently not indexed." The noindex tag tells Googlebot
 * to both skip indexing AND not treat the page as content in canonical
 * consolidation.
 */
export function NoIndexLayout() {
  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Outlet />
    </>
  );
}
