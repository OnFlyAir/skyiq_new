import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export interface DemoStep {
  id: string;
  page: string;                    // route the step lives on
  target?: string;                 // data-demo="<target>" selector
  title: string;
  description: string;
  action?: 'click' | 'input' | 'select' | 'wait' | 'navigate';
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
export const DEMO_PDF_PATH = '/demo/sample-itinerary.pdf';

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
  // Step 4: Select manufacturer
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
  // Step 5: Select model
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
  // Step 6: Enter tail number
  {
    id: 'enter-tail',
    page: '/fleet/add',
    target: 'tail-number-input',
    title: 'Tail Number',
    description: 'Enter your aircraft\'s tail number. For this demo, type NSKYIQ.',
    placement: 'bottom',
    action: 'input',
    inputValue: 'NSKYIQ',
  },
  // Step 7: Enter BEW
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
  // Step 8: Expand performance & defaults
  {
    id: 'expand-performance',
    page: '/fleet/add',
    target: 'performance-defaults-toggle',
    title: 'Performance & Defaults',
    description: 'Click to expand this section and see all the auto-filled performance specs and crew defaults we take into account for fuel optimization.',
    placement: 'bottom',
    action: 'click',
  },
  // Step 9: Review the expanded section
  {
    id: 'review-performance',
    page: '/fleet/add',
    target: 'performance-defaults-section',
    title: 'Review Auto-Filled Data',
    description: 'These values were auto-populated from the model database — MTOW, fuel capacity, cruise burn, reserves, penalty rate, and crew/pax defaults. Adjust any that differ for your specific aircraft.',
    placement: 'top',
  },
  // Step 10: Click save
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
  // Step 11: Success message
  {
    id: 'aircraft-saved',
    page: '/fleet',
    title: 'Great job! 🎉',
    description: 'Your aircraft is now in your fleet. You\'re ready to plan your first trip!',
    placement: 'bottom',
  },
  // Step 12: Click Plan a Trip
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
  // Step 13: Upload PDF
  {
    id: 'upload-pdf',
    page: '/trips/new',
    target: 'upload-pdf-area',
    title: 'Upload Your Trip Sheet',
    description: 'Upload a PDF trip itinerary and SkyIQ will automatically extract all the flight details. For this demo, we\'ll use a sample itinerary.',
    placement: 'bottom',
    action: 'click',
  },
  // Step 14: Check itinerary
  {
    id: 'check-itinerary',
    page: '/trips/new',
    target: 'check-itinerary-btn',
    title: 'Check Itinerary',
    description: 'Click "Check Itinerary" to parse the PDF and populate the legs. Verify the info matches your trip sheet.',
    placement: 'bottom',
    action: 'click',
    autoAdvance: true,
  },
  // Steps 15–18: Walk through leg 1 fields
  {
    id: 'explain-leg-departure',
    page: '',  // dynamic — set by tripId
    target: 'leg-1-departure',
    title: 'Departure Airport',
    description: 'The ICAO code of the airport you\'re departing from for this leg.',
    placement: 'bottom',
  },
  {
    id: 'explain-leg-destination',
    page: '',
    target: 'leg-1-destination',
    title: 'Destination Airport',
    description: 'Where this leg ends. Fuel prices and fees at this airport are factored into optimization.',
    placement: 'bottom',
  },
  {
    id: 'explain-leg-fuel-price',
    page: '',
    target: 'leg-1-fuel-price',
    title: 'Fuel Price',
    description: 'The price per gallon at the departure airport. SkyIQ compares prices across all legs to find savings.',
    placement: 'bottom',
  },
  {
    id: 'explain-leg-fees',
    page: '',
    target: 'leg-1-fees',
    title: 'Airport Fees',
    description: 'Ramp fees, handling fees, etc. Some can be waived with a fuel purchase — SkyIQ accounts for that.',
    placement: 'bottom',
  },
  // Step 19: Verify legs
  {
    id: 'verify-legs',
    page: '',
    target: 'verify-leg-btn',
    title: 'Verify Each Leg',
    description: 'Click the checkmark to confirm each leg\'s data is correct. Review all legs before proceeding.',
    placement: 'bottom',
    action: 'click',
  },
  // Step 20: Point out trash icon
  {
    id: 'explain-trash',
    page: '',
    target: 'delete-leg-btn',
    title: 'Delete a Leg',
    description: 'Use the trash icon to remove any legs already flown or not needed for this trip.',
    placement: 'left',
  },
  // Step 21: Point out add leg
  {
    id: 'explain-add-leg',
    page: '',
    target: 'add-leg-btn',
    title: 'Add More Legs',
    description: 'Need more legs? Click here to upload additional itineraries or manually add legs.',
    placement: 'top',
  },
  // Step 22: Click Next: Fuel Burns
  {
    id: 'click-fuel-burns',
    page: '',
    target: 'next-fuel-burns-btn',
    title: 'Next: Fuel Burns',
    description: 'Legs look good! Click "Next: Fuel Burns" to enter your fuel burn data.',
    placement: 'top',
    action: 'click',
    autoAdvance: true,
  },
  // Step 23: Enter fuel burns
  {
    id: 'enter-fuel-burns',
    page: '',
    target: 'fuel-burn-inputs',
    title: 'Enter Fuel Burns',
    description: 'Enter the fuel burn for each leg: Leg 1: 700, Leg 2: 1800, Leg 3: 2600, Leg 4: 2300, Leg 5: 2700, Leg 6: 1000.',
    placement: 'right',
  },
  // Step 24: Expand weight limits
  {
    id: 'expand-weights',
    page: '',
    target: 'weight-limits-toggle',
    title: 'Weight Limits',
    description: 'Expand this to see the weight constraints for each leg. SkyIQ ensures your fuel plan stays within limits.',
    placement: 'bottom',
    action: 'click',
  },
  // Step 25: Click Confirm Trip
  {
    id: 'click-confirm',
    page: '',
    target: 'confirm-trip-btn',
    title: 'Confirm Trip',
    description: 'Everything is set — click Confirm to run the fuel optimizer!',
    placement: 'top',
    action: 'click',
    autoAdvance: true,
  },
  // Step 26: Optimizer strategy
  {
    id: 'explain-strategy',
    page: '',
    target: 'optimizer-strategy',
    title: 'Optimization Strategy',
    description: 'This shows the high-level approach the optimizer used — whether it\'s tankering fuel, buying at cheaper stops, or a balanced mix.',
    placement: 'bottom',
  },
  // Step 27: Walk through leg 1 summary
  {
    id: 'explain-summary-leg1',
    page: '',
    target: 'summary-leg-1',
    title: 'Leg 1 Breakdown',
    description: 'Here\'s the optimized fuel plan for Leg 1 — how much to load, expected cost, and savings vs. buying at each stop.',
    placement: 'bottom',
  },
  // Step 28: Click Full Summary
  {
    id: 'click-full-summary',
    page: '',
    target: 'full-summary-btn',
    title: 'Full Summary',
    description: 'Click to see the Quick Reference view — a condensed summary you can use in the cockpit.',
    placement: 'bottom',
    action: 'click',
  },
  // Step 29: Click Send Email
  {
    id: 'click-send-email',
    page: '',
    target: 'send-email-btn',
    title: 'Send Email',
    description: 'Share your fuel plan with your team. Click "Send Email" to email the optimized plan.',
    placement: 'bottom',
    action: 'click',
    autoAdvance: true,
  },
  // Step 30: Enter email
  {
    id: 'enter-email',
    page: '',
    target: 'email-input',
    title: 'Enter Your Email',
    description: 'Type your email address and click Send. You\'ll receive your fuel plan summary right in your inbox.',
    placement: 'bottom',
  },
  // Step 31: Email sent
  {
    id: 'email-sent',
    page: '',
    title: 'Email Sent! ✉️',
    description: 'Your fuel plan has been emailed. You now have access to your optimized plan anytime.',
    placement: 'bottom',
  },
  // Step 32: Sidebar tip
  {
    id: 'sidebar-tip',
    page: '',
    title: 'Find Your Trips',
    description: 'You can always find past trips in the sidebar under "Recent Trips" or use the search bar at the top to find any trip by tail number or itinerary.',
    placement: 'bottom',
  },
  // Step 33: Final
  {
    id: 'demo-complete',
    page: '/dashboard',
    title: 'You\'re Ready! 🚀',
    description: 'There are more features to discover, but you\'re now ready to start planning smarter with SkyIQ. Access this demo anytime by clicking DEMO in the sidebar. For questions, email info@skyiq.net.',
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

const defaultContext: DemoContextType = {
  active: false,
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
