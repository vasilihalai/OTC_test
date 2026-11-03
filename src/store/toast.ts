import { create } from 'zustand';

/** `notice` carries the frame's orange mark and stays on screen longer. */
export type ToastTone = 'plain' | 'notice';

interface ToastStore {
  message: string | null;
  tone: ToastTone;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  message: null,
  tone: 'plain',
  show: (message, tone = 'plain') => set({ message, tone }),
  hide: () => set({ message: null }),
}));
