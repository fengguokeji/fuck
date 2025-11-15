import type { MockAgent } from 'urllib';

type MockReplyOptions = {
  path?: string | RegExp;
  method?: 'GET' | 'POST';
  status?: number;
  headers?: Record<string, string>;
  traceId?: string;
  body: string | Record<string, unknown>;
};

const STABLE_HTTP_ORIGIN = 'http://openapi.stable.dl.alipaydev.com';
const SANDBOX_ORIGIN = 'https://openapi-sandbox.dl.alipaydev.com';

function buildDefaultHeaders(traceId: string) {
  return {
    trace_id: traceId,
    'alipay-trace-id': traceId,
    'content-type': 'application/json',
    'alipay-timestamp': new Date().toISOString(),
    'alipay-nonce': `nonce-${Math.random().toString(16).slice(2)}`,
    'alipay-signature': 'mock-signature',
  } as Record<string, string>;
}

function normalizeBody(body: string | Record<string, unknown>) {
  return typeof body === 'string' ? body : JSON.stringify(body);
}

function mockResponse(agent: MockAgent, origin: string, options: MockReplyOptions) {
  const pool = agent.get(origin);
  const interceptor = pool.intercept({
    path: options.path ?? /\/gateway\.do/,
    method: options.method ?? 'POST',
  });
  const traceId = options.traceId ?? 'mocktraceid1234567890';
  const headerDefaults = buildDefaultHeaders(traceId);
  interceptor.reply(options.status ?? 200, normalizeBody(options.body), {
    headers: {
      ...headerDefaults,
      ...(options.headers ?? {}),
    },
  });
  return interceptor;
}

export function mockStableGateway(agent: MockAgent, options: MockReplyOptions) {
  return mockResponse(agent, STABLE_HTTP_ORIGIN, options);
}

export function mockStableApi(agent: MockAgent, options: MockReplyOptions) {
  if (!options.path) {
    throw new Error('mockStableApi 需要指定 path 参数');
  }
  return mockResponse(agent, STABLE_HTTP_ORIGIN, options);
}

export function mockSandboxGateway(agent: MockAgent, options: MockReplyOptions) {
  return mockResponse(agent, SANDBOX_ORIGIN, options);
}
