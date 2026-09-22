import { useRef, type PointerEvent } from "react";

/**
 * Tilts an element in 3D towards the pointer. Styles are written straight to the node rather than
 * through state, so moving the pointer never re-renders the component.
 */
export function useTilt<T extends HTMLElement>(maxDegrees = 6) {
  const ref = useRef<T>(null);

  const onPointerMove = (event: PointerEvent<T>) => {
    const element = ref.current;
    if (!element || event.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const bounds = element.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    element.style.transform = `perspective(900px) rotateX(${(-y * maxDegrees).toFixed(2)}deg) rotateY(${(x * maxDegrees).toFixed(2)}deg) scale(1.01)`;
  };

  const onPointerLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return { ref, onPointerMove, onPointerLeave, style: { transition: "transform 200ms ease-out" } };
}
