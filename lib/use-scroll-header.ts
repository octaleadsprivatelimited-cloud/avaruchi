"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useScrollHeader(route: string, keepOpen: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const show = useCallback(() => setHidden(false), []);

  useEffect(() => {
    setHidden(false);
    let previous = Math.max(0, window.scrollY);
    let direction = 0;
    let distance = 0;
    let frame = 0;
    const update = () => {
      frame = 0;
      const limit = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const y = Math.min(limit, Math.max(0, window.scrollY));
      const root = ref.current;
      const active = document.activeElement;
      const keyboardFocus =
        !!active &&
        !!root?.contains(active) &&
        active.matches(":focus-visible");
      if (
        y < 48 ||
        keepOpen ||
        root?.querySelector("details[open]") ||
        keyboardFocus
      ) {
        setHidden(false);
        previous = y;
        distance = 0;
        direction = 0;
        return;
      }
      const delta = y - previous;
      previous = y;
      if (!delta) return;
      const nextDirection = Math.sign(delta);
      distance =
        nextDirection === direction
          ? distance + Math.abs(delta)
          : Math.abs(delta);
      direction = nextDirection;
      if (distance >= 12) {
        setHidden(direction > 0 && y > (root?.offsetHeight || 110) + 24);
        distance = 0;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [route, keepOpen]);

  return { ref, hidden, show };
}
