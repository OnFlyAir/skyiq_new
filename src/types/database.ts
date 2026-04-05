export type UserRole = 'super_admin' | 'operator_admin' | 'pilot';

export type AircraftType =
  | 'very_light_jet'
  | 'light_jet'
  | 'midsize_jet'
  | 'super_mid_jet'
  | 'large_jet'
  | 'heavy_jet'
  | 'ultra_long_range_jet'
  | 'turboprop';

export const AIRCRAFT_TYPE_LABELS: Record<AircraftType, string> = {
  very_light_jet: 'Very Light Jet (Phenom 100, Citation M2)',
  light_jet: 'Light Jet (CJ3, Lear 40, Phenom 300)',
  midsize_jet: 'Midsize Jet (Hawker 800XP, Citation XLS)',
  super_mid_jet: 'Super-Mid Jet (Citation Sovereign, Challenger 300)',
  large_jet: 'Large Jet (Falcon 2000, Gulfstream G200)',
  heavy_jet: 'Heavy Jet (Gulfstream G-IV, Global 5000)',
  ultra_long_range_jet: 'Ultra-Long Range Jet (Global 7500, Gulfstream G650)',
  turboprop: 'Turboprop (King Air 350, PC-12)',
};

export type TripStatus = 'draft' | 'confirmed' | 'completed';
export type InviteStatus = 'pending' | 'accepted' | 'declined';
export type MemberRole = 'operator_admin' | 'pilot';

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  operator_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Operator {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OperatorInvite {
  id: string;
  operator_id: string;
  email: string;
  role: MemberRole;
  status: InviteStatus;
  invited_by: string;
  created_at: string;
}

export interface Aircraft {
  id: string;
  operator_id: string;
  tail_number: string;
  nickname: string | null;
  manufacturer: string;
  model: string;
  aircraft_type: AircraftType;
  basic_empty_weight: number;
  max_takeoff_weight: number;
  max_landing_weight: number;
  max_ramp_weight: number;
  preferred_reserve: number;
  max_fuel_capacity: number;
  taxi_fuel_burn: number;
  default_pax_weight: number;
  baggage_weight_with_pax: number;
  baggage_weight_without_pax: number;
  default_pic_weight: number;
  default_sic_weight: number;
  cabin_attendant_weight: number;
  cruise_fuel_burn: number;
  penalty_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  operator_id: string;
  aircraft_id: string;
  trip_number: string;
  status: TripStatus;
  current_fuel_on_board: number;
  total_cost: number | null;
  total_savings: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FuelPriceTier {
  price_per_gallon: number;
  min_quantity_gallons: number;
}

export interface TripLeg {
  id: string;
  trip_id: string;
  leg_number: number;
  departure_icao: string;
  destination_icao: string;
  departure_fee_cost: number;
  departure_fee_waived_with: number;
  crew_weights: number[];
  passenger_weights: number[];
  baggage_weight: number;
  fuel_price_tiers: FuelPriceTier[];
  reserve: number;
  taxi_fuel_burn: number;
  max_takeoff_weight: number;
  max_landing_weight: number;
  fuel_burn: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TripLegResult {
  id: string;
  trip_leg_id: string;
  fuel_to_uplift_gallons: number;
  fuel_to_uplift_lbs: number;
  starting_fuel_lbs: number;
  landing_fuel_lbs: number;
  takeoff_weight_lbs: number;
  landing_weight_lbs: number;
  fuel_cost: number;
  waived_fees: string;
  total_cost: number;
  created_at: string;
}
