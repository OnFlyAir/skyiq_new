import { useEffect, useState } from 'react';
import type { DemoStep } from '@/contexts/DemoContext';

/**
 * Polls for the current step's target element and keeps its bounding rect in state.
 * Smoothly handles scrolling so the spotlight + tooltip don't flicker:
 *  - only commits a new rect when it differs by >1px (no per-frame churn)
 *  - debounces commits while a scroll animation is in flight
 *  - drives mobile clearance with a single corrective scroll, not a per-poll loop
 */
export function useDemoTarget(active: boolean, currentStep: DemoStep | null): DOMRect | null {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!active || !currentStep?.target) {
      setTargetRect(null);
      return;
    }

    const isCenter = currentStep.placement === 'center';
    let scrollSettled = false;
    let lastCommittedRect: DOMRect | null = null;
    let stalledScrollAttempts = 0;
    let lastTargetTop: number | null = null;
    let forceWindowScroll = false;
    let scrollLockUntil = 0;
    // While a CSS transition is in flight on the overlay (spotlight + tooltip),
    // suppress further rect commits so the visuals never update mid-animation.
    // Matches the 250ms CSS transition in DemoOverlay with a small buffer.
    const TRANSITION_MS = 260;
    let transitionUntil = 0;
    let pendingRect: DOMRect | null = null;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const findScrollParent = (el: Element): Element => {
      if (forceWindowScroll) {
        return document.scrollingElement || document.documentElement;
      }
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

    // Only commit a new rect when it differs meaningfully — kills 1px jitter
    // during smooth scroll and prevents the tooltip from re-measuring every poll.
    const commitRect = (rect: DOMRect) => {
      const prev = lastCommittedRect;
      if (
        prev &&
        Math.abs(prev.top - rect.top) < 2 &&
        Math.abs(prev.left - rect.left) < 2 &&
        Math.abs(prev.width - rect.width) < 2 &&
        Math.abs(prev.height - rect.height) < 2
      ) {
        return;
      }

      // If a previous commit's CSS transition is still animating the overlay,
      // queue this update and apply it once the transition window ends. This
      // guarantees the spotlight/tooltip never jumps mid-animation.
      const now = Date.now();
      if (now < transitionUntil) {
        pendingRect = rect;
        if (!pendingTimer) {
          const wait = Math.max(0, transitionUntil - now);
          pendingTimer = setTimeout(() => {
            pendingTimer = null;
            const next = pendingRect;
            pendingRect = null;
            if (next) commitRect(next);
          }, wait);
        }
        return;
      }

      lastCommittedRect = rect;
      transitionUntil = now + TRANSITION_MS;
      setTargetRect(rect);
    };

    const findTarget = () => {
      const el = document.querySelector(`[data-demo="${currentStep.target}"]`);
      if (!el) {
        // Don't clear an existing rect mid-step — keeps the spotlight visible
        // during page transitions and brief unmounts.
        if (!lastCommittedRect) setTargetRect(null);
        return;
      }

      const rect = el.getBoundingClientRect();

      const isMobile = window.innerWidth < 640;
      // Read iOS/Android safe-area insets so the spotlight clearance accounts
      // for the status bar / notch (top) and home indicator (bottom).
      const readInset = (side: 'top' | 'bottom' | 'left' | 'right'): number => {
        if (typeof window === 'undefined') return 0;
        const probe = document.createElement('div');
        probe.style.cssText = `position:fixed;${side}:env(safe-area-inset-${side},0px);visibility:hidden;pointer-events:none;`;
        document.body.appendChild(probe);
        const value = parseFloat(getComputedStyle(probe)[side as any]) || 0;
        probe.remove();
        return value;
      };
      const safeTopInset = isMobile ? readInset('top') : 0;
      const safeBottomInset = isMobile ? readInset('bottom') : 0;
      const reservedForTooltip = isMobile ? 260 + safeBottomInset : 0;
      const viewportPadding = 24;

      const isWithinViewport =
        rect.top >= viewportPadding + safeTopInset &&
        rect.bottom <= window.innerHeight - reservedForTooltip - viewportPadding &&
        rect.left >= viewportPadding &&
        rect.right <= window.innerWidth - viewportPadding;

      // Always commit the rect so the spotlight tracks; below we decide whether
      // we still need to scroll.
      commitRect(rect);

      // If we're still inside a recent scroll animation, don't fire another one.
      if (Date.now() < scrollLockUntil) return;

      if (scrollSettled || isCenter) return;

      if (isWithinViewport) {
        scrollSettled = true;
        lastTargetTop = null;
        stalledScrollAttempts = 0;
        return;
      }

      // Stalled-scroll detection — escalate to window scroll.
      if (lastTargetTop !== null && Math.abs(rect.top - lastTargetTop) < 2) {
        stalledScrollAttempts += 1;
        if (stalledScrollAttempts >= 1) forceWindowScroll = true;
      } else {
        stalledScrollAttempts = 0;
      }
      lastTargetTop = rect.top;

      if (isMobile) {
        // Per-step override
        let overrideOffset: number | null = null;
        let node: Element | null = el;
        while (node) {
          const attr = (node as HTMLElement).getAttribute?.('data-demo-scroll-offset');
          if (attr != null) {
            const parsed = parseInt(attr, 10);
            if (!Number.isNaN(parsed)) { overrideOffset = parsed; break; }
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

        const delta = rect.top - desiredTop;
        if (Math.abs(delta) > 8) {
          const scroller = findScrollParent(el);
          scroller.scrollBy({ top: delta, behavior: 'smooth' });
          // Lock further scroll attempts for ~500ms while the animation runs.
          scrollLockUntil = Date.now() + 500;
        } else {
          scrollSettled = true;
        }
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        scrollLockUntil = Date.now() + 500;
      }
    };

    // First pass immediately, then poll less aggressively to reduce churn.
    findTarget();
    const interval = setInterval(findTarget, 250);
    return () => {
      clearInterval(interval);
      if (pendingTimer) clearTimeout(pendingTimer);
    };
  }, [active, currentStep]);

  return targetRect;
}
