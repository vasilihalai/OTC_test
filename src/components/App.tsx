import { Suspense, useEffect } from 'react';
import { HashRouter, matchPath, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useLaunchParams } from '@tma.js/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';

import { prefetchScreens, routes } from '@/navigation/routes.tsx';
import { Toast } from '@/components/Toast/Toast.tsx';
import { AppHeader } from '@/components/AppHeader/AppHeader.tsx';
import { TabBar } from '@/components/TabBar/TabBar.tsx';
import { TransferModal } from '@/components/TransferModal/TransferModal.tsx';
import { Spinner } from '@/components/Spinner/Spinner.tsx';
import { useSessionStore } from '@/store/session.ts';
import { useAppBackButton, useGoBack } from '@/telegram/backButton.ts';

// Lets the first screen's own requests go out before the other screens' chunks are fetched.
const PREFETCH_DELAY_MS = 1500;

function Entry() {
  const session = useSessionStore((s) => s.session);
  return <Navigate to={session ? '/home' : '/login'} replace/>;
}

/** Shown while a lazily loaded screen's chunk arrives — normally never, thanks to the prefetch. */
function PageLoader() {
  return (
    <div className="page-loader">
      <Spinner size={28}/>
    </div>
  );
}

function Shell() {
  const location = useLocation();
  const goBack = useGoBack();
  useAppBackButton();

  useEffect(() => {
    const timer = setTimeout(prefetchScreens, PREFETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const matched = routes.find((r) => matchPath(r.path, location.pathname));
  const headerVariant = matched?.headerVariant ?? 'none';
  const showTabBar = matched?.tabBar ?? false;

  return (
    <div className="app-shell">
      <AppHeader variant={headerVariant} onBack={goBack}/>
      <main className={showTabBar ? 'app-content app-content--with-tab-bar' : 'app-content'}>
        <div key={location.pathname} className="app-content__page">
          <Suspense fallback={<PageLoader/>}>
            <Routes>
              <Route path="/" element={<Entry/>}/>
              {routes.map((route) => <Route key={route.path} {...route} />)}
              <Route path="*" element={<Navigate to="/"/>}/>
            </Routes>
          </Suspense>
        </div>
      </main>
      {showTabBar && <TabBar/>}
      <Toast/>
      <TransferModal/>
    </div>
  );
}

// xRuby always renders dark, regardless of the user's Telegram theme.
export function App() {
  const lp = useLaunchParams();

  return (
    <AppRoot
      appearance="dark"
      platform={['macos', 'ios'].includes(lp.tgWebAppPlatform) ? 'ios' : 'base'}
    >
      <HashRouter>
        <Shell/>
      </HashRouter>
    </AppRoot>
  );
}
