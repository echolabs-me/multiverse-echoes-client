import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { OraclePanel, SkipLink, ToastContainer } from './components/index.ts';
import { LanguageSelectionPage } from './pages/LanguageSelectionPage.tsx';
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
import { LoginPage } from './pages/LoginPage.tsx';

function hasSelectedLocale(): boolean {
  return localStorage.getItem('locale_selected') === 'true';
}

export function App() {
  return (
    <BrowserRouter>
      <SkipLink />
      <ToastContainer />
      <OraclePanel />
      <main id="main-content">
        <Routes>
          <Route
            path="/"
            element={
              hasSelectedLocale() ? (
                <Navigate to="/login" replace />
              ) : (
                <Navigate to="/language" replace />
              )
            }
          />
          <Route path="/language" element={<LanguageSelectionPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-pending" element={<VerifyPendingPage />} />
          <Route path="/verified" element={<VerifiedPage />} />
          <Route path="/onboarding/welcome" element={<OnboardingWelcomePage />} />
          <Route path="/onboarding/profile" element={<OnboardingProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding/create-echo" element={<EchoCreationPage />} />
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
          <Route path="/waitlist" element={<WaitlistPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
