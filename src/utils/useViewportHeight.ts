import { useEffect } from "react";

/**
 * Keeps the `--app-height` custom property in sync with the visual viewport, so
 * a full-height layout stays above the on-screen keyboard.
 *
 * Chrome and Firefox honor `interactive-widget=resizes-content` (set in _app),
 * which shrinks the layout viewport when the keyboard opens — `100dvh` alone is
 * correct there. Safari ignores the hint: the keyboard overlays the page and
 * only the *visual* viewport shrinks, so we measure that and override the
 * property ourselves.
 */
export default function useViewportHeight() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      // While the page is pinch-zoomed, visualViewport.height measures the
      // magnified window rather than the layout, and adopting it would collapse
      // the app to a fraction of its height. Keep the last good value instead.
      if (Math.abs(viewport.scale - 1) > 0.01) return;

      document.documentElement.style.setProperty(
        "--app-height",
        `${viewport.height}px`,
      );

      // Safari scrolls the layout viewport to reveal the focused input. Undo
      // that only where there's nothing legitimately scrollable — this hook is
      // app-wide, and pages taller than the viewport (the city search) must
      // keep the scroll position the user or the browser chose.
      if (document.documentElement.scrollHeight <= viewport.height + 1) {
        window.scrollTo(0, 0);
      }
    };

    update();
    viewport.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--app-height");
    };
  }, []);
}
