'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BloodRequest, Profile } from '@/types';
import { DEFAULT_MATCH_RADIUS_KM } from '@/lib/constants';

type NearbyRequest = BloodRequest & { distance_km: number };
type EmptyReason = 'no_donor_location' | 'no_blood_group' | null;

export default function DonorDashboard() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nearbyRequests, setNearbyRequests] = useState<NearbyRequest[]>([]);
  const [emptyReason, setEmptyReason] = useState<EmptyReason>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [pledged, setPledged] = useState<Set<string>>(new Set());

  async function loadNearbyRequests() {
    setLoadingRequests(true);
    const res = await fetch(`/api/requests/nearby?radius_km=${DEFAULT_MATCH_RADIUS_KM}`);
    if (res.ok) {
      const { requests, reason } = await res.json();
      setNearbyRequests(requests ?? []);
      setEmptyReason(reason ?? null);
    }
    setLoadingRequests(false);
  }

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);

      await loadNearbyRequests();

      // Reflect already-pledged requests correctly on refresh/re-login,
      // instead of only tracking pledges made during this browser session.
      const { data: myResponses } = await supabase
        .from('donation_responses')
        .select('request_id')
        .eq('donor_id', user.id);
      if (myResponses) {
        setPledged(new Set(myResponses.map((r) => r.request_id)));
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <h2 className="mb-3 text-lg font-semibold">
        Nearby requests you can help with{' '}
        <span className="font-normal text-neutral-400">
          (within {DEFAULT_MATCH_RADIUS_KM} km)
        </span>
      </h2>

      {!loadingRequests && emptyReason === 'no_donor_location' && (
        <p className="text-sm text-amber-700">
          We don&apos;t have your location on file, so we can&apos;t find requests near you.
          Enable location access and refresh the page.
        </p>
      )}
      {!loadingRequests && emptyReason === 'no_blood_group' && (
        <p className="text-sm text-amber-700">
          Your profile is missing a blood group, so we can&apos;t match you to requests.
        </p>
      )}
      {!loadingRequests && !emptyReason && nearbyRequests.length === 0 && (
        <p className="text-sm text-neutral-500">
          No compatible urgent requests within {DEFAULT_MATCH_RADIUS_KM} km right now.
        </p>
      )}

      <div className="space-y-3">
        {nearbyRequests.map((r) => (
          <div key={r.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {r.blood_group} needed · {r.units_needed} units
                </p>
                <p className="text-sm text-neutral-600">
                  {r.hospital?.organization_name ?? r.hospital?.full_name ?? 'Hospital'}
                  {r.hospital?.city ? ` · ${r.hospital.city}` : ''}
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
