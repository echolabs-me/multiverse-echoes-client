import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { SkipLink, ToastContainer } from './components/index.ts';
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
import { NotFoundPage } from './pages/NotFoundPage.tsx';

function hasSelectedLocale(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem('locale_selected') === 'true';
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
        <Routes>
          {/* Root: flag page or redirect to /home */}
          <Route
            path="/"
            element={
              hasSelectedLocale() ? (
                <Navigate to="/home" replace />
              ) : (
                <LanguageSelectionPage />
              )
            }
          />

          {/* Public website routes — with website nav + footer */}
          <Route element={<WebsiteLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/waitlist" element={<WaitlistPage />} />
            <Route path="/contact" element={<ContactPage />} />
          </Route>

          {/* Legacy routes — redirect to new paths */}
          <Route path="/language" element={<Navigate to="/" replace />} />
          <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
          <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />

          {/* Pre-auth routes — no app shell */}
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-pending" element={<VerifyPendingPage />} />
          <Route path="/verified" element={<VerifiedPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/onboarding/welcome" element={<OnboardingWelcomePage />} />
          <Route path="/onboarding/profile" element={<OnboardingProfilePage />} />
          <Route path="/onboarding/create-echo" element={<EchoCreationPage />} />
          <Route path="/accessibility" element={<AccessibilityPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/cancelled" element={<PaymentCancelledPage />} />
          <Route path="/tip" element={<TipPage />} />

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
          </Route>

          {/* 404 catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}
