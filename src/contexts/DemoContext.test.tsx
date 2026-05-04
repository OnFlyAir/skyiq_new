import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  DemoProvider,
  useDemo,
  FLEET_DEMO_STEPS,
  TRIP_DEMO_STEPS,
  PUBLIC_DEMO_STEPS,
  type DemoFlow,
  type DemoStep,
} from './DemoContext';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    }),
  },
}));

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useDemo>) => void }): ReactNode {
  const api = useDemo();
  onReady(api);
  return null;
}

function mount() {
  let api!: ReturnType<typeof useDemo>;
  render(
    <DemoProvider>
      <Harness onReady={(a) => (api = a)} />
    </DemoProvider>,
  );
  return {
    get api() {
      return api;
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const FLOWS: { name: DemoFlow; steps: DemoStep[] }[] = [
  { name: 'fleet', steps: FLEET_DEMO_STEPS },
  { name: 'trip', steps: TRIP_DEMO_STEPS },
  { name: 'public', steps: PUBLIC_DEMO_STEPS },
];

describe('Demo navigation regression', () => {
  it.each(FLOWS)('$name flow: every step has required fields', ({ steps }) => {
    expect(steps.length).toBeGreaterThan(0);
    const ids = new Set<string>();
    for (const s of steps) {
      expect(s.id, 'step.id required').toBeTruthy();
      expect(ids.has(s.id), `duplicate step id: ${s.id}`).toBe(false);
      ids.add(s.id);
      expect(typeof s.title).toBe('string');
      expect(typeof s.description).toBe('string');
      // page is either an absolute path or '' (keep current page)
      expect(typeof s.page).toBe('string');
      if (s.page) expect(s.page.startsWith('/')).toBe(true);
    }
  });

  it.each(FLOWS)('$name flow: Next walks through every step in order then ends demo', ({ name, steps }) => {
    const h = mount();
    act(() => h.api.startDemo(name));
    expect(h.api.active).toBe(true);
    expect(h.api.flow).toBe(name);
    expect(h.api.totalSteps).toBe(steps.length);

    for (let i = 0; i < steps.length; i++) {
      expect(h.api.currentStepIndex).toBe(i);
      expect(h.api.currentStep?.id).toBe(steps[i].id);
      act(() => h.api.nextStep());
    }
    // After the last Next, demo is over.
    expect(h.api.active).toBe(false);
    expect(h.api.currentStep).toBeNull();
  });

  it.each(FLOWS)(
    '$name flow: Back from the end skips post-action steps and lands on a real screen',
    ({ name, steps }) => {
      const h = mount();
      act(() => h.api.startDemo(name));
      // Jump to the final step.
      act(() => h.api.goToStep(steps.length - 1));
      expect(h.api.currentStepIndex).toBe(steps.length - 1);

      const visited: string[] = [];
      // Walk back to step 0, recording every landing step.
      while (h.api.currentStepIndex > 0) {
        const before = h.api.currentStepIndex;
        act(() => h.api.prevStep());
        const after = h.api.currentStepIndex;
        expect(after, 'prevStep must move backward').toBeLessThan(before);
        const landed = steps[after];
        // We must never land on a step flagged skipOnBack or a transient wait step.
        expect(landed.skipOnBack ?? false, `landed on skipOnBack step ${landed.id}`).toBe(false);
        expect(landed.action === 'wait', `landed on wait step ${landed.id}`).toBe(false);
        visited.push(landed.id);
      }
      expect(h.api.currentStepIndex).toBe(0);
      // Sanity: we visited at least one intermediate step on the way back.
      expect(visited.length).toBeGreaterThan(0);
    },
  );

  it.each(FLOWS)('$name flow: prevStep at index 0 is a no-op', ({ name }) => {
    const h = mount();
    act(() => h.api.startDemo(name));
    expect(h.api.currentStepIndex).toBe(0);
    act(() => h.api.prevStep());
    expect(h.api.currentStepIndex).toBe(0);
  });

  it('endDemo clears active state and storage', () => {
    const h = mount();
    act(() => h.api.startDemo('trip'));
    act(() => h.api.goToStep(3));
    expect(localStorage.getItem('skyiq_demo_active')).toBe('true');
    act(() => h.api.endDemo());
    expect(h.api.active).toBe(false);
    expect(h.api.flow).toBeNull();
    expect(localStorage.getItem('skyiq_demo_active')).toBeNull();
    expect(localStorage.getItem('skyiq_demo_step')).toBeNull();
    expect(localStorage.getItem('skyiq_demo_flow')).toBeNull();
  });

  it('public demo final step routes the user to the signup CTA (last step is terminal)', () => {
    const last = PUBLIC_DEMO_STEPS[PUBLIC_DEMO_STEPS.length - 1];
    expect(last.id).toBe('public-complete');
    // Terminal step must not require a click target — the Finish button ends the demo.
    expect(last.action).not.toBe('click');
  });

  it('trip + fleet demos end on a friendly recap step', () => {
    expect(TRIP_DEMO_STEPS[TRIP_DEMO_STEPS.length - 1].id).toBe('demo-complete');
    expect(FLEET_DEMO_STEPS[FLEET_DEMO_STEPS.length - 1].id).toBe('aircraft-saved');
  });
});
