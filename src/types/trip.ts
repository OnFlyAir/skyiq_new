// Shared types for trip planning, fuel optimization, and itinerary parsing.
// These mirror the Supabase Edge Function interfaces.

// --- Fuel Optimizer Types ---

export interface FuelTier {
  min_fuel: number;
  price: number;
}

export interface Fee {
  name: string;
  amount: number;
  is_waivable: boolean;
  waived_at: number;
  airport: string;
}

export interface LegInput {
  leg_num: string;
  departure: string;
  destination: string;
  departure_fuel_price: FuelTier[];
  fees: Fee[];
  reserve: number;
  fuel_burn: number;
  passengers: number[];
  baggage: number;
  crew_weight: number[];
  max_takeoff_weight: number;
  max_landing_weight: number;
  max_ramp_weight: number;
  taxi_fuel_burn: number;
}

export interface TripInput {
  itinerary_num: string;
  starting_fuel: number;
  aircraft: string;
  legs: LegInput[];
  basic_empty_weight: number;
  max_fuel_reserve: number;
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

// --- Trip Summary (what gets stored in the DB) ---

export interface TripSummaryLeg {
  arrival: string;
  departure: string;
  takeoffWeight: number;
  landingWeight: number;
  startFuel: number;
  takeoffFuel: number;
  landingFuel: number;
  fuelBurn: number;
  fuelUpliftLbs: number;
  fuelUpliftGals: number;
  fuelCost: number;
  hasWaivedFee: boolean;
  hasWaivableFee: boolean;
  feeMin: number;
  feeAmount: number;
  totalCost: number;
  errors: string[];
}

export interface TripSummary {
  id: number;
  itineraryNum: string | null;
  legs: TripSummaryLeg[];
  aircraftNumber: string;
  savings: number;
  maxFuelLbs?: number;
}

// --- Itinerary Parser Types ---

export interface ParsedTrip {
  itinerary_num: string;
  starting_fuel: number;
  aircraft: string;
  legs: ParsedLeg[];
  errors: string[];
}

export interface ParsedLeg {
  leg_num: number;
  departure: string;
  destination: string;
  departure_fuel_price: FuelTier[];
  fees: { name: string; amount: number; is_waivable: boolean; waived_at: number; airport: string }[];
  reserve: number;
  fuel_burn: number;
  passengers: number[];
  baggage: number;
  crew_weight: number[];
  max_takeoff_weight: number;
  max_landing_weight: number;
  max_ramp_weight: number;
  taxi_fuel_burn: number;
}

// --- Form-level DTO (what the UI works with) ---

export interface LegFormData {
  legNum: number;
  departure: string;
  destination: string;
  departureFuelPrices: FuelTier[];
  waivedFee: {
    name: string;
    amount: number;
    isWaivable: boolean;
    waivedAt: number;
    airport: string;
  };
  passengerWeights: string;  // comma-separated
  baggage: number;
  crewWeight: string;        // comma-separated
  fuelBurn: number;
  reserve: number;
  taxiFuelBurn: number;
  maxTakeoffWeight: number;
  maxLandingWeight: number;
  maxRampWeight: number;
  isConfirmed: boolean;
}

export interface TripFormData {
  itineraryNum: string;
  startingFuel: number;
  aircraftId: string;
  basicEmptyWeight: number;
  maxFuelReserve: number;
  penalty: number;
  lbsPerHour: number;
  legs: LegFormData[];
}
