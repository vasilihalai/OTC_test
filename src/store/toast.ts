import { create } from 'zustand';

/** `notice` carries the frame's orange mark and stays on screen longer. */
export type ToastTone = 'plain' | 'notice';

interface ToastStore {
  message: string | null;
  tone: ToastTone;
  /** Counts every `show`, so the same text shown twice is still a new toast with its own time on screen. */
  shown: number;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  message: null,
  tone: 'plain',
  shown: 0,
  show: (message, tone = 'plain') => set((state) => ({ message, tone, shown: state.shown + 1 })),
  hide: () => set({ message: null }),
}));
