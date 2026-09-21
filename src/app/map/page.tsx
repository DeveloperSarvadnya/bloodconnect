'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import type { BloodRequest, BloodBank, DonationCamp } from '@/types';

// Leaflet touches `window`, so it must be loaded client-side only
const BloodMap = dynamic(() => import('@/components/map/BloodMap'), { ssr: false });

const REQUEST_SELECT = '*, hospital:profiles!hospital_id(organization_name, full_name, phone, city)';

export default function MapPage() {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [bloodBanks, setBloodBanks] = useState<BloodBank[]>([]);
  const [camps, setCamps] = useState<DonationCamp[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadInitialData() {
      const [{ data: r }, { data: b }, { data: c }] = await Promise.all([
        supabase
          .from('blood_requests')
          .select(REQUEST_SELECT)
          .in('status', ['open', 'partially_fulfilled']),
        supabase.from('blood_banks').select('*'),
        supabase.from('donation_camps').select('*'),
      ]);
      setRequests((r as BloodRequest[]) ?? []);
      setBloodBanks(b ?? []);
      setCamps(c ?? []);
    }
    loadInitialData();

    // Real-time subscription: new urgent requests appear on the map instantly.
    // Realtime only sends the raw inserted row (no joins), so we fetch the
    // hospital's name separately to keep the popup consistent with the
    // initial, joined load.
    const channel = supabase
      .channel('blood_requests_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'blood_requests' },
        async (payload) => {
          const newRequest = payload.new as BloodRequest;
          const { data: full } = await supabase
            .from('blood_requests')
            .select(REQUEST_SELECT)
            .eq('id', newRequest.id)
            .single();
          setRequests((prev) => [(full as BloodRequest) ?? newRequest, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b bg-white px-6 py-3">
        <h1 className="text-xl font-semibold text-red-700">BloodConnect — Live Map</h1>
        <p className="text-sm text-neutral-500">
          {requests.length} active requests · {bloodBanks.length} blood banks ·{' '}
          {camps.length} upcoming camps
        </p>
      </header>
      <div className="flex-1">
        <BloodMap requests={requests} bloodBanks={bloodBanks} camps={camps} />
      </div>
    </div>
  );
}
