// Service layer for converting parsed itinerary results into form-ready leg data.

import type { ParsedTrip, LegFormData } from "../types/trip";

/**
 * Convert a parsed trip into form-ready leg data, applying aircraft defaults.
 */
export function parsedLegsToFormData(
  parsedTrip: ParsedTrip,
  aircraftDefaults: {
    defaultPaxWeight: number;
    defaultBaggageWithPax: number;
    defaultBaggageNoPax: number;
    defaultPicWeight: number;
    defaultSicWeight: number;
    defaultCabinWeight: number;
    preferredReserve: number;
    taxiFuelBurn: number;
    maxTakeoffWeight: number;
    maxLandingWeight: number;
    maxRampWeight: number;
    maxFuelCapacity: number;
  },
): LegFormData[] {
  return parsedTrip.legs.map((leg) => {
    // Replace -1 (unknown) passenger weights with aircraft default
    const paxWeights = leg.passengers
      .map((w) => (w === -1 ? aircraftDefaults.defaultPaxWeight : w));

    const hasPax = paxWeights.length > 0 && paxWeights.some((w) => w > 0);

    // Find waived fee at departure airport
    const waivedFee = leg.fees.find(
      (f) => f.is_waivable && f.amount > 0 && f.waived_at > 0,
    );

    return {
      legNum: leg.leg_num,
      departure: leg.departure?.toUpperCase() ?? "",
      destination: leg.destination?.toUpperCase() ?? "",
      departureFuelPrices: leg.departure_fuel_price.length > 0
        ? leg.departure_fuel_price
        : [{ min_fuel: 0, price: 0 }],
      waivedFee: {
        name: waivedFee?.name ?? "",
        amount: waivedFee?.amount ?? 0,
        isWaivable: waivedFee?.is_waivable ?? false,
        waivedAt: waivedFee?.waived_at ?? 0,
        airport: waivedFee?.airport ?? leg.departure,
      },
      passengerWeights: paxWeights.length > 0 ? paxWeights.join(", ") : "0",
      baggage: hasPax
        ? aircraftDefaults.defaultBaggageWithPax
        : aircraftDefaults.defaultBaggageNoPax,
      crewWeight: `${aircraftDefaults.defaultPicWeight}, ${aircraftDefaults.defaultSicWeight}, ${aircraftDefaults.defaultCabinWeight}`,
      fuelBurn: leg.fuel_burn,
      reserve: aircraftDefaults.preferredReserve,
      taxiFuelBurn: aircraftDefaults.taxiFuelBurn,
      maxTakeoffWeight: aircraftDefaults.maxTakeoffWeight,
      maxLandingWeight: aircraftDefaults.maxLandingWeight,
      maxRampWeight: aircraftDefaults.maxRampWeight,
      isConfirmed: false,
    };
  });
}
