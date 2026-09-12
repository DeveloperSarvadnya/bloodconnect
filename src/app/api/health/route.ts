import { NextResponse } from 'next/server';

/**
 * Health check endpoint hit by the Jenkins pipeline (and Ansible) after
 * deployment to verify the app booted correctly before marking a release
 * successful. Also usable by AWS target-group / load-balancer health checks.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'bloodconnect',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
