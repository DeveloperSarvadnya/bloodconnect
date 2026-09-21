-- ============================================================
-- Migration: allow 'cancelled' as a blood_requests status
-- Run this once in your Supabase SQL editor. Safe to run on an
-- existing project — it only widens the existing CHECK constraint,
-- it does not touch any data.
-- ============================================================

alter table blood_requests
  drop constraint if exists blood_requests_status_check;

alter table blood_requests
  add constraint blood_requests_status_check
  check (status in ('open', 'partially_fulfilled', 'fulfilled', 'expired', 'cancelled'));
