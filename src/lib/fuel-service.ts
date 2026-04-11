// Service layer for calling the fuel optimization Edge Function
// and converting between form data and API types.

import type {
  TripFormData,
  TripInput,
  LegInput,
  OptimizationResult,
  TripSummary,
  TripSummaryLeg,
  Fee,
} from "../types/trip";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Convert form data into the TripInput format expected by the optimizer.
 */
export function formToTripInput(form: TripFormData): TripInput {
  const legs: LegInput[] = form.legs
    .filter((leg) => leg.isConfirmed && leg.legNum > 0)
    .sort((a, b) => a.legNum - b.legNum)
    .map((leg) => {
      const passengers = leg.passengerWeights
        .split(",")
        .map((w) => parseFloat(w.trim()))
        .filter((w) => !isNaN(w));

      const crewWeight = leg.crewWeight
        .split(",")
        .map((w) => parseFloat(w.trim()))
        .filter((w) => !isNaN(w));

      const fees: Fee[] = [];
      if (leg.waivedFee.isWaivable && leg.waivedFee.amount > 0 && leg.waivedFee.waivedAt > 0) {
        fees.push({
          name: leg.waivedFee.name || "Waived",
          amount: leg.waivedFee.amount,
          is_waivable: true,
          waived_at: leg.waivedFee.waivedAt,
          airport: leg.waivedFee.airport || leg.departure,
        });
      }

      return {
        leg_num: leg.legNum.toString(),
        departure: leg.departure,
        destination: leg.destination,
        departure_fuel_price: leg.departureFuelPrices,
        fees,
        reserve: leg.reserve,
        fuel_burn: leg.fuelBurn,
        passengers,
        baggage: leg.baggage,
        crew_weight: crewWeight.length > 0 ? crewWeight : [180],
        max_takeoff_weight: leg.maxTakeoffWeight,
        max_landing_weight: leg.maxLandingWeight,
        max_ramp_weight: leg.maxRampWeight,
        taxi_fuel_burn: leg.taxiFuelBurn,
      };
    });

  return {
    itinerary_num: form.itineraryNum,
    starting_fuel: form.startingFuel,
    aircraft: form.aircraftId,
    legs,
    basic_empty_weight: form.basicEmptyWeight,
    max_fuel_reserve: form.maxFuelReserve,
    penalty: form.penalty,
    lbs_per_hour: form.lbsPerHour,
  };
}

/**
 * Call the optimize-fuel Edge Function.
 */
export async function runFuelOptimization(tripInput: TripInput): Promise<OptimizationResult> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/optimize-fuel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(tripInput),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Optimization failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Convert optimization results into a TripSummary for storage and display.
 */
export function resultToSummary(
  result: OptimizationResult,
  tripInput: TripInput,
  existingId?: number,
): TripSummary {
  const legs: TripSummaryLeg[] = result.data.map((leg) => {
    let fuelCost = leg.total_cost;
    let hasWaivedFee = false;
    let feeMin = 0;

    if (leg.fees.length > 0) {
      const fee = leg.fees.find((f) => f.is_waivable && f.amount > 0 && f.waived_at > 0);
      if (fee) {
        hasWaivedFee = true;
        feeMin = fee.waived_at;
        fuelCost = leg.total_fuel_purchased_gallons < fee.waived_at
          ? leg.total_cost - fee.amount
          : leg.total_cost;
      }
    }

    return {
      arrival: leg.arrival,
      departure: leg.departure,
      takeoffWeight: leg.takeoff_fuel_lbs + leg.fixed_weights,
      landingWeight: leg.landing_fuel_lbs + leg.fixed_weights,
      startFuel: Math.ceil(leg.start_fuel / 10) * 10,
      takeoffFuel: Math.ceil(leg.takeoff_fuel_lbs / 10) * 10,
      landingFuel: Math.ceil(leg.landing_fuel_lbs / 10) * 10,
      fuelBurn: leg.fuel_burn_lbs,
      fuelUpliftLbs: leg.total_fuel_purchased_lbs,
      fuelUpliftGals: leg.total_fuel_purchased_gallons,
      fuelCost,
      hasWaivedFee,
      feeMin,
      totalCost: leg.total_cost,
      errors: leg.errors,
    };
  });

  const totalOptimalCost = legs.reduce((sum, l) => sum + l.totalCost, 0);
  let savings = result.simple_cost - totalOptimalCost;
  if (savings < 0) savings = 0;

  return {
    id: existingId ?? 0,
    itineraryNum: tripInput.itinerary_num,
    legs,
    aircraftNumber: tripInput.aircraft,
    savings,
  };
}
