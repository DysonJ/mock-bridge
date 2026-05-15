import { create } from "zustand";
import { combine } from "zustand/middleware";

export type NavItem = {
  id: string;
  label: string;
  destination: string; // route path, e.g. '/inventory'
  isHome?: boolean;
}

type NavMenuFeatureState = {
  items: NavItem[];
  activeId: string | undefined;
}

export const useNavMenuFeatureStore = create(combine(
  { items: [], activeId: undefined } as NavMenuFeatureState,
  (set) => ({
    setFromAppBridge: (payload: { items: NavItem[]; activeId: string | undefined }) =>
      set({ items: payload.items, activeId: payload.activeId }),

    setActive: (id: string) => set({ activeId: id }),

    clearItems: () => set({ items: [], activeId: undefined }),
  })
));
