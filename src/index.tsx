// Include Telegram UI styles first to allow our code override the package CSS.
import '@telegram-apps/telegram-ui/dist/styles.css';

import ReactDOM from 'react-dom/client';
import { StrictMode } from 'react';
import { retrieveLaunchParams } from '@tma.js/sdk-react';

import { Root } from '@/components/Root.tsx';
import { EnvUnsupported } from '@/components/EnvUnsupported.tsx';
import { init } from '@/init.ts';
import { ensureTelegramEnvironment } from '@/telegram/environment.ts';
import { USE_REAL_API, exchangeSocialCode, getUser } from '@/api/index.ts';
import { authenticateMiniApp } from '@/api/real/miniAppAuth.ts';
import { getFreshInitData } from '@/telegram/initData.ts';
import { getLastClientType } from '@/lib/lastClientType.ts';
import {
  getAccessToken,
  hydrateTokensFromStorage,
  refreshTokens,
  setReauthenticator,
} from '@/api/real/http/tokenStore.ts';
import { useSessionStore } from '@/store/session.ts';
import type { ClientType } from '@/api/types.ts';

import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

async function tryCompleteSocialSignIn(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const clientType = params.get('ct') as ClientType | null;
  if (!code || !state || !clientType) {
    return;
  }
  try {
    // Disabled/unreconciled with the Telegram-binding flow — see
    // `exchangeSocialCode`'s own comment. Unreachable in practice: this only
    // runs if `code`/`state`/`ct` are in the URL, which only happens after
    // `startSocialSignIn()` was called, which only happens from the
    // Google/Apple buttons, currently hidden (`SignIn.tsx`).
    const result = await exchangeSocialCode(code, state);
    useSessionStore.getState().setSession({ email: result.email, clientType });
  } catch {
    // Provider/exchange failure — the user still has email+password (§2.2).
  } finally {
    // Strip the OAuth params either way so a refresh doesn't re-run this.
    const clean = new URL(window.location.href);
    clean.search = '';
    window.history.replaceState(null, '', clean.toString());
  }
}

// No top-level await: some Telegram clients' embedded webview engines (notably
// older Telegram Desktop builds) fail to parse a module using it at all, which
// silently renders a blank screen instead of the app.
void (async () => {
  try {
    // Mocks the environment when running outside real Telegram (including in
    // production), so retrieveLaunchParams() below always has something to read.
    await ensureTelegramEnvironment();

    const launchParams = retrieveLaunchParams();
    const { tgWebAppPlatform: platform } = launchParams;
    const debug = (launchParams.tgWebAppStartParam || '').includes('debug')
      || import.meta.env.DEV;

    // Configure all application dependencies.
    await init({
      debug,
      eruda: debug && ['ios', 'android'].includes(platform),
      mockForMacOS: platform === 'macos',
    });

    // Telegram-binding boot flow (backend-confirmed, superseding the old
    // x-telegram-init-data one-shot header entirely — see
    // `real/miniAppAuth.ts`'s own comment for the full contract). Every
    // cold boot in real mode tries a *silent* re-entry before ever showing
    // the login screen: if this Telegram identity is already bound to a
    // platform account, the backend hands back a session with no
    // login/password/2FA involved. `SignIn.tsx` only ever renders because
    // this came back empty-handed — either genuinely unbound, or (since any
    // non-2xx here is read the same way, see `authenticateMiniApp`'s own
    // comment) a transient failure; either way the standard email+password
    // flow is always there as the fallback.
    if (USE_REAL_API) {
      // Wired once, here — `tokenStore` itself stays free of any
      // Telegram/mini-app-specific import, see its own comment. This same
      // callback is what a lapsed access token re-runs mid-session too, not
      // just at boot: this client's access token has no refresh_token at
      // all, so "refreshing" it is always another `authenticateMiniApp` call.
      setReauthenticator(async () => {
        const initData = getFreshInitData();
        if (!initData) {
          throw new Error('No Telegram initData available');
        }
        return authenticateMiniApp(initData);
      });

      // Restores an access token that survived a same-tab reload, if any —
      // skips the network round trip below when it's still valid.
      hydrateTokensFromStorage();
      if (!getAccessToken()) {
        try {
          await refreshTokens(); // unconditionally invokes the reauthenticator above
        } catch {
          // No binding yet (or a transient failure) — fall through with no
          // token; Entry (App.tsx) has no session to route to /home with,
          // so the login screen renders normally.
        }
      }

      if (getAccessToken()) {
        try {
          // The mini-app access token carries no account-type field to read
          // back (`lib/lastClientType.ts`'s own comment) — this is purely a
          // display label, session-derived data everywhere else.
          const clientType = getLastClientType();
          const profile = await getUser(clientType);
          useSessionStore.getState().setSession({ email: profile.email, clientType });
        } catch {
          // Got a token but the profile fetch failed — leave session unset
          // rather than show a half-populated app; the next real API call
          // still has a valid token to work with via `ensureFreshAccessToken`.
        }
      }

      // Best-effort completion of Google/Apple sign-in (§2.2, question B3) —
      // only relevant if this relaunch happens to carry the OAuth
      // provider's redirect params; on every other boot this is a no-op
      // `URLSearchParams` read, not a network call.
      await tryCompleteSocialSignIn();
    }

    root.render(
      <StrictMode>
        <Root/>
      </StrictMode>,
    );
  } catch {
    root.render(<EnvUnsupported/>);
  }
})();
