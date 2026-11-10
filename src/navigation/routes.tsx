import { lazy, useState } from 'react';
import type { ComponentType } from 'react';
import { Navigate } from 'react-router-dom';

import { SignIn } from '@/screens/SignIn/SignIn.tsx';
import { Home } from '@/screens/Home/Home.tsx';
import { Deals } from '@/screens/Deals/Deals.tsx';
import { Profile } from '@/screens/Profile/Profile.tsx';
import { DealDetailSkeleton } from '@/screens/DealDetail/DealDetailSkeleton.tsx';
import { WithdrawCryptoSkeleton } from '@/screens/WithdrawCrypto/WithdrawCryptoSkeleton.tsx';
import { WithdrawFiatSkeleton } from '@/screens/WithdrawFiat/WithdrawFiatSkeleton.tsx';

/**
 * A screen in its own chunk. `React.lazy` alone shows the fallback for a frame even when the chunk is
 * already in memory (its first render always suspends); here a chunk that has been warmed up renders
 * straight away, and only one still on its way goes through the fallback.
 */
function lazyScreen(load: () => Promise<ComponentType>): { Screen: ComponentType; warm: () => void } {
  let Loaded: ComponentType | undefined;
  let loading: Promise<{ default: ComponentType }> | undefined;
  const loadOnce = () => {
    loading ??= load().then((component) => {
      Loaded = component;
      return { default: component };
    });
    // A failed download must be retried by the next attempt, not remembered.
    loading.catch(() => {
      loading = undefined;
    });
    return loading;
  };
  const Lazy = lazy(loadOnce);
  function Screen() {
    // Chosen once per visit: switching from the lazy wrapper to the loaded screen mid-visit would remount it.
    const [Component] = useState<ComponentType>(() => Loaded ?? Lazy);
    return <Component/>;
  }
  return { Screen, warm: () => void loadOnce().catch(() => undefined) };
}

// Sign-in and the three tabs ship in the main bundle: a first screen or a tab must never wait for
// code. Every deeper screen is its own chunk, warmed up once the app is on screen (`prefetchScreens`);
// if one is opened before its chunk is in, the route shows that screen's own skeleton (`Fallback`),
// not a spinner. The QR scanner and the QR generator are fetched only where they are used.
const dealDetail = lazyScreen(() => import('@/screens/DealDetail/DealDetail.tsx').then((m) => m.DealDetail));
const withdrawCrypto = lazyScreen(() => import('@/screens/WithdrawCrypto/WithdrawCrypto.tsx').then((m) => m.WithdrawCrypto));
const withdrawFiat = lazyScreen(() => import('@/screens/WithdrawFiat/WithdrawFiat.tsx').then((m) => m.WithdrawFiat));
const withdrawRequisites = lazyScreen(() => import('@/screens/WithdrawRequisites/WithdrawRequisites.tsx').then((m) => m.WithdrawRequisites));
const passwordRecovery = lazyScreen(() => import('@/screens/PasswordRecovery/PasswordRecovery.tsx').then((m) => m.PasswordRecovery));
const newPassword = lazyScreen(() => import('@/screens/NewPassword/NewPassword.tsx').then((m) => m.NewPassword));
const otcUnavailable = lazyScreen(() => import('@/screens/OtcUnavailable/OtcUnavailable.tsx').then((m) => m.OtcUnavailable));

/** Warms every lazy screen's chunk in the background — the ones a signed-in client reaches first go first. */
export function prefetchScreens(): void {
  for (const screen of [dealDetail, withdrawCrypto, withdrawFiat, withdrawRequisites, otcUnavailable, passwordRecovery, newPassword]) {
    screen.warm();
  }
}

export type HeaderVariant = 'close' | 'back' | 'home' | 'none';

export interface Route {
  path: string;
  Component: ComponentType;
  tabBar: boolean;
  headerVariant: HeaderVariant;
  /** Shown in the screen's place while its chunk loads. Without one, the brand loader. */
  Fallback?: ComponentType;
}

export const routes: Route[] = [
  { path: '/login', Component: () => <SignIn variant="business"/>, tabBar: false, headerVariant: 'close' },
  { path: '/login/personal', Component: () => <SignIn variant="personal"/>, tabBar: false, headerVariant: 'close' },
  { path: '/login/business', Component: () => <Navigate to="/login" replace/>, tabBar: false, headerVariant: 'none' },
  { path: '/forgot', Component: passwordRecovery.Screen, tabBar: false, headerVariant: 'back' },
  { path: '/reset-password', Component: newPassword.Screen, tabBar: false, headerVariant: 'back' },
  { path: '/otc-unavailable', Component: otcUnavailable.Screen, tabBar: false, headerVariant: 'close' },
  { path: '/home', Component: Home, tabBar: true, headerVariant: 'home' },
  { path: '/deals', Component: Deals, tabBar: true, headerVariant: 'close' },
  { path: '/deals/:id', Component: dealDetail.Screen, tabBar: false, headerVariant: 'back', Fallback: DealDetailSkeleton },
  { path: '/profile', Component: Profile, tabBar: true, headerVariant: 'home' },
  { path: '/withdraw/crypto', Component: withdrawCrypto.Screen, tabBar: false, headerVariant: 'back', Fallback: WithdrawCryptoSkeleton },
  { path: '/withdraw/fiat', Component: withdrawFiat.Screen, tabBar: false, headerVariant: 'back', Fallback: WithdrawFiatSkeleton },
  { path: '/withdraw/fiat/requisites', Component: withdrawRequisites.Screen, tabBar: false, headerVariant: 'back' },
];
