import { lazy } from 'react';
import type { ComponentType } from 'react';
import { Navigate } from 'react-router-dom';

import { SignIn } from '@/screens/SignIn/SignIn.tsx';
import { Home } from '@/screens/Home/Home.tsx';

// Sign-in and Home are the two possible first screens, so they ship in the main bundle. Every other
// screen is its own chunk (the QR scanner and QR generator libraries go with the screens that use
// them) and is prefetched once the app is up, so navigating never actually waits on the network.
const loadDeals = () => import('@/screens/Deals/Deals.tsx');
const loadProfile = () => import('@/screens/Profile/Profile.tsx');
const loadDealDetail = () => import('@/screens/DealDetail/DealDetail.tsx');
const loadWithdrawCrypto = () => import('@/screens/WithdrawCrypto/WithdrawCrypto.tsx');
const loadWithdrawFiat = () => import('@/screens/WithdrawFiat/WithdrawFiat.tsx');
const loadWithdrawRequisites = () => import('@/screens/WithdrawRequisites/WithdrawRequisites.tsx');
const loadPasswordRecovery = () => import('@/screens/PasswordRecovery/PasswordRecovery.tsx');
const loadNewPassword = () => import('@/screens/NewPassword/NewPassword.tsx');
const loadOtcUnavailable = () => import('@/screens/OtcUnavailable/OtcUnavailable.tsx');

const Deals = lazy(() => loadDeals().then((m) => ({ default: m.Deals })));
const Profile = lazy(() => loadProfile().then((m) => ({ default: m.Profile })));
const DealDetail = lazy(() => loadDealDetail().then((m) => ({ default: m.DealDetail })));
const WithdrawCrypto = lazy(() => loadWithdrawCrypto().then((m) => ({ default: m.WithdrawCrypto })));
const WithdrawFiat = lazy(() => loadWithdrawFiat().then((m) => ({ default: m.WithdrawFiat })));
const WithdrawRequisites = lazy(() => loadWithdrawRequisites().then((m) => ({ default: m.WithdrawRequisites })));
const PasswordRecovery = lazy(() => loadPasswordRecovery().then((m) => ({ default: m.PasswordRecovery })));
const NewPassword = lazy(() => loadNewPassword().then((m) => ({ default: m.NewPassword })));
const OtcUnavailable = lazy(() => loadOtcUnavailable().then((m) => ({ default: m.OtcUnavailable })));

/** Warms every lazy screen's chunk in the background — tab bar targets first. */
export function prefetchScreens(): void {
  for (const load of [
    loadDeals, loadProfile, loadDealDetail, loadWithdrawCrypto, loadWithdrawFiat,
    loadWithdrawRequisites, loadOtcUnavailable, loadPasswordRecovery, loadNewPassword,
  ]) {
    load().catch(() => undefined);
  }
}

export type HeaderVariant = 'close' | 'back' | 'home' | 'none';

export interface Route {
  path: string;
  Component: ComponentType;
  tabBar: boolean;
  headerVariant: HeaderVariant;
}

export const routes: Route[] = [
  { path: '/login', Component: () => <SignIn variant="business"/>, tabBar: false, headerVariant: 'close' },
  { path: '/login/personal', Component: () => <SignIn variant="personal"/>, tabBar: false, headerVariant: 'close' },
  { path: '/login/business', Component: () => <Navigate to="/login" replace/>, tabBar: false, headerVariant: 'none' },
  { path: '/forgot', Component: PasswordRecovery, tabBar: false, headerVariant: 'back' },
  { path: '/reset-password', Component: NewPassword, tabBar: false, headerVariant: 'back' },
  { path: '/otc-unavailable', Component: OtcUnavailable, tabBar: false, headerVariant: 'close' },
  { path: '/home', Component: Home, tabBar: true, headerVariant: 'home' },
  { path: '/deals', Component: Deals, tabBar: true, headerVariant: 'close' },
  { path: '/deals/:id', Component: DealDetail, tabBar: false, headerVariant: 'back' },
  { path: '/profile', Component: Profile, tabBar: true, headerVariant: 'home' },
  { path: '/withdraw/crypto', Component: WithdrawCrypto, tabBar: false, headerVariant: 'back' },
  { path: '/withdraw/fiat', Component: WithdrawFiat, tabBar: false, headerVariant: 'back' },
  { path: '/withdraw/fiat/requisites', Component: WithdrawRequisites, tabBar: false, headerVariant: 'back' },
];
