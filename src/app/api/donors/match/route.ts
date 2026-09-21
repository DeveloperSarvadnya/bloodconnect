import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { distanceKm } from '@/lib/geo';
import { COMPATIBLE_DONORS, type BloodGroup } from '@/types';
import { withMetrics } from '@/lib/withMetrics';
import { DEFAULT_MATCH_RADIUS_KM } from '@/lib/constants';

/**
 * GET /api/donors/match?request_id=...&radius_km=50
 *
 * Finds available donors whose blood group is compatible with the
 * requested blood group, sorted by distance from the request location.
 * This is the core "matching engine" of the platform.
 */
export const GET = withMetrics('/api/donors/match', async (req: Request) => {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('request_id');
  const radiusKm = Number(searchParams.get('radius_km') ?? DEFAULT_MATCH_RADIUS_KM);

  if (!requestId) {
    return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
  }

  const { data: request, error: requestError } = await supabase
    .from('blood_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (requestError || !request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  const compatibleGroups = COMPATIBLE_DONORS[request.blood_group as BloodGroup];

  const { data: donors, error: donorsError } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'donor')
    .eq('is_available', true)
    .in('blood_group', compatibleGroups)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (donorsError) return NextResponse.json({ error: donorsError.message }, { status: 500 });

  const matched = (donors ?? [])
    .map((donor) => ({
      ...donor,
      distance_km: distanceKm(request.latitude, request.longitude, donor.latitude, donor.longitude),
    }))
    .filter((donor) => donor.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km);

  return NextResponse.json({ matched_donors: matched, count: matched.length });
});
