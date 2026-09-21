-- ============================================================
-- BloodConnect Database Schema
-- Real-Time Blood Donation & Emergency Resource Locator
-- ============================================================

-- Extension for geo functions (optional, we use plain lat/lng for simplicity)
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- PROFILES (extends Supabase auth.users)
-- role: 'donor' | 'hospital' | 'admin'
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('donor', 'hospital', 'admin')),
  phone text not null,
  blood_group text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  latitude double precision,
  longitude double precision,
  city text,
  is_available boolean default true,          -- donor toggles this off when unavailable
  last_donation_date date,                     -- used to enforce 90-day donation gap
  organization_name text,                      -- for hospital/admin role
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- BLOOD REQUESTS
-- Posted by hospitals when they need blood urgently
-- ------------------------------------------------------------
create table blood_requests (
  id uuid primary key default uuid_generate_v4(),
  hospital_id uuid not null references profiles(id) on delete cascade,
  blood_group text not null check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  units_needed int not null check (units_needed > 0),
  urgency text not null check (urgency in ('critical','high','medium','low')) default 'medium',
  patient_condition text,
  latitude double precision not null,
  longitude double precision not null,
  address text,
  status text not null check (status in ('open','partially_fulfilled','fulfilled','expired','cancelled')) default 'open',
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- DONATION RESPONSES
-- Tracks which donor responded to which request
-- ------------------------------------------------------------
create table donation_responses (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references blood_requests(id) on delete cascade,
  donor_id uuid not null references profiles(id) on delete cascade,
  status text not null check (status in ('pledged','confirmed','completed','cancelled')) default 'pledged',
  created_at timestamptz default now(),
  unique (request_id, donor_id)
);

-- ------------------------------------------------------------
-- BLOOD BANKS
-- Static/semi-static inventory locations
-- ------------------------------------------------------------
create table blood_banks (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  address text,
  contact_number text,
  -- stock stored as jsonb: {"A+": 12, "O-": 3, ...}
  stock jsonb default '{}'::jsonb,
  managed_by uuid references profiles(id),
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------
-- DONATION CAMPS
-- Scheduled blood donation drives/events
-- ------------------------------------------------------------
create table donation_camps (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  organizer text,
  latitude double precision not null,
  longitude double precision not null,
  address text,
  camp_date date not null,
  start_time time,
  end_time time,
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- EMERGENCY CONTACTS (pre-populated reference data)
-- ------------------------------------------------------------
create table emergency_contacts (
  id uuid primary key default uuid_generate_v4(),
  service_name text not null,
  phone_number text not null,
  display_order int default 0
);

insert into emergency_contacts (service_name, phone_number, display_order) values
  ('National Emergency', '112', 1),
  ('Ambulance', '108', 2),
  ('Blood Bank Helpline', '104', 3),
  ('Red Cross India', '1800-180-1104', 4);

-- ------------------------------------------------------------
-- INDEXES for common lookups (nearby search, matching by blood group)
-- ------------------------------------------------------------
create index idx_profiles_blood_group on profiles (blood_group) where role = 'donor';
create index idx_profiles_location on profiles (latitude, longitude);
create index idx_requests_status_group on blood_requests (status, blood_group);
create index idx_requests_location on blood_requests (latitude, longitude);
create index idx_blood_banks_location on blood_banks (latitude, longitude);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table blood_requests enable row level security;
alter table donation_responses enable row level security;
alter table blood_banks enable row level security;
alter table donation_camps enable row level security;
alter table emergency_contacts enable row level security;

-- Profiles: users can read all (to find donors), but only edit their own
create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

-- Blood requests: readable by all, only hospital/admin can create
create policy "requests_select_all" on blood_requests for select using (true);
create policy "requests_insert_hospital" on blood_requests for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('hospital','admin'))
  );
create policy "requests_update_owner" on blood_requests for update
  using (hospital_id = auth.uid());

-- Donation responses: donor manages their own pledge, hospital can view responses to their request
create policy "responses_select_related" on donation_responses for select
  using (
    donor_id = auth.uid()
    or exists (select 1 from blood_requests r where r.id = request_id and r.hospital_id = auth.uid())
  );
create policy "responses_insert_donor" on donation_responses for insert
  with check (donor_id = auth.uid());

-- Blood banks & camps: public read, admin/hospital write
create policy "banks_select_all" on blood_banks for select using (true);
create policy "banks_write_admin" on blood_banks for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('hospital','admin')));

create policy "camps_select_all" on donation_camps for select using (true);
create policy "camps_write_admin" on donation_camps for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('hospital','admin')));

create policy "contacts_select_all" on emergency_contacts for select using (true);

-- ------------------------------------------------------------
-- REALTIME: enable replication for live alerts
-- ------------------------------------------------------------
alter publication supabase_realtime add table blood_requests;
alter publication supabase_realtime add table donation_responses;
