import { Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { HashRouter, matchPath, Navigate, NavigationType, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';

import { type Route as AppRoute, prefetchScreens, routes } from '@/navigation/routes.tsx';
import { Toast } from '@/components/Toast/Toast.tsx';
import { AppHeader } from '@/components/AppHeader/AppHeader.tsx';
import { TabBar } from '@/components/TabBar/TabBar.tsx';
import { TransferModal } from '@/components/TransferModal/TransferModal.tsx';
import { BrandLoader } from '@/components/BrandLoader/BrandLoader.tsx';
import { useSessionStore } from '@/store/session.ts';
import { useAppBackButton, useGoBack } from '@/telegram/backButton.ts';

// The first screen's own requests go out first; the other screens' chunks follow once the browser is idle.
const PREFETCH_DELAY_MS = 400;

function Entry() {
  const session = useSessionStore((s) => s.session);
  return <Navigate to={session ? '/home' : '/login'} replace/>;
}

type PageTransition = 'settle' | 'forward' | 'back';

/**
 * Where the new screen comes from. Going deeper it arrives from the right, going back the previous
 * one returns from the left; a tab, a replaced screen or the very first one settles in place.
 */
function transitionFor(navigation: NavigationType, from: AppRoute | undefined, to: AppRoute | undefined): PageTransition {
  if (!from || !to || (from.tabBar && to.tabBar) || navigation === NavigationType.Replace) {
    return 'settle';
  }
  return navigation === NavigationType.Pop ? 'back' : 'forward';
}

function Shell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const goBack = useGoBack();
  useAppBackButton();

  useEffect(() => {
    const timer = setTimeout(prefetchScreens, PREFETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const matched = routes.find((r) => matchPath(r.path, location.pathname));
  const headerVariant = matched?.headerVariant ?? 'none';
  const showTabBar = matched?.tabBar ?? false;

  // The screen before this one, to tell which way the new one should arrive.
  const previous = useRef<{ pathname: string; route: AppRoute | undefined }>();
  const transition = previous.current && previous.current.pathname !== location.pathname
    ? transitionFor(navigationType, previous.current.route, matched)
    : 'settle';
  const transitionRef = useRef(transition);
  if (previous.current?.pathname !== location.pathname) {
    transitionRef.current = transition;
  }
  useEffect(() => {
    previous.current = { pathname: location.pathname, route: matched };
  });

  // Every screen scrolls inside the same container. A new screen starts at its top; going back
  // returns to where that screen was left — its list comes from memory, so it is tall enough at once.
  const contentRef = useRef<HTMLElement>(null);
  const scrolls = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    const key = location.key;
    content.scrollTop = navigationType === NavigationType.Pop ? scrolls.current.get(key) ?? 0 : 0;
    const remember = () => {
      scrolls.current.set(key, content.scrollTop);
    };
    content.addEventListener('scroll', remember, { passive: true });
    return () => content.removeEventListener('scroll', remember);
  }, [location.key, navigationType]);

  const Fallback = matched?.Fallback ?? BrandLoader;
  const pageClass = transitionRef.current === 'settle' ? 'app-content__page' : `app-content__page app-content__page--${transitionRef.current}`;

  return (
    <div className="app-shell">
      <AppHeader variant={headerVariant} onBack={goBack}/>
      <main ref={contentRef} className={showTabBar ? 'app-content app-content--with-tab-bar' : 'app-content'}>
        <div key={location.pathname} className={pageClass}>
          <Suspense fallback={<Fallback/>}>
            <Routes>
              <Route path="/" element={<Entry/>}/>
              {routes.map(({ path, Component }) => <Route key={path} path={path} Component={Component}/>)}
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
  return (
    <HashRouter>
      <Shell/>
    </HashRouter>
  );
}
