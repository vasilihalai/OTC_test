import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AssetGroup, BalanceScenario } from '@/api/index.ts';
import type { DealFilter } from '@/lib/dealStatus.ts';
import { balancesChanged } from '@/lib/queries.ts';

const SCENARIOS: BalanceScenario[] = ['sufficient', 'short1', 'short', 'belowmin'];

interface UiStore {
  selectedAssetGroup: AssetGroup;
  setSelectedAssetGroup: (group: AssetGroup) => void;
  /** The Deals tab's filter, kept while the app is open so going into a deal and back returns to the same list. */
  dealsFilter: DealFilter;
  setDealsFilter: (filter: DealFilter) => void;
  /** `null` = no dev override, deal detail shows the real deposit balance. */
  balanceScenario: BalanceScenario | null;
  cycleBalanceScenario: () => void;
  /** Bumped whenever a transfer/withdrawal changes account balances. Every balance on screen is
      re-read at once (`balancesChanged`); the deal's top-up screen watches this to re-read its card. */
  balancesVersion: number;
  bumpBalancesVersion: () => void;
  /** Home's "hide balances under $1" checkbox — the one setting here kept across launches. */
  hideSmallBalances: boolean;
  setHideSmallBalances: (hide: boolean) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      selectedAssetGroup: 'crypto',
      setSelectedAssetGroup: (group) => set({ selectedAssetGroup: group }),
      dealsFilter: 'ALL',
      setDealsFilter: (filter) => set({ dealsFilter: filter }),
      balanceScenario: null,
      cycleBalanceScenario: () => {
        const current = get().balanceScenario;
        const index = current ? SCENARIOS.indexOf(current) : -1;
        set({ balanceScenario: SCENARIOS[(index + 1) % SCENARIOS.length] });
      },
      balancesVersion: 0,
      bumpBalancesVersion: () => {
        balancesChanged();
        set((s) => ({ balancesVersion: s.balancesVersion + 1 }));
      },
      hideSmallBalances: false,
      setHideSmallBalances: (hide) => set({ hideSmallBalances: hide }),
    }),
    { name: 'xruby-ui', partialize: (s) => ({ hideSmallBalances: s.hideSmallBalances }) },
  ),
);
