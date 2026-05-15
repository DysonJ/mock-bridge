import { invokeFeature } from "../invokeFeature";

type NavItem = {
  label: string;
  href: string;
  isHome?: boolean;
};

/**
 * Observe ui-nav-menu elements and extract navigation items
 */
function observeNavMenuElements() {
  function extractNavItems(navMenu: HTMLElement): NavItem[] {
    const items: NavItem[] = [];

    // Look for a elements or ui-link/s-link elements
    const links = navMenu.querySelectorAll("a, ui-link, s-link");

    links.forEach((link) => {
      const href = link.getAttribute("href") || "/";
      const label = link.textContent?.trim() || "";
      const isHome = link.getAttribute("rel") === "home";

      if (label) {
        items.push({ label, href, isHome });
      }
    });

    return items;
  }

  function setupNavMenu(navMenu: HTMLElement) {
    // Hide the native element
    navMenu.style.display = "none";

    // Extract and send nav items to parent
    const items = extractNavItems(navMenu);
    if (items.length > 0) {
      invokeFeature("navMenu", "setItems", { items });
    }

    // Watch for changes to the nav menu
    const observer = new MutationObserver(() => {
      const updatedItems = extractNavItems(navMenu);
      invokeFeature("navMenu", "setItems", { items: updatedItems });
    });

    observer.observe(navMenu, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // Initial scan for nav menu elements
  function observeElements() {
    // Support multiple nav menu element names
    const selectors = ["ui-nav-menu", "nav-menu", "s-app-nav"];
    selectors.forEach((selector) => {
      document
        .querySelectorAll(selector)
        .forEach((el) => setupNavMenu(el as HTMLElement));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeElements);
  } else {
    observeElements();
  }

  // Watch for new nav menu elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const tagName = node.tagName.toLowerCase();
          if (["ui-nav-menu", "nav-menu", "s-app-nav"].includes(tagName)) {
            setupNavMenu(node);
          }
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Listen for nav click events from parent frame
  window.addEventListener("message", (event) => {
    if (event.data?.type === "NAV_MENU_CLICK") {
      const path = event.data.href;
      if (path) {
        // Use pushState + popstate so Angular Router handles this as a client-side
        // navigation instead of a full page reload.
        // Preserve existing query params (host, shop, embedded, id_token).
        const url = path + window.location.search;
        window.history.pushState(null, "", url);
        window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      }
    }
  });

  // Notify the parent frame whenever the app navigates so it can update the
  // active nav highlight to match the new route.
  function notifyParentOfNavigation() {
    window.parent.postMessage(
      { type: "IFRAME_NAVIGATION", path: window.location.pathname },
      "*",
    );
  }

  // Intercept history.pushState / replaceState (Angular Router uses these).
  const _origPush = history.pushState.bind(history);
  const _origReplace = history.replaceState.bind(history);

  history.pushState = function (...args) {
    _origPush(...args);
    notifyParentOfNavigation();
  };

  history.replaceState = function (...args) {
    _origReplace(...args);
    notifyParentOfNavigation();
  };

  // Also cover browser back/forward and our own popstate dispatches above.
  window.addEventListener("popstate", notifyParentOfNavigation);
}

export function navMenu() {
  // Start observing nav menu elements when the API is initialized
  if (typeof document !== "undefined") {
    observeNavMenuElements();
  }

  // The navMenu doesn't have a direct API - it works through the ui-nav-menu element
  return {};
}
