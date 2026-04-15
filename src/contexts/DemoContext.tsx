import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export interface DemoStep {
  id: string;
  page: string;                    // route the step lives on
  target?: string;                 // data-demo="<target>" selector
  title: string;
  description: string;
  action?: 'click' | 'input' | 'wait' | 'navigate';
  placement?: 'top' | 'bottom' | 'left' | 'right';
  autoAdvance?: boolean;           // advance when target is clicked
  inputValue?: string;             // for pre-fill steps
  highlightOnly?: boolean;         // no "Next" — just spotlight
}

interface DemoContextType {
  active: boolean;
  currentStepIndex: number;
  currentStep: DemoStep | null;
  totalSteps: number;
  startDemo: () => void;
  endDemo: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

const DEMO_STORAGE_KEY = 'skyiq_demo_active';
const DEMO_STEP_KEY = 'skyiq_demo_step';

// Step definitions — will be expanded as we wire pages
export const DEMO_STEPS: DemoStep[] = [
  // Step 0: Welcome
  {
    id: 'welcome',
    page: '/dashboard',
    title: 'Welcome to SkyIQ!',
    description: 'Let\'s walk through the basics together. This interactive demo will guide you through adding an aircraft and planning your first trip.',
    placement: 'bottom',
  },
  // Step 1: Click Dashboard
  {
    id: 'click-dashboard',
    page: '/dashboard',
    target: 'nav-dashboard',
    title: 'Dashboard',
    description: 'This is your home base — you\'ll see recent trips and quick actions here.',
    placement: 'right',
    action: 'click',
  },
  // Step 2: Click Manage Fleet
  {
    id: 'click-fleet',
    page: '/dashboard',
    target: 'nav-fleet',
    title: 'Manage Fleet',
    description: 'Click here to manage your aircraft fleet.',
    placement: 'right',
    action: 'click',
    autoAdvance: true,
  },
  // Step 3: Click Add Aircraft
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
  // Step 4: Enter tail number
  {
    id: 'enter-tail',
    page: '/fleet/add',
    target: 'tail-number-input',
    title: 'Tail Number',
    description: 'Enter your aircraft\'s tail number. For this demo, use NSKYIQ.',
    placement: 'bottom',
    action: 'input',
    inputValue: 'NSKYIQ',
  },
  // Step 5: Enter BEW
  {
    id: 'enter-bew',
    page: '/fleet/add',
    target: 'bew-input',
    title: 'Basic Empty Weight',
    description: 'This is from your aircraft\'s Weight & Balance report. Enter 8300 for the demo.',
    placement: 'bottom',
    action: 'input',
    inputValue: '8300',
  },
  // Step 6: Select manufacturer
  {
    id: 'select-manufacturer',
    page: '/fleet/add',
    target: 'manufacturer-select',
    title: 'Select Manufacturer',
    description: 'Choose Cessna/Textron from the dropdown.',
    placement: 'bottom',
    action: 'click',
  },
  // Step 7: Select model
  {
    id: 'select-model',
    page: '/fleet/add',
    target: 'model-select',
    title: 'Select Aircraft Type',
    description: 'Choose CE525b CJ3 — this auto-fills all performance specs.',
    placement: 'bottom',
    action: 'click',
  },
  // Steps 8–13: Quick field explanations
  {
    id: 'explain-mtow',
    page: '/fleet/add',
    target: 'field-mtow',
    title: 'Max Takeoff Weight (MTOW)',
    description: 'The maximum weight the aircraft is allowed to be at takeoff. Auto-filled from the model database.',
    placement: 'right',
  },
  {
    id: 'explain-fuel-capacity',
    page: '/fleet/add',
    target: 'field-max-fuel',
    title: 'Max Fuel Capacity',
    description: 'How much fuel your tanks can hold. SkyIQ uses this to ensure optimal fuel loads stay within limits.',
    placement: 'right',
  },
  {
    id: 'explain-cruise-burn',
    page: '/fleet/add',
    target: 'field-cruise-burn',
    title: 'Cruise Fuel Burn',
    description: 'Average gallons burned per hour in cruise flight. Used to calculate fuel needed for each leg.',
    placement: 'right',
  },
  {
    id: 'explain-reserve',
    page: '/fleet/add',
    target: 'field-reserve',
    title: 'Preferred Reserve',
    description: 'The minimum fuel reserve you want to keep on board after landing. Safety first!',
    placement: 'right',
  },
  {
    id: 'explain-penalty',
    page: '/fleet/add',
    target: 'field-penalty',
    title: 'Penalty Rate',
    description: 'Extra fuel burn per lb of excess fuel carried. Heavier planes burn more — this accounts for that.',
    placement: 'right',
  },
  {
    id: 'explain-defaults',
    page: '/fleet/add',
    target: 'field-crew-defaults',
    title: 'Crew & Passenger Defaults',
    description: 'Default weights for PIC, SIC, passengers, and baggage. These pre-fill on every trip so you don\'t have to re-enter them.',
    placement: 'top',
  },
  // Step 14: Click save
  {
    id: 'click-save',
    page: '/fleet/add',
    target: 'save-aircraft-btn',
    title: 'Save Aircraft',
    description: 'Everything looks good — click Save to add this aircraft to your fleet!',
    placement: 'top',
    action: 'click',
    autoAdvance: true,
  },
  // Step 15: Success message
  {
    id: 'aircraft-saved',
    page: '/fleet',
    title: 'Great job! 🎉',
    description: 'Your aircraft is now in your fleet. You\'re ready to plan your first trip!',
    placement: 'bottom',
  },
  // Step 16: Click Plan a Trip
  {
    id: 'click-plan-trip',
    page: '/fleet',
    target: 'nav-plan-trip',
    title: 'Plan a Trip',
    description: 'Now let\'s plan your first fuel-optimized trip. Click "Plan a Trip" in the sidebar.',
    placement: 'right',
    action: 'click',
    autoAdvance: true,
  },
  // Step 17: Upload PDF
  {
    id: 'upload-pdf',
    page: '/trips/new',
    target: 'upload-pdf-area',
    title: 'Upload Your Trip Sheet',
    description: 'Upload a PDF trip itinerary and SkyIQ will automatically extract all the flight details. For this demo, click to select the sample file.',
    placement: 'bottom',
    action: 'click',
  },
  // Steps 18+: TBD — need PDF and fuel burn data from user
  {
    id: 'demo-pause',
    page: '/trips/new',
    title: 'More Steps Coming Soon',
    description: 'The remaining demo steps (itinerary review, fuel burns, summary, and email) will be activated once we have the demo PDF and fuel burn data. For now, feel free to explore on your own!',
    placement: 'bottom',
  },
  // Final step placeholder
  {
    id: 'demo-complete',
    page: '/dashboard',
    title: 'You\'re Ready! 🚀',
    description: 'You now know the basics of SkyIQ. There are more features to discover as you go. You can restart this demo anytime from the DEMO button in the sidebar. For questions, email info@skyiq.net.',
    placement: 'bottom',
  },
];

export function DemoProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(() => localStorage.getItem(DEMO_STORAGE_KEY) === 'true');
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    const saved = localStorage.getItem(DEMO_STEP_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });

  const currentStep = active ? DEMO_STEPS[currentStepIndex] ?? null : null;

  const startDemo = useCallback(() => {
    setActive(true);
    setCurrentStepIndex(0);
    localStorage.setItem(DEMO_STORAGE_KEY, 'true');
    localStorage.setItem(DEMO_STEP_KEY, '0');
  }, []);

  const endDemo = useCallback(() => {
    setActive(false);
    localStorage.removeItem(DEMO_STORAGE_KEY);
    localStorage.removeItem(DEMO_STEP_KEY);
    // Mark walkthrough as completed too
    localStorage.setItem('skyiq_walkthrough_completed', 'true');
  }, []);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < DEMO_STEPS.length) {
      setCurrentStepIndex(index);
      localStorage.setItem(DEMO_STEP_KEY, String(index));
    }
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < DEMO_STEPS.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      endDemo();
    }
  }, [currentStepIndex, goToStep, endDemo]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  return (
    <DemoContext.Provider
      value={{
        active,
        currentStepIndex,
        currentStep,
        totalSteps: DEMO_STEPS.length,
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

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used within DemoProvider');
  return context;
}
