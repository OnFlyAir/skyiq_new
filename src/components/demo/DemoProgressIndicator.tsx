import { useDemo } from '@/contexts/DemoContext';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

/**
 * Always-visible demo progress chip. Anchored to the top of the viewport
 * (below the safe-area inset) so the user can always see:
 *   - which step they're on (n / total)
 *   - the step's friendly title
 *   - the route that step lives on
 *   - a hint of what Back / Next will jump to
 *
 * Rendered by <DemoOverlay /> only when a demo is active.
 */
export default function DemoProgressIndicator() {
  const { active, currentStep, currentStepIndex, totalSteps, flow } = useDemo();

  if (!active || !currentStep) return null;

  // Reach into the same step list the context uses, without importing it
  // (we only need neighbour titles for the hint). currentStep already has
  // everything we need; the context exposes index + total.
  const stepNumber = currentStepIndex + 1;
  const route = currentStep.page || 'current screen';
  const flowLabel = flow === 'fleet' ? 'Fleet demo' : flow === 'trip' ? 'Plan-a-trip demo' : 'SkyIQ demo';

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[210] pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/95 backdrop-blur border border-border shadow-lg text-xs">
        <span className="font-semibold text-primary uppercase tracking-wide">
          {flowLabel}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="font-medium text-foreground">
          Step {stepNumber}/{totalSteps}
        </span>
        <span className="text-muted-foreground hidden sm:inline">·</span>
        <span className="text-foreground hidden sm:inline max-w-[220px] truncate">
          {currentStep.title}
        </span>
        <span className="text-muted-foreground hidden md:inline">·</span>
        <span className="hidden md:inline-flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="font-mono">{route}</span>
        </span>
      </div>

      {/* Nav hint pill — sits below the main chip */}
      <div className="pointer-events-none mt-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        {currentStepIndex > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <ChevronLeft className="h-3 w-3" />
            Back
          </span>
        )}
        {currentStepIndex > 0 && currentStepIndex < totalSteps - 1 && (
          <span className="opacity-50">·</span>
        )}
        {currentStepIndex < totalSteps - 1 && (
          <span className="inline-flex items-center gap-0.5">
            Next
            <ChevronRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}
