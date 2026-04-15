import { useEffect, useState, useRef } from 'react';
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

    const findTarget = () => {
      const el = document.querySelector(`[data-demo="${currentStep.target}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        // Scroll into view if needed
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        setTargetRect(null);
      }
    };

    // Poll briefly for element to appear (page may still be rendering)
    const interval = setInterval(findTarget, 200);
    findTarget();
    return () => clearInterval(interval);
  }, [active, currentStep]);

  // Handle auto-advance on click
  useEffect(() => {
    if (!active || !currentStep?.autoAdvance || !currentStep.target) return;

    const handler = (e: MouseEvent) => {
      const el = document.querySelector(`[data-demo="${currentStep.target}"]`);
      if (el && (el === e.target || el.contains(e.target as Node))) {
        setTimeout(nextStep, 300);
      }
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [active, currentStep, nextStep]);

  if (!active || !currentStep) return null;

  const hasTarget = !!targetRect;
  const padding = 8;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      // Center on screen
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const placement = currentStep.placement || 'bottom';
    const base: React.CSSProperties = { position: 'fixed' };

    switch (placement) {
      case 'bottom':
        base.top = targetRect.bottom + padding + 8;
        base.left = targetRect.left + targetRect.width / 2;
        base.transform = 'translateX(-50%)';
        break;
      case 'top':
        base.bottom = window.innerHeight - targetRect.top + padding + 8;
        base.left = targetRect.left + targetRect.width / 2;
        base.transform = 'translateX(-50%)';
        break;
      case 'right':
        base.top = targetRect.top + targetRect.height / 2;
        base.left = targetRect.right + padding + 8;
        base.transform = 'translateY(-50%)';
        break;
      case 'left':
        base.top = targetRect.top + targetRect.height / 2;
        base.right = window.innerWidth - targetRect.left + padding + 8;
        base.transform = 'translateY(-50%)';
        break;
    }

    return base;
  };

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* Dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <defs>
          <mask id="demo-spotlight">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {hasTarget && (
              <rect
                x={targetRect!.left - padding}
                y={targetRect!.top - padding}
                width={targetRect!.width + padding * 2}
                height={targetRect!.height + padding * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#demo-spotlight)"
        />
      </svg>

      {/* Make target element clickable through overlay */}
      {hasTarget && (
        <div
          className="absolute pointer-events-auto"
          style={{
            top: targetRect!.top - padding,
            left: targetRect!.left - padding,
            width: targetRect!.width + padding * 2,
            height: targetRect!.height + padding * 2,
          }}
        />
      )}

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
        className="pointer-events-auto max-w-sm w-80"
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
              {!currentStep.autoAdvance && (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  {currentStepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
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
