import { useTitleBarFeatureStore } from "../../store/features/title-bar";

/**
 * Dispatch a button click back to the embedded app iframe.
 * App Bridge v3 expects: { type: 'dispatch', payload: { type: ACTION_TYPE, payload: { id } } }
 */
function dispatchClickToIframe(actionType: string, buttonId: string) {
  const iframe = document.getElementById("app-iframe") as HTMLIFrameElement;
  iframe?.contentWindow?.postMessage(
    {
      type: "dispatch",
      payload: {
        type: actionType,
        payload: { id: buttonId },
      },
    },
    "*",
  );
}

export function TitleBar() {
  const title = useTitleBarFeatureStore((state) => state.title);
  const subtitle = useTitleBarFeatureStore((state) => state.subtitle);
  const breadcrumbs = useTitleBarFeatureStore((state) => state.breadcrumbs);
  const primaryButton = useTitleBarFeatureStore((state) => state.primaryButton);
  const secondaryButtons = useTitleBarFeatureStore(
    (state) => state.secondaryButtons,
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "100%",
        padding: "0 20px",
        gap: "8px",
        backgroundColor: "rgb(241, 241, 241)",
      }}
    >
      {/* Breadcrumb / back button */}
      {breadcrumbs && (
        <s-button
          variant="tertiary"
          onClick={() =>
            dispatchClickToIframe(
              "APP::TITLEBAR::BREADCRUMBS::BUTTON::CLICK",
              breadcrumbs.id,
            )
          }
        >
          ← {breadcrumbs.label}
        </s-button>
      )}

      {/* Page title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <p
            style={{
              margin: 0,
              fontSize: "1.125rem",
              fontWeight: 650,
              color: "#1a1a1a",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </p>
        )}
        {subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: "0.8125rem",
              color: "#616161",
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Action buttons */}
      {(secondaryButtons.length > 0 || primaryButton) && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {secondaryButtons.map((btn, i) => (
            <s-button
              key={i}
              variant="secondary"
              disabled={btn.disabled || undefined}
              onClick={() =>
                dispatchClickToIframe(
                  "APP::TITLEBAR::BUTTONS::BUTTON::CLICK",
                  btn.id,
                )
              }
            >
              {btn.label}
            </s-button>
          ))}

          {primaryButton && (
            <s-button
              variant="primary"
              loading={primaryButton.loading || undefined}
              disabled={primaryButton.disabled || undefined}
              onClick={() =>
                dispatchClickToIframe(
                  "APP::TITLEBAR::BUTTONS::BUTTON::CLICK",
                  primaryButton.id,
                )
              }
            >
              {primaryButton.label}
            </s-button>
          )}
        </div>
      )}
    </div>
  );
}
