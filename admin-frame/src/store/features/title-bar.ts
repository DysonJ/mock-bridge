import { create } from "zustand";
import { combine } from "zustand/middleware";

export type TitleBarButtonState = {
  id: string;
  label: string;
  loading?: boolean;
  disabled?: boolean;
};

export type TitleBarBreadcrumbState = {
  id: string;
  label: string;
};

type TitleBarState = {
  title?: string;
  subtitle?: string;
  breadcrumbs?: TitleBarBreadcrumbState;
  primaryButton?: TitleBarButtonState;
  secondaryButtons: TitleBarButtonState[];
};

type SetPayload = {
  title?: string;
  subtitle?: string;
  breadcrumbs?: TitleBarBreadcrumbState;
  primaryButton?: TitleBarButtonState;
  secondaryButtons?: TitleBarButtonState[];
};

export const useTitleBarFeatureStore = create(
  combine(
    {
      title: undefined,
      subtitle: undefined,
      breadcrumbs: undefined,
      primaryButton: undefined,
      secondaryButtons: [],
    } as TitleBarState,
    (set) => ({
      set: (payload: SetPayload) =>
        set({
          title: payload.title,
          subtitle: payload.subtitle,
          breadcrumbs: payload.breadcrumbs,
          primaryButton: payload.primaryButton,
          secondaryButtons: payload.secondaryButtons ?? [],
        }),
      clear: (_payload: unknown) =>
        set({
          title: undefined,
          subtitle: undefined,
          breadcrumbs: undefined,
          primaryButton: undefined,
          secondaryButtons: [],
        }),
    }),
  ),
);
