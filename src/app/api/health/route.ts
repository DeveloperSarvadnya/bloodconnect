import { NextResponse } from 'next/server';
import { withMetrics } from '@/lib/withMetrics';

// Same reasoning as /api/metrics — without this, the timestamp below would
// be frozen at build time instead of reflecting the actual request.
export const dynamic = 'force-dynamic';

/**
 * Health check endpoint hit by the Jenkins pipeline (and Ansible) after
 * deployment to verify the app booted correctly before marking a release
 * successful. Also usable by AWS target-group / load-balancer health checks.
 */
export const GET = withMetrics('/api/health', async () => {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'bloodconnect',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
});