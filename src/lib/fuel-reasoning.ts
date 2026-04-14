// Generates human-readable explanations for why the optimizer chose
// each leg's fueling strategy, based on the summary data.

import type { TripSummaryLeg } from "@/types/trip";

export interface LegStrategy {
  label: string;        // Short action: "Skip fuel", "Top off", "Waive fee", etc.
  description: string;  // One-line explanation
}

export interface LegReasoning {
  strategy: LegStrategy;
  details: string[];
}

/**
 * Determine the per-leg strategy label.
 * "Top off" = filling to the aircraft's max fuel capacity.
 * We approximate this by checking if uplift brings startFuel close to maxFuel.
 */
function determineLegStrategy(
  leg: TripSummaryLeg,
  nextLeg: TripSummaryLeg | undefined,
  maxFuelLbs: number,
): LegStrategy {
  // No fuel purchased
  if (leg.fuelUpliftGals <= 0) {
    return { label: "Skip fuel", description: `No fuel needed at ${leg.departure}` };
  }

  // Check if they're topping off (filling to max capacity)
  const fuelAfterUplift = leg.startFuel + leg.fuelUpliftLbs;
  if (maxFuelLbs > 0 && fuelAfterUplift >= maxFuelLbs * 0.95) {
    return { label: "Top off", description: `Fill to max capacity at ${leg.departure}` };
  }

  // Check if buying minimum to waive a fee
  if (leg.hasWaivedFee && leg.fuelUpliftGals >= leg.feeMin && leg.fuelUpliftGals < leg.feeMin * 1.15) {
    return {
      label: "Waive fee",
      description: `Buy ${Math.round(leg.feeMin)} gal minimum to waive fee at ${leg.departure}`,
    };
  }

  // Otherwise it's a targeted uplift to a specific fuel level
  const targetFuel = Math.round((leg.startFuel + leg.fuelUpliftLbs) / 10) * 10;
  return {
    label: `Fuel to ${targetFuel.toLocaleString()} lbs`,
    description: `Bring fuel up to ${targetFuel.toLocaleString()} lbs at ${leg.departure}`,
  };
}

export function generateLegReasoning(
  legs: TripSummaryLeg[],
  savings: number,
  maxFuelLbs: number = 0,
): LegReasoning[] {
  return legs.map((leg, i) => {
    const details: string[] = [];
    const nextLeg = legs[i + 1];
    const isFirst = i === 0;
    const isLast = i === legs.length - 1;

    const strategy = determineLegStrategy(leg, nextLeg, maxFuelLbs);

    // No fuel purchased
    if (leg.fuelUpliftGals <= 0) {
      details.push(
        "The aircraft had enough on board from the previous stop."
      );
      if (nextLeg && nextLeg.fuelCost < leg.fuelCost) {
        details.push(
          `Fuel is cheaper at ${nextLeg.departure}, so it's better to buy there.`
        );
      }
      return { strategy, details };
    }

    // Price reasoning
    const pricePerGal = leg.fuelUpliftGals > 0
      ? leg.fuelCost / leg.fuelUpliftGals
      : 0;

    if (nextLeg) {
      const nextPricePerGal = nextLeg.fuelUpliftGals > 0
        ? nextLeg.fuelCost / nextLeg.fuelUpliftGals
        : 0;

      if (pricePerGal > 0 && nextPricePerGal > 0) {
        if (pricePerGal < nextPricePerGal * 0.95) {
          details.push(
            `Fuel here is ~$${pricePerGal.toFixed(2)}/gal — cheaper than ${nextLeg.departure} (~$${nextPricePerGal.toFixed(2)}/gal), so loading up saves money.`
          );
        } else if (pricePerGal > nextPricePerGal * 1.05) {
          details.push(
            `Fuel is more expensive here (~$${pricePerGal.toFixed(2)}/gal vs ~$${nextPricePerGal.toFixed(2)}/gal at ${nextLeg.departure}), so only enough to reach the next stop safely was purchased.`
          );
        } else {
          details.push(
            `Prices are similar here and at ${nextLeg.departure}, so the optimizer balanced fueling to minimize total weight penalty.`
          );
        }
      }
    } else {
      details.push(
        `This is the final leg — only enough fuel to arrive safely with reserves was purchased.`
      );
    }

    // Fee waiver reasoning
    if (leg.hasWaivedFee) {
      details.push(
        `Buying at least ${Math.round(leg.feeMin)} gallons waives the facility fee at this airport.`
      );
    }

    // Weight constraint reasoning
    if (leg.takeoffWeight > 0 && leg.landingWeight > 0) {
      const weightMargin = leg.takeoffWeight / leg.landingWeight;
      if (weightMargin > 1.15) {
        details.push(
          `The aircraft is taking off heavy here (${Math.round(leg.takeoffWeight).toLocaleString()} lbs) to carry cheaper fuel forward.`
        );
      }
    }

    // First leg context
    if (isFirst) {
      details.push(
        `Starting with ${Math.round(leg.startFuel).toLocaleString()} lbs of fuel already on board.`
      );
    }

    // Landing fuel context
    if (!isLast && leg.landingFuel > leg.fuelBurn * 0.8) {
      details.push(
        `Landing with ${Math.round(leg.landingFuel).toLocaleString()} lbs — extra fuel carried forward for savings at the next stop.`
      );
    }

    return { strategy, details };
  });
}

export function generateOverallReasoning(
  legs: TripSummaryLeg[],
  savings: number,
): string {
  if (savings <= 0) {
    return "The optimizer found that fueling at each departure point (the simple approach) is already the cheapest option for this trip.";
  }

  // Identify the cheapest and most expensive stops
  const legsWithPrice = legs
    .filter((l) => l.fuelUpliftGals > 0)
    .map((l) => ({
      airport: l.departure,
      pricePerGal: l.fuelCost / l.fuelUpliftGals,
      gallons: l.fuelUpliftGals,
    }));

  if (legsWithPrice.length === 0) {
    return "The aircraft had sufficient fuel for the entire trip.";
  }

  const cheapest = legsWithPrice.reduce((a, b) =>
    a.pricePerGal < b.pricePerGal ? a : b
  );
  const mostExpensive = legsWithPrice.reduce((a, b) =>
    a.pricePerGal > b.pricePerGal ? a : b
  );

  if (legsWithPrice.length === 1) {
    return `By optimizing the fuel load, the plan saves $${savings.toFixed(0)} compared to the standard approach.`;
  }

  const priceDiff = mostExpensive.pricePerGal - cheapest.pricePerGal;
  if (priceDiff > 0.5) {
    return `The optimizer shifts fuel purchases toward ${cheapest.airport} (~$${cheapest.pricePerGal.toFixed(2)}/gal) and away from ${mostExpensive.airport} (~$${mostExpensive.pricePerGal.toFixed(2)}/gal), saving $${savings.toFixed(0)} by tankering cheaper fuel forward.`;
  }

  return `By carefully balancing fuel loads, weight penalties, and fee waivers across ${legsWithPrice.length} stops, the optimizer saves $${savings.toFixed(0)} compared to buying the minimum at each stop.`;
}
