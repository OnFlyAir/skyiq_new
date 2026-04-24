export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  role_name: string;
  is_enabled: boolean;
  is_billing_manager?: boolean;
  created_on: string;
}

export interface CarryType {
  id: number;
  name: string;
  penalty_rate: number;
  cruise_fuel_burn: number;
}

export interface Aircraft {
  id: number;
  tail_number: string;
  basic_empty_weight: number;
  max_takeoff_weight: number;
  max_landing_weight: number;
  preferred_reserve: number;
  max_fuel_capacity: number;
  manufacturer: string;
  type: string;
  user_company: string | null;
  taxi_fuel_burn: number;
  max_ramp_weight: number;
  default_pax_weight: number;
  default_baggage_with_pax: number;
  default_baggage_no_pax: number;
  default_pic_weight: number;
  default_sic_weight: number;
  default_cabin_weight: number;
  is_enabled: boolean;
  carry_type_id: number | null;
  penalty_rate: number;
  cruise_fuel_burn: number;
}

export interface Trip {
  id: number;
  details: any;
  itinerary_details: any;
  itinerary_num: string;
  savings: number;
  user_company: string | null;
  created_on: string;
}

export interface EmailList {
  id: number;
  user_id: string | null;
  emails: any;
}
