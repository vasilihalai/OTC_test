import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { bem } from '@/css/bem.ts';
import { ru } from '@/i18n/ru.ts';
import { DealsIcon, HomeIcon, ProfileIcon } from '@/components/TabBar/icons.tsx';
import { hapticSelection } from '@/telegram/adapter.ts';

import './TabBar.css';

const [b, e] = bem('tab-bar');

const TABS = [
  { path: '/home', label: ru.nav.home, Icon: HomeIcon },
  { path: '/deals', label: ru.nav.deals, Icon: DealsIcon },
  { path: '/profile', label: ru.nav.profile, Icon: ProfileIcon },
] as const;

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  // Only a tab the user has just tapped gets the little bounce — not the one the bar opens on.
  const [chosen, setChosen] = useState<string>();

  function open(path: string) {
    if (path !== location.pathname) {
      hapticSelection();
      setChosen(path);
      navigate(path);
    }
  }

  return (
    <nav className={b()}>
      {TABS.map(({ path, label, Icon }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            type="button"
            className={e('tab', { active, chosen: active && chosen === path })}
            aria-current={active ? 'page' : undefined}
            onClick={() => open(path)}
          >
            <Icon/>
            <span className={e('label')}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
