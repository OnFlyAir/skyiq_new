import { useEffect } from 'react';
import type { DemoStep } from '@/contexts/DemoContext';

/**
 * Wires up auto-advance behavior for the active demo step:
 *  - 'click' / autoAdvance steps: advance after the user clicks the target
 *  - 'input' steps: advance once the input value matches the expected value
 *  - 'select' steps: advance when the target's text contains the expected value
 */
export function useDemoAutoAdvance(
  active: boolean,
  currentStep: DemoStep | null,
  nextStep: () => void,
) {
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
}
