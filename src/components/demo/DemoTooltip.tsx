import { forwardRef } from 'react';
import { X, ArrowRight, ArrowLeft, Play } from 'lucide-react';
import type { DemoStep } from '@/contexts/DemoContext';

interface DemoTooltipProps {
  step: DemoStep;
  stepIndex: number;
  totalSteps: number;
  style: React.CSSProperties;
  showNextButton: boolean;
  isLastStep: boolean;
  isInteractiveStep: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export const DemoTooltip = forwardRef<HTMLDivElement, DemoTooltipProps>(function DemoTooltip(
  { step, stepIndex, totalSteps, style, showNextButton, isLastStep, isInteractiveStep, onNext, onPrev, onSkip },
  ref,
) {
  return (
    <div ref={ref} className="pointer-events-auto sm:max-w-sm sm:w-80" style={style}>
      <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-2">
            <Play className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              Demo
            </span>
          </div>
          <button
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground mb-1">{step.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
        </div>

        {/* Interaction hint for action steps */}
        {isInteractiveStep && !isLastStep && (
          <div className="px-4 pb-1">
            <p className="text-[10px] text-primary/70 italic">
              {step.action === 'input' ? '↑ Type the value above to continue'
                : step.action === 'select' ? '↑ Select the option from the dropdown to continue'
                : step.action === 'wait' ? '⏳ Please wait…'
                : '↑ Click the highlighted area to continue'}
            </p>
          </div>
        )}

        {/* Progress bar hidden — keeps demo length feeling light */}

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip demo
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={onPrev}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
            )}
            {(showNextButton || isLastStep) && (
              <button
                onClick={onNext}
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
  );
});
