import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { WebsiteNav } from './WebsiteNav.tsx';
import { WebsiteFooter } from './WebsiteFooter.tsx';
import { HreflangTags } from './HreflangTags.tsx';

export function WebsiteLayout() {
  const { pathname, hash } = useLocation();

  // Scroll to hash on navigation, or to top on route change
  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      // Small delay to allow DOM to render
      const timer = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)]">
      <HreflangTags />
      <WebsiteNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <WebsiteFooter />
    </div>
  );
}
