'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BloodGroup, BloodRequest, DonationResponseWithDonor, Profile, Urgency } from '@/types';
import { DEFAULT_MATCH_RADIUS_KM } from '@/lib/constants';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const URGENCIES: Urgency[] = ['critical', 'high', 'medium', 'low'];

interface MatchedDonor {
  id: string;
  full_name: string;
  phone: string;
  blood_group: BloodGroup | null;
  distance_km: number;
}

interface Toast {
  id: string;
  message: string;
}

export default function HospitalDashboard() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myRequests, setMyRequests] = useState<BloodRequest[]>([]);
  const [form, setForm] = useState({
    bloodGroup: 'O+' as BloodGroup,
    units: 1,
    urgency: 'high' as Urgency,
    condition: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const [expandedDonorsFor, setExpandedDonorsFor] = useState<string | null>(null);
  const [matchedDonors, setMatchedDonors] = useState<Record<string, MatchedDonor[]>>({});
  const [loadingDonorsFor, setLoadingDonorsFor] = useState<string | null>(null);

  const [expandedPledgesFor, setExpandedPledgesFor] = useState<string | null>(null);
  const [pledges, setPledges] = useState<Record<string, DonationResponseWithDonor[]>>({});

  const [toasts, setToasts] = useState<Toast[]>([]);
  const myRequestIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    myRequestIdsRef.current = new Set(myRequests.map((r) => r.id));
  }, [myRequests]);

  async function loadPledges(requestId: string) {
    const { data } = await supabase
      .from('donation_responses')
      .select('*, donor:profiles!donor_id(full_name, phone, blood_group)')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });
    setPledges((prev) => ({ ...prev, [requestId]: (data as DonationResponseWithDonor[]) ?? [] }));
  }

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);

      const { data: requests } = await supabase
        .from('blood_requests')
        .select('*')
        .eq('hospital_id', user.id)
        .order('created_at', { ascending: false });
      setMyRequests(requests ?? []);
    }
    load();
  }, [supabase]);

  // Live "notification" when a donor pledges to one of this hospital's
  // requests — there's no email/SMS infrastructure in this project, so an
  // in-app real-time alert (via the same Supabase Realtime channel the
  // rest of the app uses) is the right-sized version of this for now.
  useEffect(() => {
    const channel = supabase
      .channel('hospital_pledges')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'donation_responses' },
        async (payload) => {
          const newResponse = payload.new as { id: string; request_id: string; donor_id: string };
          if (!myRequestIdsRef.current.has(newResponse.request_id)) return;

          const { data: donor } = await supabase
            .from('profiles')
            .select('full_name, blood_group')
            .eq('id', newResponse.donor_id)
            .single();

          setToasts((prev) => [
            ...prev,
            {
              id: newResponse.id,
              message: `${donor?.full_name ?? 'A donor'} (${donor?.blood_group ?? 'unknown group'}) pledged to donate for one of your requests.`,
            },
          ]);

          if (expandedPledgesFor === newResponse.request_id) {
            loadPledges(newResponse.request_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, expandedPledgesFor]);

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.latitude || !profile?.longitude) {
      alert('Hospital location not set. Please update your profile location first.');
      return;
    }
    setSubmitting(true);

    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blood_group: form.bloodGroup,
        units_needed: form.units,
        urgency: form.urgency,
        patient_condition: form.condition,
        latitude: profile.latitude,
        longitude: profile.longitude,
        address: profile.city,
      }),
    });

    setSubmitting(false);
    if (res.ok) {
      const { request } = await res.json();
      setMyRequests((prev) => [request, ...prev]);
    } else {
      const { error } = await res.json();
      alert(`Failed to post request: ${error}`);
    }
  }

  async function withdrawRequest(id: string) {
    if (!confirm('Withdraw this request? Donors will no longer see it. This cannot be undone.')) {
      return;
    }
    setWithdrawingId(id);
    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    setWithdrawingId(null);
    if (res.ok) {
      const { request } = await res.json();
      setMyRequests((prev) => prev.map((r) => (r.id === id ? request : r)));
    } else {
      const { error } = await res.json();
      alert(`Failed to withdraw: ${error}`);
    }
  }

  async function toggleMatchedDonors(requestId: string) {
    if (expandedDonorsFor === requestId) {
      setExpandedDonorsFor(null);
      return;
    }
    setExpandedDonorsFor(requestId);
    if (!matchedDonors[requestId]) {
      setLoadingDonorsFor(requestId);
      const res = await fetch(
        `/api/donors/match?request_id=${requestId}&radius_km=${DEFAULT_MATCH_RADIUS_KM}`
      );
      if (res.ok) {
        const { matched_donors } = await res.json();
        setMatchedDonors((prev) => ({ ...prev, [requestId]: matched_donors }));
      }
      setLoadingDonorsFor(null);
    }
  }

  async function togglePledges(requestId: string) {
    if (expandedPledgesFor === requestId) {
      setExpandedPledgesFor(null);
      return;
    }
    setExpandedPledgesFor(requestId);
    if (!pledges[requestId]) {
      await loadPledges(requestId);
    }
  }

  if (!profile) return <main className="p-6">Loading…</main>;

  const activeStatuses = ['open', 'partially_fulfilled'];

  return (
    <main className="mx-auto max-w-2xl p-6">
      {/* Toast notifications for new pledges */}
      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-50 space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex max-w-sm items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 shadow-md"
            >
              <p className="flex-1 text-sm text-green-900">{t.message}</p>
              <button
                onClick={() => dismissToast(t.id)}
                className="text-green-700 hover:text-green-900"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <h1 className="mb-6 text-xl font-semibold">
        {profile.organization_name ?? profile.full_name} — Hospital Dashboard
      </h1>

      <form onSubmit={submitRequest} className="mb-8 space-y-3 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Post an urgent blood request</h2>
        <div className="flex gap-3">
          <select
            value={form.bloodGroup}
            onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value as BloodGroup }))}
            className="flex-1 rounded-md border px-3 py-2"
          >
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={form.units}
            onChange={(e) => setForm((f) => ({ ...f, units: Number(e.target.value) }))}
            className="w-24 rounded-md border px-3 py-2"
          />
          <select
            value={form.urgency}
            onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value as Urgency }))}
            className="flex-1 rounded-md border px-3 py-2 capitalize"
          >
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <textarea
          placeholder="Patient condition / notes (optional)"
          value={form.condition}
          onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
          className="w-full rounded-md border px-3 py-2"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-red-700 px-4 py-2 text-white hover:bg-red-800 disabled:opacity-50"
        >
          {submitting ? 'Posting…' : 'Post request'}
        </button>
      </form>

      <h2 className="mb-3 font-semibold">Your requests</h2>
      <div className="space-y-3">
        {myRequests.map((r) => (
          <div key={r.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">
                  {r.blood_group} · {r.units_needed} units · {r.urgency}
                </p>
                <p className="text-sm text-neutral-500">
                  Status: <span className="capitalize">{r.status}</span> · posted{' '}
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              {activeStatuses.includes(r.status) && (
                <button
                  onClick={() => withdrawRequest(r.id)}
                  disabled={withdrawingId === r.id}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
                >
                  {withdrawingId === r.id ? 'Withdrawing…' : 'Withdraw'}
                </button>
              )}
            </div>

            <div className="mt-3 flex gap-4 text-sm">
              <button
                onClick={() => togglePledges(r.id)}
                className="text-red-700 hover:underline"
              >
                {expandedPledgesFor === r.id ? 'Hide pledges' : 'View pledges'}
                {pledges[r.id] ? ` (${pledges[r.id].length})` : ''}
              </button>
              <button
                onClick={() => toggleMatchedDonors(r.id)}
                className="text-red-700 hover:underline"
              >
                {expandedDonorsFor === r.id ? 'Hide nearby donors' : 'View nearby donors'}
                {matchedDonors[r.id] ? ` (${matchedDonors[r.id].length})` : ''}
              </button>
            </div>

            {expandedPledgesFor === r.id && (
              <div className="mt-3 space-y-2 border-t pt-3">
                {(pledges[r.id]?.length ?? 0) === 0 && (
                  <p className="text-sm text-neutral-500">No pledges yet.</p>
                )}
                {pledges[r.id]?.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span>
                      {p.donor?.full_name ?? 'Unknown donor'} · {p.donor?.blood_group ?? '—'}
                    </span>
                    <span className="text-neutral-500">{p.donor?.phone}</span>
                  </div>
                ))}
              </div>
            )}

            {expandedDonorsFor === r.id && (
              <div className="mt-3 space-y-2 border-t pt-3">
                {loadingDonorsFor === r.id && (
                  <p className="text-sm text-neutral-500">Searching nearby donors…</p>
                )}
                {loadingDonorsFor !== r.id && (matchedDonors[r.id]?.length ?? 0) === 0 && (
                  <p className="text-sm text-neutral-500">
                    No compatible available donors within {DEFAULT_MATCH_RADIUS_KM} km.
                  </p>
                )}
                {matchedDonors[r.id]?.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span>
                      {d.full_name} · {d.blood_group}
                    </span>
                    <span className="text-neutral-500">
                      {d.distance_km.toFixed(1)} km · {d.phone}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
