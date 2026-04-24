import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type DemoFlow = 'fleet' | 'trip' | 'public';

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
  /** When user clicks Next on the tooltip, also click this data-demo target (e.g. to advance the page). */
  clickOnNext?: string;
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
// All inputs auto-fill in demo mode. User just clicks Next/Back.
// ============================================================
export const FLEET_DEMO_STEPS: DemoStep[] = [
  {
    id: 'fleet-welcome',
    page: '/fleet',
    title: 'Add an Aircraft 🛩️',
    description: "Let's add a sample aircraft. We'll auto-fill everything — just click Next to walk through.",
    placement: 'center',
  },
  {
    id: 'click-add-aircraft',
    page: '/fleet',
    target: 'add-aircraft-btn',
    title: 'Add Aircraft',
    description: 'This is where you add a new aircraft to your fleet. Click Next to continue.',
    placement: 'bottom',
  },
  {
    id: 'review-aircraft-form',
    page: '/fleet/add',
    target: 'manufacturer-select',
    title: 'Pick Manufacturer & Model',
    description: "We've pre-selected a Cessna Citation CJ3 for the demo. Selecting a model auto-fills all performance specs.",
    placement: 'bottom',
  },
  {
    id: 'review-tail-bew',
    page: '/fleet/add',
    target: 'tail-number-input',
    title: 'Tail Number & Empty Weight',
    description: "Tail number and basic empty weight come from your aircraft's W&B report. Pre-filled for the demo.",
    placement: 'bottom',
  },
  {
    id: 'review-performance',
    page: '/fleet/add',
    target: 'performance-defaults-section',
    title: 'Performance & Defaults',
    description: 'MTOW, fuel capacity, cruise burn, reserves, and crew/pax defaults — all auto-filled from the aircraft model. Tweak any value if needed.',
    placement: 'top',
  },
  {
    id: 'click-save',
    page: '/fleet/add',
    target: 'save-aircraft-btn',
    title: 'Save Aircraft',
    description: "Click Next and we'll save the aircraft to your fleet.",
    placement: 'top',
    action: 'click',
    autoAdvance: true,
  },
  {
    id: 'aircraft-saved',
    page: '/fleet',
    title: "Done! 🎉",
    description: "Your aircraft is in your fleet. When you're ready, run the Plan a Trip demo from your Dashboard.",
    placement: 'center',
  },
];

// ============================================================
// TRIP DEMO — planning a trip
// All data auto-fills in demo mode. User just clicks Next/Back.
// ============================================================
export const TRIP_DEMO_STEPS: DemoStep[] = [
  {
    id: 'trip-welcome',
    page: '/trips/new',
    title: 'Plan a Trip ✈️',
    description: "We'll auto-load a sample itinerary and walk you through the fuel optimizer. Just click Next.",
    placement: 'center',
  },
  {
    id: 'preview-itinerary-pdf',
    page: '/trips/new',
    title: 'This Is a Trip Itinerary 📄',
    description: "Here's the kind of PDF an operator receives — pickup times, legs, passengers, fuel notes. Scroll through it, then click Next to upload it.",
    placement: 'center',
  },
  {
    id: 'upload-pdf',
    page: '/trips/new',
    target: 'upload-pdf-area',
    title: 'Upload Your Trip Sheet',
    description: "In real use you'd upload a PDF here and SkyIQ extracts every flight detail. We'll load the sample now — click Next.",
    placement: 'bottom',
    action: 'click',
    autoAdvance: true,
  },
  {
    id: 'wait-for-parse',
    page: '',
    title: 'Parsing Your Itinerary',
    description: "SkyIQ is reading the trip sheet. This usually takes a few seconds…",
    placement: 'center',
    action: 'wait',
    requireAction: true,
  },
  {
    id: 'explain-leg-route',
    page: '',
    target: 'leg-1-route',
    title: 'Departure & Destination',
    description: "Every leg starts with departure and destination ICAOs — SkyIQ pulls these from your trip sheet automatically.",
    placement: 'bottom',
  },
  {
    id: 'explain-leg-fuel-price',
    page: '',
    target: 'leg-1-fuel-price',
    title: 'How Price Is Calculated',
    description: "Fuel prices ($/gal) are parsed directly from your trip sheet at each stop, multiplied by gallons uplifted, plus ramp/handling fees minus any waivers. That total is what the optimizer minimizes across the whole trip.",
    placement: 'top',
  },
  {
    id: 'explain-leg-weights',
    page: '',
    target: 'leg-1-weights-limits',
    title: 'Weights & Aircraft Limits',
    description: "Crew, passengers, and baggage define the trip's payload. MTOW, MLW, and ramp limits cap how much fuel you can legally carry — SkyIQ respects all of these on every leg.",
    placement: 'top',
  },
  {
    id: 'explain-verify-leg',
    page: '',
    target: 'verify-progress',
    title: 'Verify Each Leg',
    description: "AI parsing is fast but you stay in control. Confirm each leg with the green check to make sure every detail matches your trip sheet — this bar tracks your progress.",
    placement: 'bottom',
  },
  {
    id: 'explain-add-leg',
    page: '',
    target: 'add-leg-btn',
    title: 'Add or Remove Legs',
    description: 'Need more legs? Add them here. Use the trash icon on a leg to remove it.',
    placement: 'top',
  },
  {
    id: 'click-fuel-burns',
    page: '',
    target: 'next-fuel-burns-btn',
    title: 'Next: Fuel Burns',
    description: "Click Next and we'll move on to enter fuel burns.",
    placement: 'top',
    action: 'click',
    autoAdvance: true,
  },
  {
    id: 'review-starting-fuel',
    page: '',
    target: 'starting-fuel-input',
    title: 'Fuel On Board',
    description: "We start with the fuel already on the aircraft so the optimizer doesn't tell you to buy fuel you already have. Pre-filled here for the demo.",
    placement: 'bottom',
  },
  {
    id: 'review-fuel-burns',
    page: '',
    target: 'fuel-burn-leg-1',
    title: 'Fuel Burns',
    description: "Fuel burns come straight from your flight plan for each leg. We've entered them here for the demo so you can keep clicking Next.",
    placement: 'top',
  },
  {
    id: 'expand-weights',
    page: '',
    target: 'weight-limits-toggle',
    title: 'Weight Limits',
    description: 'Tap here to expand each leg’s weight limits. SkyIQ keeps your fuel plan within MTOW, MLW, and ramp limits automatically.',
    placement: 'top',
  },
  {
    id: 'click-confirm',
    page: '',
    target: 'confirm-trip-btn',
    title: 'Confirm Trip',
    description: 'Everything is set — click Next to run the fuel optimizer!',
    placement: 'top',
    action: 'click',
    autoAdvance: true,
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
    title: 'Per-Leg Breakdown',
    description: "The optimized fuel load, expected cost, and savings vs. buying fuel at every stop.",
    placement: 'bottom',
  },
  {
    id: 'click-send-email',
    page: '',
    target: 'send-email-btn',
    title: 'Share with Your Team',
    description: 'Send the fuel plan to your crew or dispatcher. Click Next to see how.',
    placement: 'top',
    action: 'click',
    autoAdvance: true,
  },
  {
    id: 'demo-complete',
    page: '',
    title: "You're Ready! 🚀",
    description: 'Past trips live in the sidebar. Restart either demo anytime from your Dashboard. Questions? Email info@skyiq.net.',
    placement: 'center',
  },
];

// ============================================================
// PUBLIC DEMO — short outward-facing tour shown from the login page.
// 7 high-level steps: welcome → what an itinerary is → upload/parse →
// data pulled → fuel burns → optimizer → email. Auto-fills everything.
// ============================================================
export const PUBLIC_DEMO_STEPS: DemoStep[] = [
  {
    id: 'public-welcome',
    page: '/trips/new',
    title: 'Welcome to SkyIQ ✈️',
    description: "In about 60 seconds you'll see how SkyIQ turns a trip sheet into an optimized fuel plan. Just click Next — we'll do the typing for you.",
    placement: 'center',
  },
  {
    id: 'preview-itinerary-pdf',
    page: '/trips/new',
    title: 'This Is a Trip Itinerary 📄',
    description: "Here's the kind of PDF an operator receives — pickup times, legs, passengers, fuel notes. Scroll through it, then click Next.",
    placement: 'center',
  },
  {
    id: 'upload-pdf',
    page: '/trips/new',
    target: 'upload-pdf-area',
    title: 'Upload & AI Pulls the Data',
    description: "Drop a PDF here and SkyIQ's AI pulls every detail — routes, prices, passengers, weights, fees. Click Next and we'll upload the sample.",
    placement: 'bottom',
    action: 'click',
    autoAdvance: true,
  },
  {
    id: 'public-data-pulled',
    page: '',
    target: 'leg-1-card',
    title: 'All Data Is Pulled Automatically ✨',
    description: "Routes, fuel prices, passengers, weights, fees — every detail is extracted from the trip sheet. You just confirm each leg looks right. Click Next to move on to fuel burns.",
    placement: 'right',
    clickOnNext: 'next-fuel-burns-btn',
  },
  {
    id: 'public-fuel-burns',
    page: '',
    target: 'fuel-burn-leg-1',
    title: 'Enter Fuel Burns',
    description: "Burns from your flight plan go here for each leg. We've filled them in for the demo. Click Next to run the optimizer.",
    placement: 'top',
    clickOnNext: 'confirm-trip-btn',
  },
  {
    id: 'public-optimizer',
    page: '',
    target: 'optimizer-strategy',
    title: 'Optimized Fuel Plan',
    description: "SkyIQ picked the cheapest legal fuel strategy across every leg — tankering, fee waivers, volume discounts, weight limits, all considered. Per-leg savings are shown below.",
    placement: 'bottom',
  },
  {
    id: 'click-send-email',
    page: '',
    target: 'send-email-btn',
    title: 'Email to Your Team',
    description: "Send the fuel plan to anyone — pilots, dispatchers, FBOs. Click Next to see how.",
    placement: 'top',
    action: 'click',
    autoAdvance: true,
  },
  {
    id: 'public-complete',
    page: '',
    title: "That's SkyIQ! 🚀",
    description: 'Sign up for $1 to start saving on your own trips. Questions? Email info@skyiq.net.',
    placement: 'center',
  },
];

function getSteps(flow: DemoFlow | null): DemoStep[] {
  if (flow === 'fleet') return FLEET_DEMO_STEPS;
  if (flow === 'trip') return TRIP_DEMO_STEPS;
  if (flow === 'public') return PUBLIC_DEMO_STEPS;
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
