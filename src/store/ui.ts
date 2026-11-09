import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { invalidateBalances } from '@/api/index.ts';
import type { AssetGroup, BalanceScenario } from '@/api/index.ts';

const SCENARIOS: BalanceScenario[] = ['sufficient', 'short1', 'short', 'belowmin'];

interface UiStore {
  selectedAssetGroup: AssetGroup;
  setSelectedAssetGroup: (group: AssetGroup) => void;
  /** `null` = no dev override, deal detail shows the real deposit balance. */
  balanceScenario: BalanceScenario | null;
  cycleBalanceScenario: () => void;
  /** Bumped whenever a transfer/withdrawal changes account balances, so screens
      that read them (deal confirmation, Home, withdrawals) know to refetch. */
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
      balanceScenario: null,
      cycleBalanceScenario: () => {
        const current = get().balanceScenario;
        const index = current ? SCENARIOS.indexOf(current) : -1;
        set({ balanceScenario: SCENARIOS[(index + 1) % SCENARIOS.length] });
      },
      balancesVersion: 0,
      bumpBalancesVersion: () => {
        invalidateBalances();
        set((s) => ({ balancesVersion: s.balancesVersion + 1 }));
      },
      hideSmallBalances: false,
      setHideSmallBalances: (hide) => set({ hideSmallBalances: hide }),
    }),
    { name: 'xruby-ui', partialize: (s) => ({ hideSmallBalances: s.hideSmallBalances }) },
  ),
);
