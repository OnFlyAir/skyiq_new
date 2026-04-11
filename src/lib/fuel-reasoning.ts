// Generates human-readable explanations for why the optimizer chose
// each leg's fueling strategy, based on the summary data.

import type { TripSummaryLeg } from "@/types/trip";

interface LegReasoning {
  headline: string;
  details: string[];
}

export function generateLegReasoning(
  legs: TripSummaryLeg[],
  savings: number,
): LegReasoning[] {
  return legs.map((leg, i) => {
    const details: string[] = [];
    const nextLeg = legs[i + 1];
    const isFirst = i === 0;
    const isLast = i === legs.length - 1;

    // No fuel purchased
    if (leg.fuelUpliftGals <= 0) {
      details.push(
        "No fuel was purchased here — the aircraft had enough on board from the previous stop."
      );
      if (nextLeg && nextLeg.fuelCost < leg.fuelCost) {
        details.push(
          `Fuel is cheaper at ${nextLeg.departure}, so it's better to buy there.`
        );
      }
      return {
        headline: `Skip fueling at ${leg.departure}`,
        details,
      };
    }

    // Headline based on amount
    const isMinimalUplift = leg.fuelUpliftGals < 50;
    const isHeavyUplift = leg.fuelUpliftGals > 200;

    let headline: string;
    if (isMinimalUplift) {
      headline = `Light top-off at ${leg.departure}`;
    } else if (isHeavyUplift) {
      headline = `Tank up at ${leg.departure}`;
    } else {
      headline = `Moderate fueling at ${leg.departure}`;
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
      // Last leg — explain it's the final stop
      details.push(
        `This is the final leg — only enough fuel to arrive safely with reserves was purchased.`
      );
    }

    // Fee waiver reasoning
    if (leg.hasWaivedFee) {
      details.push(
        `Buying at least ${Math.round(leg.feeMin)} gallons waives the facility fee at this airport, which the optimizer took advantage of.`
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

    return { headline, details };
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
