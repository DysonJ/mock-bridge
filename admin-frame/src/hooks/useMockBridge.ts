import { useCallback, useEffect, useRef, useState } from "react";
import { useConfig } from "./useConfig";
import {
  getFeatureStore,
  type FeatureActionName,
  type FeatureActionPayload,
  type FeatureName,
} from "../store/features";
import { useTitleBarFeatureStore } from "../store/features/title-bar";
import { useNavMenuFeatureStore } from "../store/features/nav-menu";

export type FeatureActionRequest<
  F extends FeatureName = FeatureName,
  A extends FeatureActionName<F> = FeatureActionName<F>,
  P extends FeatureActionPayload<F, A> = FeatureActionPayload<F, A>,
> = {
  feature: F;
  action: A | FeatureActionName<F>;
  payload: P | FeatureActionPayload<F, A>;
};

export function useMockBridge() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const config = useConfig();

  const [sessionToken, setSessionToken] = useState<string>("");

  // Signal to the iframe that it's in a mock environment
  // Send the signal multiple times to ensure it's received before the timeout
  const sendMockSignal = useCallback(() => {
    if (!config) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      iframe.contentWindow?.postMessage(
        {
          type: "MOCK_SHOPIFY_ENVIRONMENT",
          mockServerUrl: location.origin,
          shop: config.shop,
          clientId: config.clientId,
        },
        "*",
      );
    } catch (e) {
      console.warn(
        "[MockAdmin] Could not signal mock environment:",
        (e as Error).message,
      );
    }
  }, [config]);

  const getSessionToken = useCallback(() => {
    if (!config) return Promise.resolve("");

    return fetch("/api/session-token", {
      method: "POST",
      body: JSON.stringify({ shop: config.shop }),
    })
      .then((res) => res.json())
      .then((data) => data.token);
  }, [config]);

  useEffect(() => {
    // Need a session token to initially load the iframe
    getSessionToken().then((token) => {
      setSessionToken(token);
    });
  }, [getSessionToken]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (!sessionToken) return;

    // Note: We can't inject scripts directly due to cross-origin restrictions
    // Instead, the embedded app should detect it's in a mock environment and load the mock App Bridge

    // Handle postMessage communication with embedded app

    const handleMessage = (event: MessageEvent) => {
      if (!config) return;

      // Handle App Bridge messages from the embedded app
      if (event.data && event.data.type) {
        // Handle session token requests
        if (event.data.type === "SESSION_TOKEN_REQUEST") {
          // Generate and send back a session token
          getSessionToken().then((token) => {
            iframeRef.current?.contentWindow?.postMessage(
              {
                type: "SESSION_TOKEN_RESPONSE",
                token: token,
              },
              "*",
            );
          });
        }

        // Embedded app called something, like shopify.modal.show('modal_id')
        // Proxy the calls to their corresponding feature store
        if (event.data.type === "FEATURE_ACTION_REQUEST") {
          const { feature, action, payload } =
            event.data as FeatureActionRequest;

          const featureStore = getFeatureStore(feature);
          const state = featureStore.getState() as Record<string, unknown>;
          const actionFn = state[action as string];

          if (typeof actionFn === "function") {
            (actionFn as (payload: unknown) => void)(payload);
          } else {
            console.warn("[MockAdmin] Unknown feature action:", action);
          }

          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "FEATURE_ACTION_RESPONSE",
              action_id: event.data.action_id,
            },
            "*",
          );
        }

        // Track iframe-initiated navigation (pushState/replaceState/popstate inside
        // the app) and update the active nav item to match the new path.
        if (event.data.type === "IFRAME_NAVIGATION") {
          const path: string = event.data.path ?? "";
          const { items } = useNavMenuFeatureStore.getState();
          // Longest-prefix match so that /alerts/edit/123 correctly resolves to
          // the "Alerts" item whose destination is /alerts.
          let bestId: string | undefined;
          let bestLen = -1;
          for (const item of items) {
            const dest = item.destination;
            if (
              path === dest ||
              path.startsWith(dest + "/") ||
              path.startsWith(dest + "?")
            ) {
              if (dest.length > bestLen) {
                bestLen = dest.length;
                bestId = item.id;
              }
            }
          }
          if (bestId) {
            useNavMenuFeatureStore.getState().setActive(bestId);
          }
        }

        // Intercept App Bridge v3 TitleBar updates (APP::TITLEBAR::UPDATE)
        // The iframe sends { type: 'dispatch', payload: { type: 'APP::TITLEBAR::UPDATE', payload: {...} } }
        if (
          event.data.type === "dispatch" &&
          event.data.payload?.type === "APP::TITLEBAR::UPDATE"
        ) {
          const tbPayload = event.data.payload?.payload ?? {};
          const buttons = tbPayload.buttons ?? {};
          const primary = buttons.primary;
          const secondary: unknown[] = Array.isArray(buttons.secondary)
            ? buttons.secondary
            : [];
          const breadcrumbs = tbPayload.breadcrumbs;

          useTitleBarFeatureStore.getState().set({
            title: tbPayload.title,
            breadcrumbs: breadcrumbs
              ? { id: breadcrumbs.id ?? "", label: breadcrumbs.label ?? "" }
              : undefined,
            primaryButton: primary
              ? {
                  id: primary.id ?? "",
                  label: primary.label ?? "",
                  loading: primary.loading,
                  disabled: primary.disabled,
                }
              : undefined,
            secondaryButtons: secondary.map((btn: any) => ({
              id: btn.id ?? "",
              label: btn.label ?? "",
              disabled: btn.disabled,
            })),
          });
        }

        // Intercept App Bridge v3/v4 NavigationMenu updates
        // Dispatched as: { type: 'dispatch', payload: { type: 'APP::MENU::NAVIGATION_MENU::UPDATE', payload: { items, active, id } } }
        if (
          event.data.type === "dispatch" &&
          event.data.payload?.type === "APP::MENU::NAVIGATION_MENU::UPDATE"
        ) {
          const payload = event.data.payload?.payload ?? {};
          const items = (payload.items ?? []).map((item: any) => ({
            id: item.id ?? "",
            label: item.label ?? "",
            destination: item.destination?.path ?? item.destination ?? "/",
          }));
          useNavMenuFeatureStore.getState().setFromAppBridge({
            items,
            activeId: payload.active,
          });
        }
      }
    };

    const handleIframeLoad = () => {
      // Send signal immediately
      sendMockSignal();

      // Send signal a few more times to ensure delivery before timeout
      setTimeout(sendMockSignal, 10);
      setTimeout(sendMockSignal, 50);
      setTimeout(sendMockSignal, 100);
    };

    window.addEventListener("message", handleMessage);

    // Send signal immediately when iframe starts loading
    iframeRef.current?.addEventListener("load", handleIframeLoad);

    return () => {
      window.removeEventListener("message", handleMessage);
      iframe.removeEventListener("load", handleIframeLoad);
    };
  }, [config, sendMockSignal, sessionToken]);

  const iframeSrc = (() => {
    if (!config || !sessionToken) return "";

    const basePath = config.appPath || "";
    const host = btoa(config.shop);
    const idToken = sessionToken;

    const origin = config.proxyPort
      ? `http://localhost:${config.proxyPort}`
      : config.appUrl;

    return `${origin}${basePath}?host=${host}&shop=${config.shop}&embedded=1&id_token=${idToken}`;
  })();

  return {
    iframeRef,
    iframeSrc,
    // iframeSrc: ''
  };
}
