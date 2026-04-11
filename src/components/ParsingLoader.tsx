// ParsingLoader — Fun aviation facts loading overlay shown during PDF parsing.
import { useState, useEffect } from "react";
import { Loader2, Plane } from "lucide-react";

const FACTS = [
  "The Wright brothers' first flight was shorter than a Boeing 747's wingspan.",
  "A fully loaded 747 carries about 48,000 gallons of fuel — enough to fill 960 bathtubs.",
  "Commercial jets typically fly at 35,000 ft, where air resistance drops ~75%.",
  "Jet fuel costs can swing 30%+ between airports only 100 miles apart.",
  "Tankering extra fuel can save thousands — if the weight penalty doesn't eat the savings.",
  "A 1¢/gal price difference on a large jet trip can mean $200+ in savings.",
  "Fuel makes up 20–30% of an airline's total operating costs.",
  "The world's longest nonstop flight (SIN→JFK) burns ~40,000 gallons one-way.",
  "Aircraft carry extra fuel as reserve, but every pound costs money to carry.",
  "SkyIQ's optimizer tests every gallon combination to find the cheapest fueling plan.",
  "Tiered fuel pricing means buying more can actually lower your cost per gallon.",
  "Fee waivers at FBOs often kick in at a minimum purchase — the optimizer accounts for that.",
  "Dynamic programming finds the mathematically optimal solution, not just a good guess.",
];

export default function ParsingLoader({ title = "Parsing your itinerary…", subtitle = "Our AI is reading your trip sheet" }: { title?: string; subtitle?: string }) {
  const [factIndex, setFactIndex] = useState(
    () => Math.floor(Math.random() * FACTS.length)
  );
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setFactIndex((prev) => (prev + 1) % FACTS.length);
        setFade(true);
      }, 400);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 max-w-md px-6 text-center">
        {/* Animated plane */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="relative bg-primary/10 rounded-full p-6">
            <Plane className="h-10 w-10 text-primary animate-bounce" />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-lg font-semibold text-foreground">
              {title}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite]" />
        </div>

        {/* Fun fact */}
        <div
          className={`min-h-[80px] flex items-center transition-opacity duration-400 ${
            fade ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <p className="text-xs font-medium text-primary mb-1">✈️ Did you know?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {FACTS[factIndex]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
