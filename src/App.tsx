import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, type SupportedLocale } from './i18n.ts';
import { ErrorBoundary, SkipLink, ToastContainer } from './components/index.ts';
import { AppLayout } from './components/AppLayout.tsx';
import { WebsiteLayout } from './components/website/WebsiteLayout.tsx';
import { useAuthStore } from './stores/useAuthStore.ts';
import { LanguageSelectionPage } from './pages/LanguageSelectionPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { VerifyPendingPage } from './pages/VerifyPendingPage.tsx';
import { VerifiedPage } from './pages/VerifiedPage.tsx';
import { OnboardingWelcomePage } from './pages/OnboardingWelcomePage.tsx';
import { OnboardingProfilePage } from './pages/OnboardingProfilePage.tsx';
import { EchoCreationPage } from './pages/EchoCreationPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { EchoDetailPage } from './pages/EchoDetailPage.tsx';
import { ShardViewPage } from './pages/ShardViewPage.tsx';
import { ShardBrowserPage } from './pages/ShardBrowserPage.tsx';
import { PersonalFeedPage } from './pages/PersonalFeedPage.tsx';
import { SocialFeedPage } from './pages/SocialFeedPage.tsx';
import { CommunityPage } from './pages/CommunityPage.tsx';
import { NotificationsPage } from './pages/NotificationsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { DeleteAccountPage } from './pages/DeleteAccountPage.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { EchoConversationPage } from './pages/EchoConversationPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { WaitlistPage } from './pages/WaitlistPage.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.tsx';
import { ResetPasswordPage } from './pages/ResetPasswordPage.tsx';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage.tsx';
import { TermsPage } from './pages/TermsPage.tsx';
import { AccessibilityPage } from './pages/AccessibilityPage.tsx';
import { PlansPage } from './pages/PlansPage.tsx';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage.tsx';
import { PaymentCancelledPage } from './pages/PaymentCancelledPage.tsx';
import { TipPage } from './pages/TipPage.tsx';
import { DowngradeChoicePage } from './pages/DowngradeChoicePage.tsx';
import { DowngradeConfirmPage } from './pages/DowngradeConfirmPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { NoIndexLayout } from './components/NoIndexLayout.tsx';

function hasSelectedLocale(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem('locale_selected') === 'true';
}

/**
 * Compute the post-flag-page landing URL for a return visitor.
 * English (the default) -> `/home`; any other supported locale -> `/{locale}/home`.
 * Fallback to `/home` if the stored locale has gone stale or unsupported.
 */
function rememberedHome(): string {
  if (typeof localStorage === 'undefined') return '/home';
  const stored = localStorage.getItem('locale');
  if (!stored || !(SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
    return '/home';
  }
  return stored === 'en' ? '/home' : `/${stored}/home`;
}

/**
 * Route wrapper for locale-prefixed URLs (e.g. `/es/home`, `/zh-Hant/plans`).
 *
 * Responsibilities:
 *   1. Validate the URL's `:locale` segment against SUPPORTED_LOCALES.
 *     If invalid, render the 404 page so we don't serve a broken localized
 *     page under a bogus locale code (important for SEO — no ghost URLs).
 *   2. On client-side navigation INTO a locale prefix (e.g. user switching
 *     from `/home` to `/es/home` via the language picker), call
 *     `i18n.changeLanguage(locale)` so the page re-renders in that locale
 *     and `<html lang>`/`<html dir>` update via the languageChanged hook.
 *
 * Bootstrap-time (initial page load) locale resolution happens in
 * `resolveInitialLocale()` in `i18n.ts`, which reads the URL path prefix
 * directly. That covers the SSR/prerender case where this component's
 * `useEffect` hasn't run yet.
 */
function LocaleRoute() {
  const { locale } = useParams<{ locale: string }>();
  const { i18n } = useTranslation();
  const isValid =
    !!locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale);

  useEffect(() => {
    if (isValid && locale && i18n.language !== locale) {
      void i18n.changeLanguage(locale as SupportedLocale);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('locale', locale);
        localStorage.setItem('locale_selected', 'true');
      }
    }
  }, [locale, isValid, i18n]);

  if (!isValid) {
    return <NotFoundPage />;
  }
  return <Outlet />;
}

export function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <HelmetProvider>
      <BrowserRouter>
        <SkipLink />
        <ToastContainer />
        <ErrorBoundary>
        <Routes>
          {/* Root: flag page for first-touch visitors; return visitors skip
              it and go straight to their remembered locale's home. */}
          <Route
            path="/"
            element={
              hasSelectedLocale() ? (
                <Navigate to={rememberedHome()} replace />
              ) : (
                <LanguageSelectionPage />
              )
            }
          />

          {/* Public website routes — English (unprefixed). */}
          <Route element={<WebsiteLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/waitlist" element={<WaitlistPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/accessibility" element={<AccessibilityPage />} />
            <Route path="/plans" element={<PlansPage />} />
          </Route>

          {/* Public website routes — locale-prefixed (e.g. /es/home, /zh-Hant/plans).
              English lives at the unprefixed root above per convention; the
              other 20 locales live here. LocaleRoute validates the :locale
              param and calls i18n.changeLanguage on client-side navigation. */}
          <Route path="/:locale" element={<LocaleRoute />}>
            <Route index element={<Navigate to="home" replace />} />
            <Route element={<WebsiteLayout />}>
              <Route path="home" element={<HomePage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="terms" element={<TermsPage />} />
              <Route path="privacy" element={<PrivacyPolicyPage />} />
              <Route path="waitlist" element={<WaitlistPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="accessibility" element={<AccessibilityPage />} />
              <Route path="plans" element={<PlansPage />} />
            </Route>
          </Route>

          {/* Legacy routes — redirect to new paths */}
          <Route path="/language" element={<Navigate to="/" replace />} />
          <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
          <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />

          {/* Pre-auth routes — no app shell. Wrapped in NoIndexLayout so every
              sign-up/sign-in/onboarding/payment URL carries
              `<meta name="robots" content="noindex, nofollow">`. Without this,
              Googlebot follows external backlinks into these routes and files
              them as low-quality duplicates of the home page (they share the
              SPA index.html pre-hydration), which surfaces in Search Console
              as "Crawled – currently not indexed." */}
          <Route element={<NoIndexLayout />}>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-pending" element={<VerifyPendingPage />} />
            <Route path="/verified" element={<VerifiedPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/onboarding/welcome" element={<OnboardingWelcomePage />} />
            <Route path="/onboarding/profile" element={<OnboardingProfilePage />} />
            <Route path="/onboarding/create-echo" element={<EchoCreationPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/cancelled" element={<PaymentCancelledPage />} />
            <Route path="/tip" element={<TipPage />} />
          </Route>

          {/* App shell routes — NavSidebar + Oracle sidebar */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/echoes/:echoId" element={<EchoDetailPage />} />
            <Route path="/echoes/:echoId/talk" element={<EchoConversationPage />} />
            <Route path="/shards/browse" element={<ShardBrowserPage />} />
            <Route path="/shards/:shardId" element={<ShardViewPage />} />
            <Route path="/feeds/personal" element={<PersonalFeedPage />} />
            <Route path="/feeds/social" element={<SocialFeedPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/settings/delete-account" element={<DeleteAccountPage />} />
            {/* ME-MIS-001 §5.2 Surface C — the informed-consent
                screen gates entry to the per-shard decision flow.
                DowngradeChoicePage itself checks for `?consented=1`
                and redirects here if missing, so even a direct URL
                hit to /downgrade-choice funnels through this page
                first. */}
            <Route
              path="/subscription/downgrade-confirm"
              element={<DowngradeConfirmPage />}
            />
            <Route
              path="/subscription/downgrade-choice"
              element={<DowngradeChoicePage />}
            />
          </Route>

          {/* 404 catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </HelmetProvider>
  );
}
