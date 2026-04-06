import { useState, useEffect } from 'react';
import { Upload, Settings, DollarSign, TrendingUp, Users, X, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

interface WalkthroughStep {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const STEPS: WalkthroughStep[] = [
  {
    title: 'Welcome to SkyIQ',
    description: 'SkyIQ optimizes your fuel planning across every leg of your trip — factoring in fuel prices, fee waivers, weight limits, and volume discounts to find the best financial decision automatically.',
    icon: <img src={skyiqLogo} alt="SkyIQ" className="w-8 h-8 object-contain" />,
  },
  {
    title: 'Plan a Trip',
    description: 'Start by uploading your trip itinerary or entering legs manually. Our AI reads every detail from your trip sheet — tail number, fuel prices, passengers, and more — with zero manual entry.',
    icon: <Upload className="w-8 h-8" />,
  },
  {
    title: 'Manage Your Fleet',
    description: 'Add your aircraft with their specifications — weight limits, fuel capacity, burn rates, and crew defaults. From Gulfstreams to Cessnas, SkyIQ handles any fleet size or type.',
    icon: <Settings className="w-8 h-8" />,
  },
  {
    title: 'Optimized Fuel Plans',
    description: 'Our patent-pending algorithm analyzes every variable across all legs simultaneously — fuel prices, fee waivers, volume discounts, burn penalties, and aircraft weight limitations — to produce your optimized fuel plan.',
    icon: <DollarSign className="w-8 h-8" />,
  },
  {
    title: 'Track Your Savings',
    description: 'See exactly how much SkyIQ saves you on every trip. Typical operators save $12,000–$20,000+ per month in fuel costs and waived fees — well beyond what any pilot can calculate by hand.',
    icon: <TrendingUp className="w-8 h-8" />,
  },
  {
    title: 'Invite Your Team',
    description: 'Add pilots, dispatchers, and admins to your operator account. Everyone on your team can access SkyIQ to plan trips and optimize fuel — visit your Profile to manage your team.',
    icon: <Users className="w-8 h-8" />,
  },
];

const STORAGE_KEY = 'skyiq_walkthrough_completed';

interface WalkthroughProps {
  onComplete?: () => void;
}

export default function Walkthrough({ onComplete }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      setVisible(true);
    }
  }, []);

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }

  function handlePrev() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  function handleComplete() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
    onComplete?.();
  }

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
    onComplete?.();
  }

  if (!visible) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step indicator */}
        <div className="flex gap-1.5 px-8 pt-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStep ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 pt-8 pb-6">
          {/* Icon */}
          <div className="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center text-primary mb-6">
            {step.icon}
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-3">{step.title}</h2>
          <p className="text-muted-foreground leading-relaxed">{step.description}</p>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {currentStep + 1} of {STEPS.length}
          </div>

          <div className="flex items-center gap-3">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            {isFirst && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip tour
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-all"
            >
              {isLast ? (
                <>
                  Get Started
                  <CheckCircle className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
