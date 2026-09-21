import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { distanceKm } from '@/lib/geo';
import { COMPATIBLE_DONORS, type BloodGroup } from '@/types';
import { withMetrics } from '@/lib/withMetrics';
import { DEFAULT_MATCH_RADIUS_KM } from '@/lib/constants';

/**
 * GET /api/requests/nearby?radius_km=50
 *
 * Server-side source of truth for "what requests should this donor see."
 * Requires an authenticated donor. Filters by blood-group compatibility
 * AND distance (donors never see requests outside the given radius,
 * regardless of blood group match — a Chennai donor should not see a
 * Hyderabad hospital's request just because the blood group lines up).
 *
 * Each request comes back with the requesting hospital's name/phone/city
 * embedded, via the profiles<->blood_requests foreign key, so the donor
 * knows who they'd actually be donating to.
 */
export const GET = withMetrics('/api/requests/nearby', async (req: Request) => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: donor, error: donorError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (donorError || !donor) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (!donor.latitude || !donor.longitude) {
    // Distinguish this from "no matches" — the donor dashboard uses this
    // flag to tell the person to enable location, instead of the old
    // silent-empty-list behavior that looked identical to "no requests".
    return NextResponse.json({ requests: [], reason: 'no_donor_location' });
  }

  if (!donor.blood_group) {
    return NextResponse.json({ requests: [], reason: 'no_blood_group' });
  }

  const { searchParams } = new URL(req.url);
  const radiusKm = Number(searchParams.get('radius_km') ?? DEFAULT_MATCH_RADIUS_KM);

  // Blood groups this donor is compatible with donating to
  const canDonateTo = (Object.entries(COMPATIBLE_DONORS) as [BloodGroup, BloodGroup[]][])
    .filter(([, donors]) => donors.includes(donor.blood_group as BloodGroup))
    .map(([recipientGroup]) => recipientGroup);

  const { data: requests, error: requestsError } = await supabase
    .from('blood_requests')
    .select('*, hospital:profiles!hospital_id(organization_name, full_name, phone, city)')
    .in('status', ['open', 'partially_fulfilled'])
    .in('blood_group', canDonateTo);

  if (requestsError) {
    return NextResponse.json({ error: requestsError.message }, { status: 500 });
  }

  const nearby = (requests ?? [])
    .map((r) => ({
      ...r,
      distance_km: distanceKm(donor.latitude!, donor.longitude!, r.latitude, r.longitude),
    }))
    .filter((r) => r.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km);

  return NextResponse.json({ requests: nearby, radius_km: radiusKm });
});
