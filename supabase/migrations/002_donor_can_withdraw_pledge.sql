-- ============================================================
-- Migration: allow donors to withdraw their own pledge
-- Run this once in your Supabase SQL editor. Safe on an existing
-- project — it only adds a new policy, it does not touch data.
--
-- Without this, a donor has INSERT permission on donation_responses
-- (to pledge) but no UPDATE permission at all, so there was no way
-- to change a pledge's status back to 'cancelled' — RLS silently
-- rejects the attempt.
-- ============================================================

create policy "responses_update_own_donor" on donation_responses
  for update
  using (donor_id = auth.uid())
  with check (donor_id = auth.uid());
