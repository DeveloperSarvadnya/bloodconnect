import { NextResponse } from 'next/server';
import { withMetrics } from '@/lib/withMetrics';

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