'use client';

import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { BloodRequest, BloodBank, DonationCamp } from '@/types';

interface BloodMapProps {
  requests: BloodRequest[];
  bloodBanks: BloodBank[];
  camps: DonationCamp[];
  center?: [number, number];
}

const URGENCY_COLOR: Record<string, string> = {
  critical: '#b91c1c',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#65a30d',
};

export default function BloodMap({
  requests,
  bloodBanks,
  camps,
  center = [20.5937, 78.9629], // default: center of India
}: BloodMapProps) {
  return (
    <MapContainer center={center} zoom={5} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Urgent blood requests — colored by urgency */}
      {requests.map((r) => (
        <CircleMarker
          key={r.id}
          center={[r.latitude, r.longitude]}
          radius={10}
          pathOptions={{ color: URGENCY_COLOR[r.urgency], fillOpacity: 0.7 }}
        >
          <Popup>
            <strong>{r.blood_group} needed</strong> ({r.units_needed} units)
            <br />
            Urgency: {r.urgency}
            <br />
            {r.address ?? 'Location on map'}
          </Popup>
        </CircleMarker>
      ))}

      {/* Blood banks */}
      {bloodBanks.map((b) => (
        <Marker key={b.id} position={[b.latitude, b.longitude]}>
          <Popup>
            <strong>{b.name}</strong>
            <br />
            {b.address}
            <br />
            {b.contact_number}
            <br />
            <em>Stock:</em>{' '}
            {Object.entries(b.stock || {})
              .map(([g, u]) => `${g}: ${u}`)
              .join(', ')}
          </Popup>
        </Marker>
      ))}

      {/* Donation camps */}
      {camps.map((c) => (
        <Marker key={c.id} position={[c.latitude, c.longitude]}>
          <Popup>
            <strong>{c.name}</strong>
            <br />
            {c.camp_date} {c.start_time ?? ''}–{c.end_time ?? ''}
            <br />
            {c.address}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
