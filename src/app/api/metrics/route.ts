import { NextResponse } from 'next/server';
import { registry } from '@/lib/metrics';

/**
 * GET /api/metrics — Prometheus scrape target.
 * Add this URL to prometheus.yml as a scrape target (see /prometheus/prometheus.yml).
 */
export async function GET() {
  const metrics = await registry.metrics();
  return new NextResponse(metrics, {
    status: 200,
    headers: { 'Content-Type': registry.contentType },
  });
}
