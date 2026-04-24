// PricingTour — guided 3-step walkthrough that explains the $1 trial,
// the per-aircraft tiered pricing (and how it gets cheaper as fleets grow),
// and the optional Done-For-You service. Shown above the calculator on the
// OnboardingPage when the user just signed up (?tour=1) or hasn't seen it.

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  TrendingDown,
  Wrench,
  ChevronRight,
  ChevronLeft,
  Check,
  Plane,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface Props {
  onFinish: () => void;
}

const TIERS = [
  { range: '1–4 aircraft', perPlane: 200, badge: 'Starter' },
  { range: '5–9 aircraft', perPlane: 150, badge: 'Growing fleet', save: '25% cheaper' },
  { range: '10+ aircraft', perPlane: 100, badge: 'Enterprise', save: '50% cheaper' },
];

export default function PricingTour({ onFinish }: Props) {
  const [step, setStep] = useState(0);
  const totalSteps = 3;

  const next = () => (step < totalSteps - 1 ? setStep(step + 1) : onFinish());
  const prev = () => step > 0 && setStep(step - 1);

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-background overflow-hidden">
      <CardContent className="p-6 space-y-5">
        {/* Header w/ progress */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-8 bg-primary' : i < step ? 'w-4 bg-primary/60' : 'w-4 bg-muted'
                }`}
              />
            ))}
            <span className="ml-2 text-xs text-muted-foreground">
              Step {step + 1} of {totalSteps}
            </span>
          </div>
          <button
            onClick={onFinish}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            aria-label="Skip tour"
          >
            Skip <X className="h-3 w-3" />
          </button>
        </div>

        {/* Step content */}
        {step === 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Try SkyIQ for $1</h3>
                <p className="text-xs text-muted-foreground">30 days · cancel anytime</p>
              </div>
            </div>
            <p className="text-sm text-foreground/90">
              We charge <strong>$1 today</strong> just to verify your card. You then get
              <strong> 30 full days free</strong> to explore SkyIQ. No surprise bill — your
              subscription only starts after the trial ends, and you can cancel any time before.
            </p>
            <ul className="space-y-1.5 text-sm">
              {[
                '$1 charged today (refundable)',
                '30 days of full access — every feature unlocked',
                'Cancel before day 30 and pay nothing more',
              ].map((it) => (
                <li key={it} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-foreground">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">It gets cheaper as you grow</h3>
                <p className="text-xs text-muted-foreground">
                  Tiered per-aircraft pricing, billed every 4 weeks
                </p>
              </div>
            </div>
            <p className="text-sm text-foreground/90">
              You only pay for active aircraft. The more planes in your fleet, the lower the
              per-plane rate — automatic, no negotiation needed.
            </p>
            <div className="space-y-2">
              {TIERS.map((tier) => (
                <div
                  key={tier.range}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border"
                >
                  <div className="flex items-center gap-3">
                    <Plane className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{tier.range}</p>
                      <p className="text-xs text-muted-foreground">{tier.badge}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(tier.perPlane)}/plane
                    </p>
                    {tier.save && (
                      <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">
                        {tier.save}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Save another <strong>20%</strong> by choosing annual billing.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Want us to do it for you?</h3>
                <p className="text-xs text-muted-foreground">Done-For-You · $25 per plan · billed monthly</p>
              </div>
            </div>
            <p className="text-sm text-foreground/90">
              Don't have time to build fuel plans? Upload your trip sheet and our team delivers a
              fully optimized plan to your inbox. <strong>Nothing to pay up front</strong> —
              we add <strong>$25 per plan</strong> to your end-of-month invoice, only for the plans you actually request.
            </p>
            <ul className="space-y-1.5 text-sm">
              {[
                'Upload any trip itinerary (PDF or doc)',
                'Our team builds the optimized fuel plan',
                'Delivered ready-to-file, usually within hours',
                'No upfront charge — billed at the end of the month',
              ].map((it) => (
                <li key={it} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-foreground">{it}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              You can request DFY plans anytime from the DFY tab inside the app — your monthly invoice will include only the plans you used.
            </p>
          </div>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button onClick={next} size="sm" className="gap-1">
            {step === totalSteps - 1 ? 'See pricing & start trial' : 'Next'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
