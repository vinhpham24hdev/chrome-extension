// hooks/useDragToRect.ts
import { useEffect } from "react";

/**
 * Kéo-thả để tạo DOMRect.
 * @param containerRef ref tới bất kỳ HTMLElement (div, span, ...)
 * @param setRect callback nhận DOMRect | null
 */
export default function useDragToRect<T extends HTMLElement = HTMLElement>(
  containerRef: React.RefObject<T | null>,
  setRect: (r: DOMRect | null) => void
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startX = 0,
      startY = 0;

    function onMouseDown(e: MouseEvent) {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      setRect(new DOMRect(startX, startY, 0, 0));
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }

    function onMove(e: MouseEvent) {
      const x = Math.min(e.clientX, startX);
      const y = Math.min(e.clientY, startY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      setRect(new DOMRect(x, y, w, h));
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    el.addEventListener("mousedown", onMouseDown);
    return () => el.removeEventListener("mousedown", onMouseDown);
  }, [containerRef, setRect]);
}
