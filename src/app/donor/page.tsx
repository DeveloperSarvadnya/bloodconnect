'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BloodRequest, Profile } from '@/types';
import { COMPATIBLE_DONORS } from '@/types';
import { distanceKm } from '@/lib/geo';

export default function DonorDashboard() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nearbyRequests, setNearbyRequests] = useState<(BloodRequest & { distance_km: number })[]>(
    []
  );
  const [pledged, setPledged] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
      if (!p?.latitude || !p?.longitude || !p?.blood_group) return;

      // A donor's blood group can donate to any recipient group listed as compatible with it
      const canDonateTo = Object.entries(COMPATIBLE_DONORS)
        .filter(([, donors]) => donors.includes(p.blood_group))
        .map(([recipientGroup]) => recipientGroup);

      const { data: requests } = await supabase
        .from('blood_requests')
        .select('*')
        .in('status', ['open', 'partially_fulfilled'])
        .in('blood_group', canDonateTo);

      const withDistance = (requests ?? [])
        .map((r) => ({ ...r, distance_km: distanceKm(p.latitude, p.longitude, r.latitude, r.longitude) }))
        .filter((r) => r.distance_km <= 25)
        .sort((a, b) => a.distance_km - b.distance_km);

      setNearbyRequests(withDistance);
    }
    load();
  }, [supabase]);

  async function toggleAvailability() {
    if (!profile) return;
    const newValue = !profile.is_available;
    await supabase.from('profiles').update({ is_available: newValue }).eq('id', profile.id);
    setProfile({ ...profile, is_available: newValue });
  }

  async function pledge(requestId: string) {
    if (!profile) return;
    const { error } = await supabase
      .from('donation_responses')
      .insert({ request_id: requestId, donor_id: profile.id, status: 'pledged' });
    if (!error) setPledged((prev) => new Set(prev).add(requestId));
  }

  if (!profile) return <main className="p-6">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between rounded-lg border bg-white p-4">
        <div>
          <h1 className="text-xl font-semibold">Hi, {profile.full_name}</h1>
          <p className="text-sm text-neutral-500">
            Blood group: <strong>{profile.blood_group}</strong>
          </p>
        </div>
        <button
          onClick={toggleAvailability}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            profile.is_available ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-600'
          }`}
        >
          {profile.is_available ? 'Available to donate' : 'Not available'}
        </button>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Nearby requests you can help with</h2>
      {nearbyRequests.length === 0 && (
        <p className="text-sm text-neutral-500">No compatible urgent requests nearby right now.</p>
      )}
      <div className="space-y-3">
        {nearbyRequests.map((r) => (
          <div key={r.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {r.blood_group} needed · {r.units_needed} units
                </p>
                <p className="text-sm text-neutral-500">
                  {r.distance_km.toFixed(1)} km away · urgency: {r.urgency}
                </p>
              </div>
              <button
                onClick={() => pledge(r.id)}
                disabled={pledged.has(r.id)}
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-800 disabled:opacity-50"
              >
                {pledged.has(r.id) ? 'Pledged' : 'Pledge to donate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
