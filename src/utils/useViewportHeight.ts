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
      document.documentElement.style.setProperty(
        "--app-height",
        `${viewport.height}px`,
      );
      // Safari may scroll the layout viewport to reveal the focused input. The
      // layout is never taller than the viewport, so this only undoes that.
      window.scrollTo(0, 0);
    };

    update();
    viewport.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--app-height");
    };
  }, []);
}
