export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type UserRole = 'donor' | 'hospital' | 'admin';
export type Urgency = 'critical' | 'high' | 'medium' | 'low';
export type RequestStatus = 'open' | 'partially_fulfilled' | 'fulfilled' | 'expired';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string;
  blood_group: BloodGroup | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  is_available: boolean;
  last_donation_date: string | null;
  organization_name: string | null;
  created_at: string;
}

export interface BloodRequest {
  id: string;
  hospital_id: string;
  blood_group: BloodGroup;
  units_needed: number;
  urgency: Urgency;
  patient_condition: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  status: RequestStatus;
  expires_at: string | null;
  created_at: string;
}

export interface BloodBank {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  contact_number: string | null;
  stock: Record<BloodGroup, number>;
  updated_at: string;
}

export interface DonationCamp {
  id: string;
  name: string;
  organizer: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  camp_date: string;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
}

export interface EmergencyContact {
  id: string;
  service_name: string;
  phone_number: string;
}

// Compatibility rules: which donor blood groups can donate to which recipient group
export const COMPATIBLE_DONORS: Record<BloodGroup, BloodGroup[]> = {
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], // universal recipient
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+':  ['O+', 'O-'],
  'O-':  ['O-'], // universal donor group itself only accepts O-
};
