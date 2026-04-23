import { useEffect, useRef } from 'react';
import { useDemo, DEMO_PDF_PATH } from '@/contexts/DemoContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDemoTarget } from './useDemoTarget';
import { useDemoAutoAdvance } from './useDemoAutoAdvance';
import { DemoTooltip } from './DemoTooltip';

export default function DemoOverlay() {
  const { active, currentStep, currentStepIndex, totalSteps, nextStep, prevStep, endDemo } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const tooltipRef = useRef<HTMLDivElement>(null);

  const targetRect = useDemoTarget(active, currentStep);
  useDemoAutoAdvance(active, currentStep, nextStep);

  // Navigate to the step's page if needed
  useEffect(() => {
    if (!active || !currentStep) return;
    const stepPage = currentStep.page;
    if (stepPage && !location.pathname.startsWith(stepPage)) {
      navigate(stepPage);
    }
  }, [active, currentStep, location.pathname, navigate]);

  if (!active || !currentStep) return null;

  // When the user clicks Next on a step that has a click-action target, fire
  // the underlying click for them so the demo drives itself.
  const handleNext = () => {
    if (currentStep.target && currentStep.action === 'click') {
      const el = document.querySelector(`[data-demo="${currentStep.target}"]`) as HTMLElement | null;
      if (el) {
        el.click();
        // auto-advance hook fires nextStep on the click; don't double-advance.
        return;
      }
    }
    nextStep();
  };

  const hasTarget = !!targetRect;
  const padding = 8;

  // Wait steps still need to gate Next.
  const isWaitStep = currentStep.action === 'wait';
  // Hide Next while we're waiting for a target to appear, except for center steps.
  const waitingForTarget = !!currentStep.target && !targetRect && currentStep.placement !== 'center';
  const showNextButton = !currentStep.requireAction && !waitingForTarget && !isWaitStep;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Calculate tooltip position with smart auto-placement to avoid overlapping the target
  const getTooltipStyle = (): React.CSSProperties => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    // 'center' placement always centers tooltip on screen, regardless of target
    if (currentStep.placement === 'center' || !targetRect) {
      if (isMobile) {
        return { position: 'fixed', left: 12, right: 12, bottom: 16, width: 'auto' };
      }
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    // On mobile: dock to bottom or top of screen depending on where the target is.
    if (isMobile) {
      const targetMid = targetRect.top + targetRect.height / 2;
      const dockTop = targetMid > window.innerHeight / 2;
      return dockTop
        ? { position: 'fixed', top: 16, left: 12, right: 12, width: 'auto' }
        : { position: 'fixed', bottom: 16, left: 12, right: 12, width: 'auto' };
    }

    const tooltipHeight = 200;
    const tooltipWidth = 320;
    const gap = padding + 12;

    const spaceBottom = window.innerHeight - targetRect.bottom - gap;
    const spaceTop = targetRect.top - gap;
    const spaceRight = window.innerWidth - targetRect.right - gap;
    const spaceLeft = targetRect.left - gap;

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
      return <div className={`fixed inset-0 bg-black/60 ${overlayPointerClass}`} />;
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
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top: 0, left: 0, right: 0, height: Math.max(0, top) }} />
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top: bottom, left: 0, right: 0, bottom: 0 }} />
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top, left: 0, width: Math.max(0, left), height }} />
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top, left: right, right: 0, height }} />
      </>
    );
  };

  // For select steps, drop z-index below portaled dropdowns (z-50) so they're clickable
  const isSelectStep = currentStep.action === 'select';
  const containerZ = isSelectStep ? 'z-[45]' : 'z-[200]';

  const isPdfPreviewStep = currentStep.id === 'preview-itinerary-pdf';

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

      {/* Inline PDF preview for the "this is a trip itinerary" step */}
      {isPdfPreviewStep && (
        <div
          className="fixed left-1/2 -translate-x-1/2 pointer-events-auto bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
          style={{
            top: 24,
            width: 'min(720px, calc(100vw - 24px))',
            height: 'min(60vh, calc(100vh - 280px))',
          }}
        >
          <iframe
            src={`${DEMO_PDF_PATH}#view=FitH`}
            title="Sample trip itinerary"
            className="w-full h-full"
          />
        </div>
      )}

      <DemoTooltip
        ref={tooltipRef}
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={totalSteps}
        style={getTooltipStyle()}
        showNextButton={showNextButton}
        isLastStep={isLastStep}
        isInteractiveStep={isWaitStep}
        onNext={handleNext}
        onPrev={prevStep}
        onSkip={endDemo}
      />
    </div>
  );
}
