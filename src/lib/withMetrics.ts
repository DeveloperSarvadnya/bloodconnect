import { httpRequestCounter, httpRequestDuration } from './metrics';

/**
 * Wraps a Next.js route handler so every call to it increments
 * bloodconnect_http_requests_total and observes
 * bloodconnect_http_request_duration_seconds — the two metrics the
 * "HTTP Requests / sec" and "Request Duration (p95)" Grafana panels
 * depend on.
 *
 * Not applied to /api/metrics itself, to avoid the scrape endpoint
 * counting its own requests.
 *
 * Usage:
 *   export const GET = withMetrics('/api/health', async () => { ... });
 */
export function withMetrics<Args extends unknown[]>(
  route: string,
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    const start = process.hrtime.bigint();
    const method = (args[0] as Request | undefined)?.method ?? 'GET';
    let status = 200;

    try {
      const res = await handler(...args);
      status = res.status;
      return res;
    } catch (err) {
      status = 500;
      throw err;
    } finally {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      httpRequestCounter.inc({ route, method, status: String(status) });
      httpRequestDuration.observe({ route, method }, durationSeconds);
    }
  };
}