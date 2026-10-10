"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Calculator, Grip, Maximize2, Minimize2, X } from "lucide-react";
import { FormulaCalculator } from "./formula-calculator";
import type { Formula } from "@/core/math/formula";

type Position = Readonly<{ x: number; y: number }>;
type DragStart = Readonly<{ pointerId: number; startX: number; startY: number; left: number; top: number }>;
type Props = Readonly<{ open: boolean; onClose: () => void; formula: Formula }>;
const MOBILE_QUERY = "(max-width: 760px)";
function subscribeMobile(listener: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const mobileSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;
const desktopSnapshot = () => false;

/**
 * A non-modal, movable desktop window and an accessible modal mobile sheet.
 * The calculator remains mounted while closed, preserving its scratch expression.
 * No external pop-up or browser window is opened.
 */
export function CalculatorWindow({ open, onClose, formula }: Props) {
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, desktopSnapshot);
  const windowRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragStart | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [maximized, setMaximized] = useState(false);
  const clamp = (x: number, y: number): Position => {
    const rect = windowRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 420;
    const height = rect?.height ?? 590;
    return {
      x: Math.max(8, Math.min(x, Math.max(8, window.innerWidth - width - 8))),
      y: Math.max(8, Math.min(y, Math.max(8, window.innerHeight - height - 8))),
    };
  };

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      windowRef.current?.querySelector<HTMLInputElement>('[aria-label="Calculator expression"]')?.focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === "Tab" && mobile) {
        const controls = [...(windowRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]',
        ) ?? [])].filter(el => el.getClientRects().length > 0);
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !windowRef.current?.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !windowRef.current?.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey, true); };
  }, [open, onClose, mobile]);

  useEffect(() => {
    const onResize = () => setPosition(previous => {
      if (!previous) return null;
      const rect = windowRef.current?.getBoundingClientRect();
      const w = rect?.width ?? 420, h = rect?.height ?? 590;
      return {
        x: Math.max(8, Math.min(previous.x, Math.max(8, window.innerWidth-w-8))),
        y: Math.max(8, Math.min(previous.y, Math.max(8, window.innerHeight-h-8))),
      };
    });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mobile || maximized || event.button !== 0) return;
    const rect = windowRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = {pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start=drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setPosition(clamp(start.left + event.clientX - start.startX,start.top + event.clientY - start.startY));
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const moveByKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!event.altKey || mobile || maximized || !["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const rect=windowRef.current?.getBoundingClientRect();
    if(!rect)return;
    const x=(position?.x??rect.left)+(event.key==="ArrowLeft"?-24:event.key==="ArrowRight"?24:0);
    const y=(position?.y??rect.top)+(event.key==="ArrowUp"?-24:event.key==="ArrowDown"?24:0);
    setPosition(clamp(x,y));
  };

  return <div className="pm-calc-window-layer" hidden={!open}>
    <button className="pm-calc-window-backdrop" type="button" aria-label="Dismiss calculator window" tabIndex={mobile?0:-1} onClick={onClose}/>
    <div id="pm-scientific-calculator-window" ref={windowRef} className={"pm-calculator-window"+(maximized?" is-maximized":"")}
      style={!mobile && !maximized && position?{left:position.x,top:position.y}:undefined}
      role="dialog" aria-modal={mobile} aria-label="Scientific calculator window">
      <div className="pm-calc-window-titlebar">
        <div className="pm-calc-window-grip" tabIndex={mobile?-1:0}
          aria-label="Move calculator window; Alt and arrow keys"
          onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}
          onPointerCancel={endDrag} onKeyDown={moveByKeys}>
          <span className="pm-calc-window-icon"><Calculator size={16}/></span>
          <span className="pm-calc-window-heading"><strong>Calculator</strong><small>SCIENTIFIC · LOCAL</small></span>
          {!mobile && <Grip size={14} className="pm-calc-drag-indicator" aria-hidden="true"/>}
        </div>
        <div className="pm-calc-window-actions">
          <button type="button" className="pm-calc-window-control pm-calc-maximize"
            aria-label={maximized?"Restore calculator window":"Maximize calculator window"}
            onClick={()=>setMaximized(value=>!value)}>
            {maximized?<Minimize2 size={15}/>:<Maximize2 size={15}/>}
          </button>
          <button type="button" className="pm-calc-window-control pm-calc-close" aria-label="Close calculator window" onClick={onClose}><X size={18}/></button>
        </div>
      </div>
      <div className="pm-calc-window-content"><FormulaCalculator formula={formula}/></div>
      <div className="pm-calc-window-footer"><span className="pm-calc-window-live"/> BOUNDED MATH ENGINE <span>RAD · AST</span></div>
    </div>
  </div>;
}
