import {
  useNavMenuFeatureStore,
  type NavItem,
} from "../store/features/nav-menu";
import { TitleBar } from "./features/TitleBar";
import { useConfig } from "../hooks/useConfig";

type Props = {
  children: React.ReactNode;
};

// Default Shopify admin navigation items (visual only)
const defaultNavItems: NavItem[] = [
  { id: "home", label: "Home", destination: "/", isHome: true },
  { id: "orders", label: "Orders", destination: "/orders" },
  { id: "products", label: "Products", destination: "/products" },
  { id: "customers", label: "Customers", destination: "/customers" },
  { id: "content", label: "Content", destination: "/content" },
  { id: "analytics", label: "Analytics", destination: "/analytics" },
  { id: "marketing", label: "Marketing", destination: "/marketing" },
  { id: "discounts", label: "Discounts", destination: "/discounts" },
];

export function Frame({ children }: Props) {
  const config = useConfig();
  const appNavItems = useNavMenuFeatureStore((state) => state.items);
  const activeId = useNavMenuFeatureStore((state) => state.activeId);
  const setActive = useNavMenuFeatureStore((state) => state.setActive);

  const hasAppNav = appNavItems.length > 0;
  const appName = config?.appName ?? "My App";

  function sendNavClick(id: string, destination: string) {
    setActive(id);
    const iframe = document.getElementById("app-iframe") as HTMLIFrameElement;
    iframe?.contentWindow?.postMessage(
      { type: "NAV_MENU_CLICK", href: destination },
      "*",
    );
  }

  return (
    <div
      className="frame"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: "rgb(26, 26, 26)",
      }}
    >
      <div
        className="top-bar"
        style={{
          height: "3.5rem",
          width: "100%",
          backgroundColor: "rgb(26, 26, 26)",
          color: "white",
        }}
      >
        <h3>Mock Bridge</h3>
      </div>

      <div
        className="main-content"
        style={{
          display: "flex",
          flex: 1,
          width: "100%",
          borderTopLeftRadius: "0.75rem",
          borderTopRightRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        <div
          className="navigation"
          style={{
            width: "240px",
            backgroundColor: "rgb(235, 235, 235)",
            padding: "8px 0",
            overflowY: "auto",
          }}
        >
          {/* Default Shopify admin navigation */}
          <s-stack justifyContent="stretch">
            {defaultNavItems.map((item) => (
              <s-button key={item.id} variant="tertiary">
                {item.label}
              </s-button>
            ))}
          </s-stack>

          {/* App navigation section — rendered when the embedded app registers a NavigationMenu */}
          {hasAppNav && (
            <>
              <div
                style={{ borderTop: "1px solid #d9d9d9", margin: "8px 0" }}
              />

              {/* Apps > breadcrumb header */}
              <div
                style={{
                  padding: "4px 16px 6px",
                  fontSize: "12px",
                  color: "#6d7175",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>Apps</span>
                <span style={{ fontSize: "10px" }}>›</span>
              </div>

              {/* App name row with icon */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 16px",
                  gap: "8px",
                }}
              >
                {/* Small app icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  style={{ flexShrink: 0, color: "#6d7175" }}
                >
                  <rect
                    x="2"
                    y="2"
                    width="7"
                    height="7"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.6"
                  />
                  <rect
                    x="11"
                    y="2"
                    width="7"
                    height="7"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.6"
                  />
                  <rect
                    x="2"
                    y="11"
                    width="7"
                    height="7"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.6"
                  />
                  <rect
                    x="11"
                    y="11"
                    width="7"
                    height="7"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.6"
                  />
                </svg>
                <span
                  style={{
                    fontSize: "13px",
                    color: "#1a1a1a",
                    fontWeight: 500,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {appName}
                </span>
                <span
                  style={{ fontSize: "16px", color: "#1a1a1a", lineHeight: 1 }}
                >
                  •
                </span>
              </div>

              {/* Sub-nav items */}
              {appNavItems.map((item) => {
                const isActive = item.id === activeId;
                return (
                  <div
                    key={item.id}
                    onClick={() => sendNavClick(item.id, item.destination)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "6px 16px 6px 32px",
                      cursor: "pointer",
                      backgroundColor: isActive ? "#f1f1f1" : "transparent",
                      fontSize: "14px",
                      color: "#1a1a1a",
                      gap: "6px",
                      userSelect: "none",
                    }}
                  >
                    {isActive && (
                      <span style={{ fontSize: "12px", color: "#1a1a1a" }}>
                        →
                      </span>
                    )}
                    <span style={{ paddingLeft: isActive ? "0" : "18px" }}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div
          className="app-container"
          style={{
            flex: 1,
            width: "100%",
            backgroundColor: "white",
          }}
        >
          <div
            className="app-title-bar"
            style={{
              height: "57px",
              width: "100%",
              backgroundColor: "rgb(241, 241, 241)",
              borderBottom: "1px solid rgb(235, 235, 235)",
              boxSizing: "border-box",
              borderTopRightRadius: "12px",
            }}
          >
            <TitleBar />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
