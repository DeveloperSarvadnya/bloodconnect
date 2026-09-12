import client from 'prom-client';

/**
 * Prometheus metrics registry, shared across API routes.
 * Next.js can reload modules in dev mode, so we guard against
 * re-registering the same metrics twice (which prom-client throws on).
 */
declare global {
  // eslint-disable-next-line no-var
  var __prometheusRegistry: client.Registry | undefined;
  // eslint-disable-next-line no-var
  var __httpRequestCounter: client.Counter<string> | undefined;
  // eslint-disable-next-line no-var
  var __httpRequestDuration: client.Histogram<string> | undefined;
  // eslint-disable-next-line no-var
  var __bloodRequestsCounter: client.Counter<string> | undefined;
}

export const registry = global.__prometheusRegistry ?? new client.Registry();

if (!global.__prometheusRegistry) {
  client.collectDefaultMetrics({ register: registry }); // CPU, memory, event loop lag, etc.
  global.__prometheusRegistry = registry;
}

export const httpRequestCounter =
  global.__httpRequestCounter ??
  new client.Counter({
    name: 'bloodconnect_http_requests_total',
    help: 'Total number of HTTP requests handled, by route and status',
    labelNames: ['route', 'method', 'status'],
    registers: [registry],
  });
global.__httpRequestCounter = httpRequestCounter;

export const httpRequestDuration =
  global.__httpRequestDuration ??
  new client.Histogram({
    name: 'bloodconnect_http_request_duration_seconds',
    help: 'HTTP request duration in seconds, by route',
    labelNames: ['route', 'method'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [registry],
  });
global.__httpRequestDuration = httpRequestDuration;

// Domain-specific metric: track how many blood requests get posted, by urgency.
// This is what makes the dashboard meaningful rather than just generic infra graphs.
export const bloodRequestsCounter =
  global.__bloodRequestsCounter ??
  new client.Counter({
    name: 'bloodconnect_blood_requests_created_total',
    help: 'Total blood requests created, labeled by urgency and blood group',
    labelNames: ['urgency', 'blood_group'],
    registers: [registry],
  });
global.__bloodRequestsCounter = bloodRequestsCounter;
