// Generates human-readable explanations for why the optimizer chose
// each leg's fueling strategy, based on the summary data.

import type { TripSummaryLeg } from "@/types/trip";
import { formatCurrency } from "@/lib/format";

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
  // startFuel already includes uplift, so compare directly to max capacity
  if (maxFuelLbs > 0 && leg.startFuel >= maxFuelLbs * 0.95) {
    return { label: "Top off", description: `Fill to max capacity at ${leg.departure}` };
  }

  // Check if buying just enough to waive a fee
  if (leg.hasWaivedFee && leg.fuelUpliftGals >= leg.feeMin && leg.fuelUpliftGals < leg.feeMin * 1.15) {
    return {
      label: "Take enough to waive the fee",
      description: `Buy ${Math.round(leg.feeMin)} gal minimum to waive fee at ${leg.departure}`,
    };
  }

  // Targeted uplift to a specific fuel level
  // startFuel already includes uplift
  const targetFuel = Math.round(leg.startFuel / 10) * 10;
  return {
    label: `Fuel up to ${targetFuel.toLocaleString()} lbs`,
    description: `Add fuel to reach ${targetFuel.toLocaleString()} lbs at ${leg.departure}`,
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

    // Fee reasoning — always explain fee status regardless of fuel purchase
    if (leg.hasWaivableFee && leg.feeAmount > 0) {
      if (leg.hasWaivedFee) {
        details.push(
          `Buying at least ${Math.round(leg.feeMin)} gallons waives the $${leg.feeAmount.toFixed(2)} facility fee at this airport.`
        );
      } else {
        details.push(
          `A $${leg.feeAmount.toFixed(2)} facility fee applies at ${leg.departure}. Would need ${Math.round(leg.feeMin)} gallons to waive it, but the optimizer determined it's cheaper to pay the fee than buy the extra fuel.`
        );
      }
    } else if (!leg.hasWaivableFee) {
      details.push(
        `No waivable facility fee at ${leg.departure}.`
      );
    }

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
      ? Math.abs(leg.fuelCost / leg.fuelUpliftGals)
      : 0;

    if (nextLeg) {
      const nextPricePerGal = nextLeg.fuelUpliftGals > 0
        ? Math.abs(nextLeg.fuelCost / nextLeg.fuelUpliftGals)
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

    // Fee reasoning already handled above (before early return check)

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
  maxFuelLbs: number = 0,
): string {
  if (legs.length === 0) {
    return "No legs to optimize.";
  }

  // Build a concise per-leg action list
  const actions = legs.map((leg) => {
    if (leg.fuelUpliftGals <= 0) {
      return `${leg.departure}: skip fuel`;
    }
    // Top off
    if (maxFuelLbs > 0 && leg.startFuel >= maxFuelLbs * 0.95) {
      return `${leg.departure}: top off`;
    }
    // Waive fee minimum
    if (leg.hasWaivedFee && leg.fuelUpliftGals >= leg.feeMin && leg.fuelUpliftGals < leg.feeMin * 1.15) {
      return `${leg.departure}: take min (${Math.round(leg.feeMin)} gal) to waive fee`;
    }
    // Targeted uplift
    const targetFuel = Math.round(leg.startFuel / 10) * 10;
    return `${leg.departure}: fuel to ${targetFuel.toLocaleString()} lbs`;
  });

  const plan = actions.join(" → ");
  const savingsNote = savings > 0 ? ` | Saves $${savings.toFixed(0)}` : "";
  return `${plan}${savingsNote}`;
}
