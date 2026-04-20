import { useEffect, useState } from 'react';
import type { DemoStep } from '@/contexts/DemoContext';

/**
 * Polls for the current step's target element and keeps its bounding rect in state.
 * Also handles smart mobile scrolling so the target clears any sticky headers
 * and stays above the bottom-docked tooltip.
 */
export function useDemoTarget(active: boolean, currentStep: DemoStep | null): DOMRect | null {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!active || !currentStep?.target) {
      setTargetRect(null);
      return;
    }

    const isCenter = currentStep.placement === 'center';
    let hasScrolledForThisStep = false;

    // Walk up the DOM to find the nearest scrollable ancestor.
    const findScrollParent = (el: Element): Element => {
      let node: Element | null = el.parentElement;
      while (node) {
        const style = getComputedStyle(node);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
          return node;
        }
        node = node.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    };

    const findTarget = () => {
      const el = document.querySelector(`[data-demo="${currentStep.target}"]`);
      if (!el) {
        setTargetRect(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      setTargetRect(rect);

      const isMobile = window.innerWidth < 640;
      const reservedForTooltip = isMobile ? 260 : 0;
      const viewportPadding = 24;

      const needsClearance = isMobile
        ? rect.top < viewportPadding + 8 ||
          rect.bottom > window.innerHeight - reservedForTooltip - 8
        : false;

      const isOffscreen =
        rect.top < viewportPadding ||
        rect.bottom > window.innerHeight - viewportPadding ||
        rect.left < viewportPadding ||
        rect.right > window.innerWidth - viewportPadding;

      if ((!isCenter || isOffscreen || needsClearance) && !hasScrolledForThisStep) {
        hasScrolledForThisStep = true;
        if (isMobile) {
          // First, bring the target into view reliably.
          el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });

          // Then nudge it down to clear any sticky headers and the bottom-docked tooltip.
          setTimeout(() => {
            const newRect = el.getBoundingClientRect();

            // Per-page override: any ancestor (or the target itself) can set
            // data-demo-scroll-offset="<px>" to force a specific clearance.
            let overrideOffset: number | null = null;
            let node: Element | null = el;
            while (node) {
              const attr = (node as HTMLElement).getAttribute?.('data-demo-scroll-offset');
              if (attr != null) {
                const parsed = parseInt(attr, 10);
                if (!Number.isNaN(parsed)) {
                  overrideOffset = parsed;
                  break;
                }
              }
              node = node.parentElement;
            }

            let desiredTop: number;
            if (overrideOffset != null) {
              desiredTop = overrideOffset;
            } else {
              const stickies = document.querySelectorAll('.sticky, [data-sticky]');
              let stickyBottom = 0;
              stickies.forEach((s) => {
                const sEl = s as HTMLElement;
                if (sEl.contains(el) || el.contains(sEl)) return;
                const sRect = sEl.getBoundingClientRect();
                if (sRect.top <= 80 && sRect.bottom > 0 && sRect.bottom < window.innerHeight / 2) {
                  stickyBottom = Math.max(stickyBottom, sRect.bottom);
                }
              });
              desiredTop = Math.max(120, stickyBottom + 24);
            }

            const delta = newRect.top - desiredTop;
            if (Math.abs(delta) > 8) {
              const scroller = findScrollParent(el);
              scroller.scrollBy({ top: delta, behavior: 'smooth' });
            }
          }, 350);
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }
    };

    const interval = setInterval(findTarget, 200);
    findTarget();
    return () => clearInterval(interval);
  }, [active, currentStep]);

  return targetRect;
}
