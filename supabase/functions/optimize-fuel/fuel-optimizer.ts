// SkyIQ Fuel Optimizer — TypeScript port of flighttestr28.py
// Dynamic Programming approach to minimize fueling cost across multi-leg trips

const GALS_TO_LBS = 6.7;
const LBS_TO_GALS = 1 / GALS_TO_LBS;

// --- Types ---

export interface FuelTier {
  min_fuel: number; // minimum gallons to qualify for this price
  price: number;    // price per gallon
}

export interface Fee {
  name: string;
  amount: number;
  is_waivable: boolean;
  waived_at: number; // gallons needed to waive the fee
  airport: string;
}

export interface LegInput {
  leg_num: string;
  departure: string;
  destination: string;
  departure_fuel_price: FuelTier[];
  fees: Fee[];
  reserve: number;          // minimum landing fuel in lbs
  fuel_burn: number;        // fuel burn for this leg in lbs
  passengers: number[];     // list of passenger weights
  baggage: number;
  crew_weight: number[];
  max_takeoff_weight: number;
  max_landing_weight: number;
  max_ramp_weight: number;
  taxi_fuel_burn: number;
}

export interface TripInput {
  itinerary_num: string;
  starting_fuel: number;    // current fuel on board in lbs
  aircraft: string;
  legs: LegInput[];
  basic_empty_weight: number;
  max_fuel_reserve: number; // max fuel capacity in lbs
  penalty: number;
  lbs_per_hour: number;
}

export interface LegResult {
  name: string;
  arrival: string;
  departure: string;
  fees: { amount: number; is_waivable: boolean; waived_at: number }[];
  fuel_burn_lbs: number;
  start_fuel: number;
  takeoff_fuel_lbs: number;
  landing_fuel_lbs: number;
  total_fuel_purchased_gallons: number;
  total_fuel_purchased_lbs: number;
  total_cost: number;
  avg_cost_per_gallon: number;
  fixed_weights: number;
  errors: string[];
}

export interface OptimizationResult {
  simple_cost: number;
  data: LegResult[];
}

// --- Conversion helpers ---

function lbsToGallons(lbs: number): number {
  return lbs * LBS_TO_GALS;
}

function gallonsToLbs(gallons: number): number {
  return gallons * GALS_TO_LBS;
}

// --- Stop class (mirrors Python Stop) ---

class Stop {
  name: string;
  tiers: [number, number][]; // [min_quantity_gallons, price_per_gallon]
  fuel_burn: number;         // lbs
  fees: Fee[];
  tank_capacity_gallons_takeoff: number;
  tank_capacity_gallons_landing: number;
  arrival: string;
  departure: string;
  fixed_weights: number;
  min_fuel_reserve: number;  // lbs
  max_ramp_weight: number;   // gallons
  taxi_fuel_burn: number;    // gallons
  penalty: number;
  gals_per_hour: number;
  errors: string[];

  // Results (filled after optimization)
  total_fuel_purchased = 0;
  total_cost = 0;
  avg_cost_per_gallon = 0;
  start_fuel = 0;
  takeoff_fuel = 0;
  landing_fuel = 0;

  constructor(
    name: string,
    tiers: [number, number][],
    fuel_burn: number,
    fees: Fee[],
    tank_capacity_gallons_takeoff: number,
    tank_capacity_gallons_landing: number,
    arrival: string,
    departure: string,
    fixed_weights: number,
    min_fuel_reserve: number,
    max_ramp_weight: number,
    taxi_fuel_burn: number,
    penalty: number,
    gals_per_hour: number,
  ) {
    this.name = name;
    this.tiers = tiers;
    this.fuel_burn = fuel_burn;
    this.fees = fees;
    this.tank_capacity_gallons_takeoff = tank_capacity_gallons_takeoff;
    this.tank_capacity_gallons_landing = tank_capacity_gallons_landing;
    this.arrival = arrival;
    this.departure = departure;
    this.fixed_weights = fixed_weights;
    this.min_fuel_reserve = min_fuel_reserve;
    this.max_ramp_weight = max_ramp_weight;
    this.taxi_fuel_burn = taxi_fuel_burn;
    this.penalty = penalty;
    this.gals_per_hour = gals_per_hour;
    this.errors = [];
  }

  /**
   * Calculate the total cost to purchase `buy` gallons at this stop.
   * Tiered pricing: highest tier whose min_quantity <= buy applies to ALL gallons.
   * Includes fee waivers and fuel penalty for carrying excess fuel.
   */
  costOfPurchase(
    buy: number,
    burn: number,
    landing: number,
    minFuelReserveGallons: number,
  ): number {
    let feeTotal = 0.0;
    if (this.fees.length > 0) {
      const fee = this.fees[0]; // should be only one fuel fee
      if (buy < Math.floor(Number(fee.waived_at))) {
        feeTotal = fee.amount;
      }
    }

    if (buy <= 0) {
      return feeTotal;
    }

    // Find applicable price tier (highest tier where buy >= min_quantity)
    let applicablePrice: number | null = null;
    for (const [minQ, price] of this.tiers) {
      if (buy >= minQ) {
        applicablePrice = price;
      } else {
        break; // tiers sorted ascending by min_quantity
      }
    }
    if (applicablePrice === null) {
      applicablePrice = this.tiers[0][1];
    }

    // Fuel penalty: penalize carrying fuel above reserve
    let fuelPenalty = 0;
    const extraFuel = landing - minFuelReserveGallons;
    if (extraFuel > 0) {
      const hours = burn / (this.gals_per_hour > 0 ? this.gals_per_hour : 1);
      fuelPenalty = extraFuel * hours * this.penalty;
    }

    return (buy * applicablePrice) + feeTotal + (fuelPenalty * applicablePrice);
  }
}

// --- Create stops from trip input ---

function createStops(trip: TripInput): Stop[] {
  const stops: Stop[] = [];

  for (let i = 0; i < trip.legs.length; i++) {
    const leg = trip.legs[i];

    // Sort fuel tiers ascending by min_fuel
    const fuelTiers: [number, number][] = leg.departure_fuel_price
      .map((fp) => [fp.min_fuel, fp.price] as [number, number])
      .sort((a, b) => a[0] - b[0]);

    // Calculate fixed weights for this leg
    const crewTotal = leg.crew_weight.reduce((sum, w) => sum + w, 0);
    const paxTotal = leg.passengers.reduce((sum, w) => sum + w, 0);
    const fixedWeights = trip.basic_empty_weight + leg.baggage + crewTotal + paxTotal;

    // Calculate per-leg tank capacities (weight-limited, capped by max fuel capacity)
    let legTankCapLbs = leg.max_takeoff_weight - fixedWeights;
    let legTankLandLbs = leg.max_landing_weight - fixedWeights;
    legTankCapLbs = legTankCapLbs < trip.max_fuel_reserve ? legTankCapLbs : trip.max_fuel_reserve;
    legTankLandLbs = legTankLandLbs < trip.max_fuel_reserve ? legTankLandLbs : trip.max_fuel_reserve;

    let legMaxRamp = leg.max_ramp_weight - fixedWeights;
    legMaxRamp = legMaxRamp < trip.max_fuel_reserve ? legMaxRamp : trip.max_fuel_reserve;

    stops.push(
      new Stop(
        `Stop ${i + 1}`,
        fuelTiers,
        leg.fuel_burn,
        leg.fees,
        Math.floor(lbsToGallons(legTankCapLbs)),
        Math.floor(lbsToGallons(legTankLandLbs)),
        leg.destination,
        leg.departure,
        fixedWeights,
        leg.reserve,
        Math.floor(lbsToGallons(legMaxRamp)),
        Math.ceil(lbsToGallons(leg.taxi_fuel_burn)),
        trip.penalty,
        Math.round(lbsToGallons(trip.lbs_per_hour) * 100) / 100,
      ),
    );
  }

  return stops;
}

// --- Simple (baseline) cost calculation ---

function getSimpleCost(stops: Stop[], startFuel: number): number {
  const fuelBurns = stops.map((s) => Math.ceil(lbsToGallons(s.fuel_burn)));
  let totalCost = 0;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const minFuelReserveGallons = Math.ceil(lbsToGallons(stop.min_fuel_reserve));
    let burn = fuelBurns[i];

    if (i === 0) {
      burn = stop.min_fuel_reserve > startFuel
        ? burn + stop.min_fuel_reserve - startFuel
        : burn;
    }

    totalCost += stop.costOfPurchase(
      burn + stop.taxi_fuel_burn,
      burn,
      stop.min_fuel_reserve,
      minFuelReserveGallons,
    );
  }

  return totalCost;
}

// --- Dynamic Programming fuel optimizer ---

function findOptimalStrategy(stops: Stop[], startFuel: number): number {
  const n = stops.length;
  const fuelBurns = stops.map((s) => Math.ceil(lbsToGallons(s.fuel_burn)));

  // DP[i][f] = minimal cost to arrive at stop i with f gallons
  // Using Maps for sparse representation
  const DP: Map<number, number>[] = Array.from({ length: n + 1 }, () => new Map());
  const parent: Map<number, [number, number]>[] = Array.from({ length: n + 1 }, () => new Map());

  // Start at stop 0 with starting fuel
  DP[0].set(startFuel, 0.0);
  parent[0].set(startFuel, [-1, 0]);

  let hasCriticalErrors = false;

  for (let i = 0; i < n; i++) {
    const stop = stops[i];
    const burn = fuelBurns[i];
    const minFuelReserveGallons = Math.ceil(lbsToGallons(stop.min_fuel_reserve));

    // Validate stop constraints
    if (stop.tank_capacity_gallons_landing < 0) {
      stop.errors.push(`ERROR: Tank landing capacity is under 0: ${stop.tank_capacity_gallons_landing}`);
    }
    if (stop.tank_capacity_gallons_takeoff < 0) {
      stop.errors.push(`ERROR: Tank takeoff capacity is under 0: ${stop.tank_capacity_gallons_takeoff}`);
    }
    if (stop.max_ramp_weight < 0) {
      stop.errors.push("ERROR: Too heavy for ramp");
    }
    if (stop.max_ramp_weight < stop.tank_capacity_gallons_takeoff) {
      stop.errors.push("ERROR: Max ramp weight is less than calculated fuel capacity");
    }

    if (stop.errors.length > 0) {
      hasCriticalErrors = true;
      continue;
    }

    for (const [fCurrent, costSoFar] of DP[i].entries()) {
      let maxBuy = stop.max_ramp_weight - fCurrent;
      if (maxBuy <= 0) continue; // too heavy for ramp

      if (stop.tank_capacity_gallons_takeoff + stop.taxi_fuel_burn < maxBuy) {
        maxBuy = stop.tank_capacity_gallons_takeoff + stop.taxi_fuel_burn;
      }

      for (let buy = 0; buy <= maxBuy; buy++) {
        // After fueling and taxi
        let newFuel = fCurrent + buy - stop.taxi_fuel_burn;
        if (newFuel > stop.tank_capacity_gallons_takeoff) continue;

        // After flying to next stop
        newFuel = newFuel - burn;
        if (newFuel < minFuelReserveGallons) continue;
        if (newFuel < 0) continue;
        if (newFuel > stop.tank_capacity_gallons_landing) continue;

        const purchaseCost = stop.costOfPurchase(buy, burn, newFuel, minFuelReserveGallons);
        const newCost = costSoFar + purchaseCost;

        if (!DP[i + 1].has(newFuel) || DP[i + 1].get(newFuel)! > newCost) {
          DP[i + 1].set(newFuel, newCost);
          parent[i + 1].set(newFuel, [fCurrent, buy]);
        }
      }
    }
  }

  // Find minimum cost at the final stop
  if (hasCriticalErrors) return 0;

  let bestCost = Infinity;
  let bestFuel: number | null = null;

  for (const [f, costVal] of DP[n].entries()) {
    if (f >= 0 && costVal < bestCost) {
      bestCost = costVal;
      bestFuel = f;
    }
  }

  // Reconstruct purchases at each stop
  const reconstruction = new Array(n).fill(0);
  let curI = n;
  let curF = bestFuel;

  while (curI > 0) {
    if (curF === null) {
      stops[curI - 1].errors.push("ERROR: No fuel options found and calculations quit");
      break;
    }
    const [prevF, bought] = parent[curI].get(curF)!;
    reconstruction[curI - 1] = bought;
    curF = prevF;
    curI--;
  }

  // Apply results to stops
  let currentFuel = startFuel;
  let totalCost = 0.0;
  const minFuelReserveGallons = Math.ceil(lbsToGallons(stops[0]?.min_fuel_reserve ?? 0));

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const burnGallons = fuelBurns[i];
    const buy = reconstruction[i];
    const legMinReserveGallons = Math.ceil(lbsToGallons(stop.min_fuel_reserve));

    // Fuel after purchase
    const fuelAfterPurchase = currentFuel + buy;
    stop.start_fuel = gallonsToLbs(fuelAfterPurchase);
    stop.takeoff_fuel = gallonsToLbs(fuelAfterPurchase) - gallonsToLbs(stop.taxi_fuel_burn);

    if (stop.takeoff_fuel < stop.min_fuel_reserve && i !== n - 1) {
      stop.errors.push(
        `ERROR: Takeoff fuel of ${Math.floor(gallonsToLbs(currentFuel))} is below the reserve set at ${stop.min_fuel_reserve}`,
      );
    }

    // Burn fuel going to next stop
    currentFuel = fuelAfterPurchase - stop.taxi_fuel_burn - burnGallons;
    stop.landing_fuel = gallonsToLbs(currentFuel);

    const cost = stop.costOfPurchase(buy, burnGallons, currentFuel, legMinReserveGallons);

    stop.total_fuel_purchased = buy;
    stop.total_cost = cost;
    stop.avg_cost_per_gallon = buy > 0 ? cost / buy : 0.0;
    totalCost += cost;

    if (currentFuel < legMinReserveGallons && i !== n - 1) {
      stop.errors.push(
        `ERROR: Landing fuel of ${gallonsToLbs(currentFuel)} is below the reserve set at ${stop.min_fuel_reserve}`,
      );
    }
  }

  return bestCost;
}

// --- Convert stops to output format ---

function stopsToResults(stops: Stop[]): LegResult[] {
  return stops.map((stop) => ({
    name: stop.name,
    arrival: stop.arrival,
    departure: stop.departure,
    fees: stop.fees.map((f) => ({
      amount: f.amount,
      is_waivable: f.is_waivable,
      waived_at: f.waived_at,
    })),
    fuel_burn_lbs: stop.fuel_burn,
    start_fuel: stop.start_fuel,
    takeoff_fuel_lbs: stop.takeoff_fuel,
    landing_fuel_lbs: stop.landing_fuel,
    total_fuel_purchased_gallons: stop.total_fuel_purchased,
    total_fuel_purchased_lbs: gallonsToLbs(stop.total_fuel_purchased),
    total_cost: stop.total_cost,
    avg_cost_per_gallon: stop.avg_cost_per_gallon,
    fixed_weights: stop.fixed_weights,
    errors: stop.errors,
  }));
}

// --- Main entry point ---

export function optimizeFuel(trip: TripInput): OptimizationResult {
  const startFuelGallons = Math.floor(lbsToGallons(trip.starting_fuel));
  const stops = createStops(trip);

  const _optimalCost = findOptimalStrategy(stops, startFuelGallons);
  const simpleCost = getSimpleCost(stops, startFuelGallons);

  return {
    simple_cost: simpleCost,
    data: stopsToResults(stops),
  };
}
