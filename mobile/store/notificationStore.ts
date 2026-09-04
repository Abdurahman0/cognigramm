import { create } from "zustand";

export type NotificationTone = "success" | "error" | "info";

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  message?: string;
  /** Set while the card plays its exit animation, just before it is removed. */
  exiting: boolean;
}

interface NotificationStore {
  items: AppNotification[];
  notify: (tone: NotificationTone, title: string, message?: string) => string;
  /** Start the exit animation. The card removes itself when the animation ends. */
  dismiss: (id: string) => void;
  remove: (id: string) => void;
}

/** Notifications past this depth are dropped, so the stack never buries the UI. */
const MAX_VISIBLE = 3;

let counter = 0;

export const useNotificationStore = create<NotificationStore>()((set) => ({
  items: [],
  notify: (tone, title, message) => {
    counter += 1;
    const id = `notification-${counter}`;
    set((state) => ({
      items: [...state.items.filter((item) => !item.exiting), { id, tone, title, message, exiting: false }].slice(
        -MAX_VISIBLE
      )
    }));
    return id;
  },
  dismiss: (id) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, exiting: true } : item))
    })),
  remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
}));

/** Imperative entry point, so notifications can be raised outside React. */
export const notify = (tone: NotificationTone, title: string, message?: string): string =>
  useNotificationStore.getState().notify(tone, title, message);
