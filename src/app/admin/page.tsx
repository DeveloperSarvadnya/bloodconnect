'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Expected CSV format (header row required):
 * name,latitude,longitude,address,contact_number,A+,A-,B+,B-,AB+,AB-,O+,O-
 */
export default function AdminDashboard() {
  const supabase = createClient();
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatus(null);

    const text = await file.text();
    const [headerLine, ...lines] = text.trim().split('\n');
    const headers = headerLine.split(',').map((h) => h.trim());
    const bloodGroupCols = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    const banks = lines
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const values = line.split(',').map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => (row[h] = values[i]));

        const stock: Record<string, number> = {};
        bloodGroupCols.forEach((g) => {
          if (row[g]) stock[g] = Number(row[g]);
        });

        return {
          name: row.name,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          address: row.address,
          contact_number: row.contact_number,
          stock,
        };
      });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ banks }),
    });

    setUploading(false);
    if (res.ok) {
      const data = await res.json();
      setStatus(`Uploaded ${data.inserted} blood banks successfully.`);
    } else {
      const data = await res.json();
      setStatus(`Upload failed: ${data.error}`);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Admin — Bulk Upload Blood Banks</h1>
      <p className="mb-4 text-sm text-neutral-500">
        CSV columns: name, latitude, longitude, address, contact_number, A+, A-, B+, B-, AB+, AB-,
        O+, O-
      </p>
      <input type="file" accept=".csv" onChange={handleFile} disabled={uploading} />
      {status && <p className="mt-4 text-sm">{status}</p>}
    </main>
  );
}
