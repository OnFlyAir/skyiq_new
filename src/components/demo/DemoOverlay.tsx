import { useEffect, useRef, useState } from 'react';
import { useDemo, DEMO_PDF_PATH } from '@/contexts/DemoContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDemoTarget } from './useDemoTarget';
import { useDemoAutoAdvance } from './useDemoAutoAdvance';
import { DemoTooltip } from './DemoTooltip';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuthContext } from '@/hooks/useAuthContext';
import PdfScrollViewer from '@/components/PdfScrollViewer';
import DemoProgressIndicator from './DemoProgressIndicator';

const DEV_DEMO_EMAIL = 'dev@skyiq.test';

export const POST_DEMO_HIGHLIGHT_KEY = 'skyiq_post_demo_highlight_signup';

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export default function DemoOverlay() {
  const { active, flow, currentStep, currentStepIndex, totalSteps, nextStep, prevStep, endDemo } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { profile } = useAuthContext();
  const tooltipRef = useRef<HTMLDivElement>(null);

  const targetRect = useDemoTarget(active, currentStep);
  useDemoAutoAdvance(active, currentStep, nextStep);

  // ---------- ALL HOOKS MUST BE DECLARED BEFORE ANY EARLY RETURN ----------
  // Lock the chosen placement & mobile dock side per-step so smooth scroll
  // movement doesn't cause the tooltip to flip mid-animation.
  const [lockedPlacement, setLockedPlacement] = useState<Placement | null>(null);
  const [lockedMobileDock, setLockedMobileDock] = useState<'top' | 'bottom' | null>(null);
  const [pendingRouteAdvanceFrom, setPendingRouteAdvanceFrom] = useState<string | null>(null);

  // Navigate to the step's page if needed
  useEffect(() => {
    if (!active || !currentStep) return;
    const stepPage = currentStep.page;
    if (stepPage && !location.pathname.startsWith(stepPage)) {
      navigate(stepPage);
    }
  }, [active, currentStep, location.pathname, navigate]);

  // Reset locks whenever the step changes (or the demo is closed).
  useEffect(() => {
    setLockedPlacement(null);
    setLockedMobileDock(null);
  }, [currentStep?.id]);

  useEffect(() => {
    if (!pendingRouteAdvanceFrom) return;
    if (location.pathname === pendingRouteAdvanceFrom) return;
    setPendingRouteAdvanceFrom(null);
    nextStep();
  }, [location.pathname, nextStep, pendingRouteAdvanceFrom]);

  // ---------- Safe to early-return below this line ----------
  if (!active || !currentStep || pendingRouteAdvanceFrom) return null;

  // End-of-demo handler.
  // - Public demo (started from /login by an anonymous visitor): sign out the
  //   demo account and route to /login with the signup-for-$1 CTA highlighted.
  // - In-app demo (logged-in user clicked a "Run demo" button on Dashboard /
  //   Fleet / etc.): just close the overlay and leave them where they are.
  //   Do NOT sign them out — that was kicking real users back to the login page.
  const finishDemo = async () => {
    // Capture flow BEFORE endDemo() resets it — otherwise the branch below
    // always sees null and falls through to the public-demo logout path.
    const wasPublic = flow === 'public';
    const wasFleet = flow === 'fleet';
    // Extra safety: only ever sign out if the active session is the public
    // sandbox account. A real logged-in user must never be signed out by
    // closing an in-app demo, regardless of how `flow` was set.
    const isSandboxUser = profile?.email === DEV_DEMO_EMAIL;

    // Fleet demo cleanup: the demo creates a real NSKYIQ aircraft so the
    // walkthrough feels authentic. We don't want to leave that test aircraft
    // sitting in the user's real fleet, so remove it on completion. The trip
    // demo injects the same aircraft on the fly (see TripLegsPage), so the
    // plan-a-trip demo keeps working even after this deletion.
    if (wasFleet && profile?.id && !isSandboxUser) {
      try {
        await supabase
          .from('aircrafts')
          .delete()
          .eq('user_company', profile.id)
          .eq('tail_number', 'NSKYIQ');
      } catch {
        /* best-effort cleanup; don't block the user */
      }
    }

    endDemo();
    if (wasPublic && isSandboxUser) {
      sessionStorage.setItem(POST_DEMO_HIGHLIGHT_KEY, '1');
      try {
        await supabase.auth.signOut();
      } catch {
        /* noop — even if sign out fails we still want to land on /login */
      }
      navigate('/login', { replace: true });
      return;
    }
    // In-app demo for a logged-in user: stay logged in, return to dashboard.
    navigate('/dashboard', { replace: true });
  };

  const handleNext = () => {
    if (currentStepIndex === totalSteps - 1) {
      void finishDemo();
      return;
    }
    if (currentStep.target && currentStep.action === 'click') {
      const el = document.querySelector(`[data-demo="${currentStep.target}"]`) as HTMLElement | null;
      const isDisabled = el instanceof HTMLButtonElement || el instanceof HTMLInputElement
        ? el.disabled
        : el?.getAttribute('aria-disabled') === 'true';
      if (el && !isDisabled) {
        el.click();
        // auto-advance hook fires nextStep on the click; don't double-advance.
        return;
      }
    }
    if (currentStep.clickOnNext) {
      const el = document.querySelector(`[data-demo="${currentStep.clickOnNext}"]`) as HTMLElement | null;
      const isDisabled = el instanceof HTMLButtonElement || el instanceof HTMLInputElement
        ? el.disabled
        : el?.getAttribute('aria-disabled') === 'true';
      if (el && !isDisabled) {
        setPendingRouteAdvanceFrom(location.pathname);
        el.click();
        return;
      }
    }
    nextStep();
  };

  const handleSkip = () => {
    void finishDemo();
  };

  const hasTarget = !!targetRect;
  const padding = 8;

  // Wait steps still need to gate Next.
  const isWaitStep = currentStep.action === 'wait';
  // Note: we no longer hide Next while waiting for a target. If the highlighted
  // element doesn't render in time we still want users to be able to advance —
  // hiding Next was stranding the public demo when a step's target was offscreen.
  const waitingForTarget = !!currentStep.target && !targetRect && currentStep.placement !== 'center';
  const showNextButton = !currentStep.requireAction && !isWaitStep;
  const isLastStep = currentStepIndex === totalSteps - 1;


  // Calculate tooltip position with smart auto-placement to avoid overlapping the target
  const getTooltipStyle = (): React.CSSProperties => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    // Respect iOS/Android safe-area insets so the tooltip never sits under the
    // status bar / notch (top) or the home indicator (bottom). Also pad the
    // sides for landscape notches.
    const safeTop = 'max(12px, env(safe-area-inset-top, 0px))';
    const safeBottom = 'max(16px, env(safe-area-inset-bottom, 0px))';
    const safeLeft = 'max(12px, env(safe-area-inset-left, 0px))';
    const safeRight = 'max(12px, env(safe-area-inset-right, 0px))';
    // Top-dock sits below the sticky app header (~64px) PLUS the safe-area top inset.
    const safeTopDock = 'calc(env(safe-area-inset-top, 0px) + 80px)';

    // PDF preview step: dock the tooltip just below the PDF panel so it sits
    // close to the itinerary instead of floating at the bottom of the screen.
    if (currentStep.id === 'preview-itinerary-pdf') {
      return isMobile
        ? { position: 'fixed', left: safeLeft, right: safeRight, top: safeTopDock, width: 'auto', maxHeight: '40vh', overflow: 'auto' }
        : { position: 'fixed', left: '50%', transform: 'translateX(-50%)', top: safeTopDock, width: 360 };
    }

    // 'center' placement always centers tooltip on screen, regardless of target
    if (currentStep.placement === 'center' || !targetRect) {
      if (isMobile) {
        return { position: 'fixed', left: safeLeft, right: safeRight, bottom: safeBottom, width: 'auto' };
      }
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    // Mobile: dock to top or bottom — but lock the choice once made so smooth
    // scroll doesn't cause the tooltip to flip across the screen.
    if (isMobile) {
      let dock = lockedMobileDock;
      if (!dock) {
        const targetMid = targetRect.top + targetRect.height / 2;
        dock = targetMid > window.innerHeight / 2 ? 'top' : 'bottom';
        setTimeout(() => setLockedMobileDock(dock!), 0);
      }
      return dock === 'top'
        ? { position: 'fixed', top: safeTopDock, left: safeLeft, right: safeRight, width: 'auto', transition: 'top 250ms ease, bottom 250ms ease' }
        : { position: 'fixed', bottom: safeBottom, left: safeLeft, right: safeRight, width: 'auto', transition: 'top 250ms ease, bottom 250ms ease' };
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

    let placement: Placement;
    if (lockedPlacement) {
      placement = lockedPlacement;
    } else {
      placement = (fits[preferred] ? preferred
        : fits.bottom ? 'bottom'
        : fits.right ? 'right'
        : fits.top ? 'top'
        : fits.left ? 'left'
        : 'bottom') as Placement;
      // Lock the chosen placement so it doesn't flip while we scroll into view.
      setTimeout(() => setLockedPlacement(placement), 0);
    }

    // Smooth positional transitions kill the "snap" feeling.
    const base: React.CSSProperties = {
      position: 'fixed',
      transition: 'top 250ms ease, left 250ms ease, right 250ms ease, bottom 250ms ease',
    };

    const minEdge = 12;
    const clampX = (cx: number) => Math.max(minEdge, Math.min(cx, window.innerWidth - tooltipWidth - minEdge));
    const clampY = (cy: number) => Math.max(minEdge, Math.min(cy, window.innerHeight - tooltipHeight - minEdge));
    // Clamp a `bottom` offset so the tooltip stays fully on-screen vertically.
    const clampBottom = (cb: number) => Math.max(minEdge, Math.min(cb, window.innerHeight - tooltipHeight - minEdge));
    // Clamp a `right` offset so the tooltip stays fully on-screen horizontally.
    const clampRight = (cr: number) => Math.max(minEdge, Math.min(cr, window.innerWidth - tooltipWidth - minEdge));

    switch (placement) {
      case 'bottom':
        base.top = clampY(targetRect.bottom + gap);
        base.left = clampX(targetRect.left + targetRect.width / 2 - tooltipWidth / 2);
        break;
      case 'top':
        base.bottom = clampBottom(window.innerHeight - targetRect.top + gap);
        base.left = clampX(targetRect.left + targetRect.width / 2 - tooltipWidth / 2);
        break;
      case 'right':
        base.top = clampY(targetRect.top + targetRect.height / 2 - tooltipHeight / 2);
        base.left = clampX(targetRect.right + gap);
        break;
      case 'left':
        base.top = clampY(targetRect.top + targetRect.height / 2 - tooltipHeight / 2);
        base.right = clampRight(window.innerWidth - targetRect.left + gap);
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

    const panelTransition = 'top 250ms ease, left 250ms ease, width 250ms ease, height 250ms ease, bottom 250ms ease, right 250ms ease';
    return (
      <>
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top: 0, left: 0, right: 0, height: Math.max(0, top), transition: panelTransition }} />
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top: bottom, left: 0, right: 0, bottom: 0, transition: panelTransition }} />
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top, left: 0, width: Math.max(0, left), height, transition: panelTransition }} />
        <div className={`fixed ${overlayPointerClass} bg-black/60`} style={{ top, left: right, right: 0, height, transition: panelTransition }} />
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

      {/* Spotlight ring — smooth transition + soft glow instead of pulse to avoid wobble */}
      {hasTarget && (
        <div
          className="absolute border-2 border-primary rounded-lg pointer-events-none"
          style={{
            top: targetRect!.top - padding,
            left: targetRect!.left - padding,
            width: targetRect!.width + padding * 2,
            height: targetRect!.height + padding * 2,
            transition: 'top 250ms ease, left 250ms ease, width 250ms ease, height 250ms ease',
            boxShadow: '0 0 24px hsl(var(--primary) / 0.45)',
          }}
        />
      )}

      {/* Inline PDF preview for the "this is a trip itinerary" step.
          The tooltip docks at the top, so the PDF panel starts below it. */}
      {isPdfPreviewStep && (
        <div
          className="fixed left-1/2 -translate-x-1/2 pointer-events-auto bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
          style={{
            // Reserve room for the top-docked tooltip (varies by content/safe area).
            top: 'calc(env(safe-area-inset-top, 0px) + 320px)',
            width: 'min(720px, calc(100vw - 16px))',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          }}
        >
          {isMobile ? (
            <PdfScrollViewer src={DEMO_PDF_PATH} title="Sample trip itinerary" />
          ) : (
            <iframe
              src={`${DEMO_PDF_PATH}#view=FitH`}
              title="Sample trip itinerary"
              className="w-full h-full"
            />
          )}
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
        onSkip={handleSkip}
      />
    </div>
  );
}
