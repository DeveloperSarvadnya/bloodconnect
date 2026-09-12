'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { BloodGroup, UserRole } from '@/types';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function RegisterPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    role: 'donor' as UserRole,
    bloodGroup: 'O+' as BloodGroup,
    city: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Registration failed');
      setLoading(false);
      return;
    }

    // Try to get browser geolocation for donor/hospital location on the map
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        await createProfile(data.user!.id, pos.coords.latitude, pos.coords.longitude);
      },
      async () => {
        await createProfile(data.user!.id, null, null);
      }
    );
  }

  async function createProfile(userId: string, lat: number | null, lng: number | null) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      full_name: form.fullName,
      role: form.role,
      phone: form.phone,
      blood_group: form.role !== 'hospital' ? form.bloodGroup : null,
      city: form.city,
      latitude: lat,
      longitude: lng,
      is_available: true,
    });

    setLoading(false);
    if (profileError) {
      setError(profileError.message);
      return;
    }
    router.push(form.role === 'donor' ? '/donor' : '/hospital');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <form onSubmit={handleRegister} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold text-red-700">Register</h1>

        <div className="flex gap-3">
          {(['donor', 'hospital'] as UserRole[]).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => update('role', r)}
              className={`flex-1 rounded-md border py-2 capitalize ${
                form.role === r ? 'border-red-700 bg-red-50 text-red-700' : 'border-neutral-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <input
          required
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => update('fullName', e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />
        <input
          required
          placeholder="Phone number"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />
        <input
          placeholder="City"
          value={form.city}
          onChange={(e) => update('city', e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />

        {form.role === 'donor' && (
          <select
            value={form.bloodGroup}
            onChange={(e) => update('bloodGroup', e.target.value as BloodGroup)}
            className="w-full rounded-md border px-3 py-2"
          >
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-red-700 py-2 text-white hover:bg-red-800 disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </main>
  );
}
