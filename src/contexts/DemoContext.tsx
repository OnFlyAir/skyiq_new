import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type DemoFlow = 'fleet' | 'trip';

export interface DemoStep {
  id: string;
  page: string;
  target?: string;
  title: string;
  description: string;
  action?: 'click' | 'input' | 'select' | 'wait' | 'navigate';
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  autoAdvance?: boolean;
  inputValue?: string;
  highlightOnly?: boolean;
  requireAction?: boolean;
}

interface DemoContextType {
  active: boolean;
  flow: DemoFlow | null;
  currentStepIndex: number;
  currentStep: DemoStep | null;
  totalSteps: number;
  startDemo: (flow: DemoFlow) => void;
  endDemo: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

const DEMO_STORAGE_KEY = 'skyiq_demo_active';
const DEMO_STEP_KEY = 'skyiq_demo_step';
const DEMO_FLOW_KEY = 'skyiq_demo_flow';
export const DEMO_PDF_PATH = '/demo/sample-itinerary.pdf';

// ============================================================
// FLEET DEMO — adding an aircraft
// ============================================================
export const FLEET_DEMO_STEPS: DemoStep[] = [
  {
    id: 'fleet-welcome',
    page: '/fleet',
    title: 'Add an Aircraft 🛩️',
    description: "Let's add your first aircraft together. We'll pre-fill demo data so you can see how it works in under a minute.",
    placement: 'center',
  },
  {
    id: 'click-add-aircraft',
    page: '/fleet',
    target: 'add-aircraft-btn',
    title: 'Add Your First Aircraft',
    description: 'Click "Add Aircraft" to register a plane in your fleet.',
    placement: 'bottom',
    action: 'click',
    autoAdvance: true,
  },
  {
    id: 'select-manufacturer',
    page: '/fleet/add',
    target: 'manufacturer-select',
    title: 'Select Manufacturer',
    description: 'Click the dropdown and choose Cessna / Textron.',
    placement: 'top',
    action: 'select',
    inputValue: 'Cessna / Textron',
  },
  {
    id: 'select-model',
    page: '/fleet/add',
    target: 'model-select',
    title: 'Select Aircraft Type',
    description: 'Search for "CJ3" and choose Citation CJ3 (C525B) — this auto-fills all performance specs.',
    placement: 'top',
    action: 'select',
    inputValue: 'Citation CJ3',
  },
  {
    id: 'enter-tail',
    page: '/fleet/add',
    target: 'tail-number-input',
    title: 'Tail Number',
    description: "Enter your aircraft's tail number. For this demo, type NSKYIQ.",
    placement: 'bottom',
    action: 'input',
    inputValue: 'NSKYIQ',
  },
  {
    id: 'enter-bew',
    page: '/fleet/add',
    target: 'bew-input',
    title: 'Basic Empty Weight',
    description: "From your Weight & Balance report. Enter 8300 for the demo.",
    placement: 'bottom',
    action: 'input',
    inputValue: '8300',
  },
  {
    id: 'expand-performance',
    page: '/fleet/add',
    target: 'performance-defaults-toggle',
    title: 'Performance & Defaults',
    description: 'Click to expand and see the auto-filled specs and crew defaults SkyIQ uses for fuel optimization.',
    placement: 'bottom',
    action: 'click',
  },
  {
    id: 'review-performance',
    page: '/fleet/add',
    target: 'performance-defaults-section',
    title: 'Review Auto-Filled Data',
    description: 'MTOW, fuel capacity, cruise burn, reserves, penalty rate, and crew/pax defaults — adjust any that differ for your aircraft.',
    placement: 'top',
  },
  {
    id: 'click-save',
    page: '/fleet/add',
    target: 'save-aircraft-btn',
    title: 'Save Aircraft',
    description: 'Looks good — click Save to add this aircraft to your fleet.',
    placement: 'top',
    action: 'click',
    autoAdvance: true,
  },
  {
    id: 'aircraft-saved',
    page: '/fleet',
    title: "Great job! 🎉",
    description: "Your aircraft is in your fleet. When you're ready, run the Plan a Trip demo from your Dashboard.",
    placement: 'center',
  },
];

// ============================================================
// TRIP DEMO — planning a trip
// ============================================================
export const TRIP_DEMO_STEPS: DemoStep[] = [
  {
    id: 'trip-welcome',
    page: '/trips/new',
    title: 'Plan a Trip ✈️',
    description: "We'll walk through uploading a sample itinerary, entering fuel burns, and generating an optimized fuel plan.",
    placement: 'center',
  },
  {
    id: 'upload-pdf',
    page: '/trips/new',
    target: 'upload-pdf-area',
    title: 'Upload Your Trip Sheet',
    description: "Upload a PDF and SkyIQ extracts every flight detail. We'll use a sample itinerary for the demo.",
    placement: 'bottom',
    action: 'click',
    autoAdvance: true,
  },
  {
    id: 'select-sample-file',
    page: '',
    target: 'demo-sample-file',
    title: 'Select the Itinerary',
    description: 'Click the sample trip sheet to load it. SkyIQ will parse and extract all leg details.',
    placement: 'bottom',
    action: 'click',
  },
  {
    id: 'wait-for-parse',
    page: '',
    title: 'Parsing Your Itinerary',
    description: "SkyIQ is reading your trip sheet. This usually takes a few seconds…",
    placement: 'center',
    action: 'wait',
    requireAction: true,
  },
  {
    id: 'explain-leg-departure',
    page: '',
    target: 'leg-1-departure',
    title: 'Departure Airport',
    description: "ICAO code of the airport you're departing from for this leg.",
    placement: 'bottom',
  },
  {
    id: 'explain-leg-destination',
    page: '',
    target: 'leg-1-destination',
    title: 'Destination Airport',
    description: 'Where this leg ends. Fuel prices and fees here are factored into optimization.',
    placement: 'bottom',
  },
  {
    id: 'explain-leg-fuel-price',
    page: '',
    target: 'leg-1-fuel-price',
    title: 'Fuel Price',
    description: 'Price per gallon at the departure airport. SkyIQ compares prices across legs to find savings.',
    placement: 'bottom',
  },
  {
    id: 'explain-leg-fees',
    page: '',
    target: 'leg-1-fees',
    title: 'Airport Fees',
    description: 'Ramp/handling fees. Some can be waived with a fuel purchase — SkyIQ accounts for that.',
    placement: 'center',
  },
  {
    id: 'verify-legs',
    page: '',
    target: 'verify-leg-btn',
    title: 'Verify Each Leg',
    description: "Click the checkmark on Leg 1 to confirm. (We'll auto-confirm the rest.)",
    placement: 'center',
    action: 'click',
    requireAction: true,
  },
  {
    id: 'explain-trash',
    page: '',
    target: 'delete-leg-btn',
    title: 'Delete a Leg',
    description: 'Use the trash icon to remove legs already flown or not needed.',
    placement: 'center',
  },
  {
    id: 'explain-add-leg',
    page: '',
    target: 'add-leg-btn',
    title: 'Add More Legs',
    description: 'Need more legs? Click here to upload more itineraries or add legs manually.',
    placement: 'center',
  },
  {
    id: 'click-fuel-burns',
    page: '',
    target: 'next-fuel-burns-btn',
    title: 'Next: Fuel Burns',
    description: 'Legs look good! Click "Next: Fuel Burns" to continue.',
    placement: 'center',
    action: 'click',
    requireAction: true,
  },
  {
    id: 'enter-starting-fuel',
    page: '',
    target: 'starting-fuel-input',
    title: 'Current Fuel on Board',
    description: 'Enter the fuel currently in the aircraft. For this demo, type 1000.',
    placement: 'right',
    action: 'input',
    inputValue: '1000',
    requireAction: true,
  },
  {
    id: 'enter-burn-leg-1',
    page: '',
    target: 'fuel-burn-leg-1',
    title: 'Leg 1 Fuel Burn',
    description: 'Enter the fuel burn for Leg 1: 700.',
    placement: 'right',
    action: 'input',
    inputValue: '700',
    requireAction: true,
  },
  {
    id: 'enter-burn-leg-2',
    page: '',
    target: 'fuel-burn-leg-2',
    title: 'Leg 2 Fuel Burn',
    description: 'Enter the fuel burn for Leg 2: 1800.',
    placement: 'right',
    action: 'input',
    inputValue: '1800',
    requireAction: true,
  },
  {
    id: 'enter-burn-leg-3',
    page: '',
    target: 'fuel-burn-leg-3',
    title: 'Leg 3 Fuel Burn',
    description: 'Enter the fuel burn for Leg 3: 2600.',
    placement: 'right',
    action: 'input',
    inputValue: '2600',
    requireAction: true,
  },
  {
    id: 'enter-burn-leg-4',
    page: '',
    target: 'fuel-burn-leg-4',
    title: 'Leg 4 Fuel Burn',
    description: 'Enter the fuel burn for Leg 4: 2300.',
    placement: 'right',
    action: 'input',
    inputValue: '2300',
    requireAction: true,
  },
  {
    id: 'enter-burn-leg-5',
    page: '',
    target: 'fuel-burn-leg-5',
    title: 'Leg 5 Fuel Burn',
    description: 'Enter the fuel burn for Leg 5: 2700.',
    placement: 'right',
    action: 'input',
    inputValue: '2700',
    requireAction: true,
  },
  {
    id: 'enter-burn-leg-6',
    page: '',
    target: 'fuel-burn-leg-6',
    title: 'Leg 6 Fuel Burn',
    description: 'Enter the fuel burn for Leg 6: 1000.',
    placement: 'right',
    action: 'input',
    inputValue: '1000',
    requireAction: true,
  },
  {
    id: 'expand-weights',
    page: '',
    target: 'weight-limits-toggle',
    title: 'Weight Limits',
    description: 'Each leg has weight limits — tap "Weight limits" to see constraints. SkyIQ keeps your fuel plan within them.',
    placement: 'center',
  },
  {
    id: 'click-confirm',
    page: '',
    target: 'confirm-trip-btn',
    title: 'Confirm Trip',
    description: 'Everything is set — click "Confirm Trip" to run the fuel optimizer!',
    placement: 'center',
    action: 'click',
    autoAdvance: true,
    requireAction: true,
  },
  {
    id: 'explain-strategy',
    page: '',
    target: 'optimizer-strategy',
    title: 'Optimization Strategy',
    description: "The high-level approach the optimizer used — tankering, buying at cheaper stops, or a balanced mix.",
    placement: 'bottom',
  },
  {
    id: 'explain-summary-leg1',
    page: '',
    target: 'summary-leg-1',
    title: 'Leg 1 Breakdown',
    description: "The optimized fuel plan for Leg 1 — load, expected cost, and savings vs. buying at each stop.",
    placement: 'bottom',
  },
  {
    id: 'click-send-email',
    page: '',
    target: 'send-email-btn',
    title: 'Send Email',
    description: 'Share your fuel plan with your team. Click "Send Email".',
    placement: 'center',
    action: 'click',
    autoAdvance: true,
    requireAction: true,
  },
  {
    id: 'enter-email',
    page: '',
    target: 'email-input',
    title: 'Enter Your Email',
    description: "Type your email address and click Send. You'll get the fuel plan summary in your inbox.",
    placement: 'bottom',
  },
  {
    id: 'demo-complete',
    page: '',
    title: "You're Ready! 🚀",
    description: 'Past trips live in the sidebar. Restart either demo anytime from your Dashboard. Questions? Email info@skyiq.net.',
    placement: 'center',
  },
];

function getSteps(flow: DemoFlow | null): DemoStep[] {
  if (flow === 'fleet') return FLEET_DEMO_STEPS;
  if (flow === 'trip') return TRIP_DEMO_STEPS;
  return [];
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(() => localStorage.getItem(DEMO_STORAGE_KEY) === 'true');
  const [flow, setFlow] = useState<DemoFlow | null>(() => {
    const saved = localStorage.getItem(DEMO_FLOW_KEY);
    return saved === 'fleet' || saved === 'trip' ? saved : null;
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    const saved = localStorage.getItem(DEMO_STEP_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });

  const steps = getSteps(flow);
  const currentStep = active ? steps[currentStepIndex] ?? null : null;

  const startDemo = useCallback((nextFlow: DemoFlow) => {
    setActive(true);
    setFlow(nextFlow);
    setCurrentStepIndex(0);
    localStorage.setItem(DEMO_STORAGE_KEY, 'true');
    localStorage.setItem(DEMO_FLOW_KEY, nextFlow);
    localStorage.setItem(DEMO_STEP_KEY, '0');
  }, []);

  const endDemo = useCallback(() => {
    setActive(false);
    setFlow(null);
    localStorage.removeItem(DEMO_STORAGE_KEY);
    localStorage.removeItem(DEMO_STEP_KEY);
    localStorage.removeItem(DEMO_FLOW_KEY);
    localStorage.setItem('skyiq_walkthrough_completed', 'true');
  }, []);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
      localStorage.setItem(DEMO_STEP_KEY, String(index));
    }
  }, [steps.length]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      endDemo();
    }
  }, [currentStepIndex, steps.length, goToStep, endDemo]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  return (
    <DemoContext.Provider
      value={{
        active,
        flow,
        currentStepIndex,
        currentStep,
        totalSteps: steps.length,
        startDemo,
        endDemo,
        nextStep,
        prevStep,
        goToStep,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

const defaultContext: DemoContextType = {
  active: false,
  flow: null,
  currentStepIndex: 0,
  currentStep: null,
  totalSteps: 0,
  startDemo: () => {},
  endDemo: () => {},
  nextStep: () => {},
  prevStep: () => {},
  goToStep: () => {},
};

export function useDemo() {
  const context = useContext(DemoContext);
  return context ?? defaultContext;
}
