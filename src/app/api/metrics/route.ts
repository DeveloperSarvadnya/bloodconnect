import { NextResponse } from 'next/server';
import { registry } from '@/lib/metrics';

// Without this, Next.js statically pre-renders the route at build time
// (since it reads no request data) and serves that ONE frozen snapshot
// forever — defeating the entire point of a live metrics endpoint.
export const dynamic = 'force-dynamic';

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