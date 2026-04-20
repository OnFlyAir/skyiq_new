import { useEffect, useState, useRef, useCallback } from 'react';
import { useDemo } from '@/contexts/DemoContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ArrowRight, ArrowLeft, Play } from 'lucide-react';

export default function DemoOverlay() {
  const { active, currentStep, currentStepIndex, totalSteps, nextStep, prevStep, endDemo } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Navigate to the step's page if needed
  useEffect(() => {
    if (!active || !currentStep) return;
    const stepPage = currentStep.page;
    if (stepPage && !location.pathname.startsWith(stepPage)) {
      navigate(stepPage);
    }
  }, [active, currentStep, location.pathname, navigate]);

  // Find and highlight target element
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
          // Scroll the nearest scrollable ancestor so target sits below any sticky header.
          // Detect sticky elements above the target inside the scroller and reserve their height.
          const scroller = findScrollParent(el);
          const scrollerRect = (scroller as HTMLElement).getBoundingClientRect?.() ?? { top: 0 };
          let stickyOffset = 0;
          const stickies = (scroller as HTMLElement).querySelectorAll?.('.sticky, [data-sticky]') ?? [];
          stickies.forEach((s) => {
            const sRect = (s as HTMLElement).getBoundingClientRect();
            // Only count stickies that are actually pinned at the top of the scroller and above target.
            if (sRect.bottom <= rect.top + 1 && sRect.top <= scrollerRect.top + 4) {
              stickyOffset = Math.max(stickyOffset, sRect.bottom - scrollerRect.top);
            }
          });
          const desiredTop = Math.max(96, stickyOffset + 24);
          const delta = rect.top - desiredTop;
          scroller.scrollBy({ top: delta, behavior: 'smooth' });
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }
    };

    const interval = setInterval(findTarget, 200);
    findTarget();
    return () => clearInterval(interval);
  }, [active, currentStep]);

  // Auto-advance on click for click-action steps
  useEffect(() => {
    if (!active || !currentStep?.target) return;
    if (currentStep.action !== 'click' && !currentStep.autoAdvance) return;

    const handler = (e: MouseEvent) => {
      const el = document.querySelector(`[data-demo="${currentStep.target}"]`);
      if (el && (el === e.target || el.contains(e.target as Node))) {
        setTimeout(nextStep, 400);
      }
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [active, currentStep, nextStep]);

  // Auto-advance on input for input-action steps
  useEffect(() => {
    if (!active || !currentStep?.target || currentStep.action !== 'input') return;
    const expected = currentStep.inputValue;
    if (!expected) return;

    const handler = () => {
      const el = document.querySelector(`[data-demo="${currentStep.target}"]`);
      if (!el) return;
      const input = el.tagName === 'INPUT' ? el as HTMLInputElement
        : el.querySelector('input') as HTMLInputElement | null;
      if (input && input.value.trim().toLowerCase() === expected.trim().toLowerCase()) {
        setTimeout(nextStep, 500);
      }
    };

    document.addEventListener('input', handler, true);
    return () => document.removeEventListener('input', handler, true);
  }, [active, currentStep, nextStep]);

  // Auto-advance on select — watch for target button text to contain the expected value
  useEffect(() => {
    if (!active || !currentStep?.target || currentStep.action !== 'select') return;
    const expected = currentStep.inputValue?.toLowerCase();
    if (!expected) return;

    const checkValue = () => {
      const el = document.querySelector(`[data-demo="${currentStep.target}"]`);
      if (!el) return;
      const text = el.textContent?.toLowerCase() || '';
      if (text.includes(expected)) {
        setTimeout(nextStep, 500);
      }
    };

    const interval = setInterval(checkValue, 300);
    return () => clearInterval(interval);
  }, [active, currentStep, nextStep]);

  if (!active || !currentStep) return null;

  const hasTarget = !!targetRect;
  const padding = 8;

  // Is this a "do something" step? (still shown as a hint)
  const isInteractiveStep = currentStep.action === 'click' || currentStep.action === 'input' || currentStep.action === 'select' || currentStep.action === 'wait' || currentStep.autoAdvance;
  // Show Next unless the step explicitly requires the user to perform the action.
  // Also hide Next while we're waiting for a target element to appear (page still loading) —
  // EXCEPT for 'center' placement steps which don't depend on a target being visible.
  const waitingForTarget = !!currentStep.target && !targetRect && currentStep.placement !== 'center';
  const showNextButton = !currentStep.requireAction && !waitingForTarget;
  // Last step always gets a Finish button
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Calculate tooltip position with smart auto-placement to avoid overlapping the target
  const getTooltipStyle = (): React.CSSProperties => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    // 'center' placement always centers tooltip on screen, regardless of target
    if (currentStep.placement === 'center' || !targetRect) {
      if (isMobile) {
        return {
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: 16,
          width: 'auto',
        };
      }
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    // On mobile: dock to bottom or top of screen depending on where the target is.
    // Side placements never fit on narrow viewports.
    if (isMobile) {
      const targetMid = targetRect.top + targetRect.height / 2;
      const dockTop = targetMid > window.innerHeight / 2;
      return dockTop
        ? { position: 'fixed', top: 16, left: 12, right: 12, width: 'auto' }
        : { position: 'fixed', bottom: 16, left: 12, right: 12, width: 'auto' };
    }

    const tooltipHeight = 200; // estimated max tooltip height
    const tooltipWidth = 320; // w-80 = 320px
    const gap = padding + 12;

    const spaceBottom = window.innerHeight - targetRect.bottom - gap;
    const spaceTop = targetRect.top - gap;
    const spaceRight = window.innerWidth - targetRect.right - gap;
    const spaceLeft = targetRect.left - gap;

    // Determine best placement: prefer the step's placement, but fall back if it would overlap
    const preferred = currentStep.placement || 'bottom';
    const fits: Record<string, boolean> = {
      bottom: spaceBottom >= tooltipHeight,
      top: spaceTop >= tooltipHeight,
      right: spaceRight >= tooltipWidth,
      left: spaceLeft >= tooltipWidth,
    };

    const placement = fits[preferred] ? preferred
      : fits.bottom ? 'bottom'
      : fits.right ? 'right'
      : fits.top ? 'top'
      : fits.left ? 'left'
      : 'bottom';

    const base: React.CSSProperties = { position: 'fixed' };

    // Clamp horizontal center so tooltip doesn't go off-screen
    const clampX = (cx: number) => Math.max(8, Math.min(cx, window.innerWidth - tooltipWidth - 8));
    const clampY = (cy: number) => Math.max(8, Math.min(cy, window.innerHeight - tooltipHeight - 8));

    switch (placement) {
      case 'bottom':
        base.top = targetRect.bottom + gap;
        base.left = clampX(targetRect.left + targetRect.width / 2 - tooltipWidth / 2);
        break;
      case 'top':
        base.bottom = window.innerHeight - targetRect.top + gap;
        base.left = clampX(targetRect.left + targetRect.width / 2 - tooltipWidth / 2);
        break;
      case 'right':
        base.top = clampY(targetRect.top + targetRect.height / 2 - tooltipHeight / 2);
        base.left = targetRect.right + gap;
        break;
      case 'left':
        base.top = clampY(targetRect.top + targetRect.height / 2 - tooltipHeight / 2);
        base.right = window.innerWidth - targetRect.left + gap;
        break;
    }

    return base;
  };

  // For select steps, make overlay visual-only so dropdown portals are clickable
  const overlayPointerClass = currentStep.action === 'select' ? 'pointer-events-none' : 'pointer-events-auto';

  // Use 4 overlay panels around the spotlight so the target area is fully interactive
  const renderOverlay = () => {
    if (!hasTarget) {
      return (
        <div className={`fixed inset-0 bg-black/60 ${overlayPointerClass}`} />
      );
    }

    const r = targetRect!;
    const top = r.top - padding;
    const left = r.left - padding;
    const width = r.width + padding * 2;
    const height = r.height + padding * 2;
    const bottom = top + height;
    const right = left + width;

    return (
      <>
        {/* Top */}
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top: 0, left: 0, right: 0, height: Math.max(0, top) }} />
        {/* Bottom */}
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top: bottom, left: 0, right: 0, bottom: 0 }} />
        {/* Left */}
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top, left: 0, width: Math.max(0, left), height }} />
        {/* Right */}
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top, left: right, right: 0, height }} />
      </>
    );
  };

  // For select steps, drop z-index below portaled dropdowns (z-50) so they're clickable
  const isSelectStep = currentStep.action === 'select';
  const containerZ = isSelectStep ? 'z-[45]' : 'z-[200]';

  return (
    <div className={`fixed inset-0 ${containerZ} pointer-events-none`}>
      {renderOverlay()}

      {/* Spotlight ring */}
      {hasTarget && (
        <div
          className="absolute border-2 border-primary rounded-lg pointer-events-none animate-pulse"
          style={{
            top: targetRect!.top - padding,
            left: targetRect!.left - padding,
            width: targetRect!.width + padding * 2,
            height: targetRect!.height + padding * 2,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="pointer-events-auto sm:max-w-sm sm:w-80"
        style={getTooltipStyle()}
      >
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4">
            <div className="flex items-center gap-2">
              <Play className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                Demo · {currentStepIndex + 1}/{totalSteps}
              </span>
            </div>
            <button
              onClick={endDemo}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground mb-1">{currentStep.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{currentStep.description}</p>
          </div>

          {/* Interaction hint for action steps */}
          {isInteractiveStep && !isLastStep && (
            <div className="px-4 pb-1">
              <p className="text-[10px] text-primary/70 italic">
                {currentStep.action === 'input' ? '↑ Type the value above to continue' 
                  : currentStep.action === 'select' ? '↑ Select the option from the dropdown to continue'
                  : currentStep.action === 'wait' ? '⏳ Please wait…'
                  : '↑ Click the highlighted area to continue'}
              </p>
            </div>
          )}

          {/* Progress bar */}
          <div className="px-4">
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={endDemo}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip demo
            </button>
            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <button
                  onClick={prevStep}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </button>
              )}
              {(showNextButton || isLastStep) && (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  {isLastStep ? 'Finish' : 'Next'}
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
