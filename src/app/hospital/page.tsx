'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BloodGroup, BloodRequest, Profile, Urgency } from '@/types';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const URGENCIES: Urgency[] = ['critical', 'high', 'medium', 'low'];

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

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.latitude || !profile?.longitude) {
      alert('Hospital location not set. Please update your profile location first.');
      return;
    }
    setSubmitting(true);

    const { data, error } = await supabase
      .from('blood_requests')
      .insert({
        hospital_id: profile.id,
        blood_group: form.bloodGroup,
        units_needed: form.units,
        urgency: form.urgency,
        patient_condition: form.condition,
        latitude: profile.latitude,
        longitude: profile.longitude,
        address: profile.city,
        status: 'open',
      })
      .select()
      .single();

    setSubmitting(false);
    if (!error && data) {
      setMyRequests((prev) => [data, ...prev]);
    }
  }

  if (!profile) return <main className="p-6">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl p-6">
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
            <p className="font-medium">
              {r.blood_group} · {r.units_needed} units · {r.urgency}
            </p>
            <p className="text-sm text-neutral-500">
              Status: {r.status} · posted {new Date(r.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
