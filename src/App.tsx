import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SkipLink, ToastContainer } from './components/index.ts';
import { LanguageSelectionPage } from './pages/LanguageSelectionPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { VerifyPendingPage } from './pages/VerifyPendingPage.tsx';
import { VerifiedPage } from './pages/VerifiedPage.tsx';

function hasSelectedLocale(): boolean {
  return localStorage.getItem('locale_selected') === 'true';
}

export function App() {
  return (
    <BrowserRouter>
      <SkipLink />
      <ToastContainer />
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
          {/* Placeholder routes — built in subsequent steps */}
          <Route path="/login" element={<PlaceholderPage title="Login" />} />
          <Route path="/onboarding/*" element={<PlaceholderPage title="Onboarding" />} />
          <Route path="/dashboard" element={<PlaceholderPage title="Dashboard" />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas text-text-primary">
      <h1 className="text-2xl font-semibold">{title}</h1>
    </div>
  );
}
