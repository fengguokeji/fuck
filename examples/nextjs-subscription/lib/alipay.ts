import { randomUUID } from 'crypto';
import { AlipaySdk } from 'alipay-sdk';
import { findPlan } from './plans';
import type { OrderRecord } from './db';

export class GatewayError extends Error {
  constructor(message: string, readonly debugLog?: string) {
    super(message);
    this.name = 'GatewayError';
  }
}

type DebugEntry = {
  timestamp: string;
  scope: string;
  message: string;
  details?: unknown;
};

class DebugLogger {
  private entries: DebugEntry[] = [];

  constructor(private scope: string) {}

  log(message: string, details?: unknown) {
    this.entries.push({
      timestamp: new Date().toISOString(),
      scope: this.scope,
      message,
      details,
    });
  }

  toString() {
    return this.entries
      .map((entry) => {
        const detail =
          entry.details === undefined
            ? ''
            : `\n${typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details, null, 2)}`;
        return `[${entry.timestamp}] ${entry.scope} - ${entry.message}${detail}`;
      })
      .join('\n\n');
  }
}


export type PreOrderResult = {
  tradeNo: string;
  qrCode: string;
  gateway: 'alipay' | 'mock';
  payload: Record<string, unknown>;
};

let alipayClient: AlipaySdk | null = null;

const hasKeyMaterial = Boolean(
  process.env.ALIPAY_APP_ID &&
    process.env.ALIPAY_PRIVATE_KEY &&
    (process.env.ALIPAY_ALIPAY_PUBLIC_KEY || process.env.ALIPAY_ALIPAY_PUBLIC_CERT_PATH)
);

const derivedNotifyUrl = process.env.ALIPAY_NOTIFY_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/alipay/notify` : undefined);

function getEndpointConfig() {
  const useSandbox = process.env.ALIPAY_USE_SANDBOX === 'true';
  if (useSandbox) {
    const endpoint = 'https://openapi.alipaydev.com';
    return {
      endpoint,
      gateway: `${endpoint}/gateway.do`,
    };
  }
  return null;
}

function getClient(): AlipaySdk | null {
  if (!hasKeyMaterial) {
    return null;
  }
  if (!alipayClient) {
    const endpointConfig = getEndpointConfig();
    alipayClient = new AlipaySdk({
      appId: process.env.ALIPAY_APP_ID!,
      privateKey: process.env.ALIPAY_PRIVATE_KEY!,
      alipayPublicKey: process.env.ALIPAY_ALIPAY_PUBLIC_KEY,
      alipayRootCertPath: process.env.ALIPAY_ALIPAY_ROOT_CERT_PATH,
      alipayPublicCertPath: process.env.ALIPAY_ALIPAY_PUBLIC_CERT_PATH,
      appCertPath: process.env.ALIPAY_APP_CERT_PATH,
      ...(endpointConfig ?? {}),
    });
  }
  return alipayClient;
}

export function isMockMode() {
  return !hasKeyMaterial;
}

type UnknownRecord = Record<string, unknown>;

function collectObjectGraph(root: unknown): UnknownRecord[] {
  const seen = new Set<object>();
  const queue: unknown[] = [root];
  const result: UnknownRecord[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (seen.has(current as object)) {
      continue;
    }
    seen.add(current as object);
    const record = current as UnknownRecord;
    result.push(record);
    for (const value of Object.values(record)) {
      if (typeof value === 'object' && value !== null) {
        queue.push(value);
      }
    }
  }

  return result;
}

function pickFirstString(records: UnknownRecord[], keys: string[]): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
  }
  return undefined;
}

export async function createPreOrder(order: OrderRecord): Promise<PreOrderResult> {
  if (isMockMode()) {
    const qrContent = `MOCK_PAYMENT://${order.id}`;
    return {
      tradeNo: `MOCK-${randomUUID()}`,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrContent)}`,
      gateway: 'mock',
      payload: {
        qrContent,
      },
    };
  }

  const client = getClient();
  if (!client) {
    throw new Error('Alipay client unavailable');
  }

  const logger = new DebugLogger('alipay:precreate');
  const plan = findPlan(order.planId);

  logger.log('准备创建支付宝预订单', {
    orderId: order.id,
    planId: order.planId,
    amount: order.amount,
    useSandbox: process.env.ALIPAY_USE_SANDBOX === 'true',
  });

  const requestBody = {
    out_trade_no: order.id,
    total_amount: order.amount.toFixed(2),
    subject: plan?.name ?? 'Subscription Plan',
    notify_url: derivedNotifyUrl,
    product_code: 'FACE_TO_FACE_PAYMENT',
  };
  logger.log('请求参数', requestBody);

  let response;
  try {
    response = await client.curl('POST', '/v3/alipay/trade/precreate', {
      body: requestBody,
    });
  } catch (error) {
    logger.log('调用 alipay-sdk 失败', error instanceof Error ? { message: error.message, stack: error.stack } : error);
    throw new GatewayError('Failed to create Alipay pre-order', logger.toString());
  }

  const payload = response.data as UnknownRecord;
  logger.log('支付宝响应元数据', {
    traceId: response.traceId,
    httpStatus: response.responseHttpStatus,
  });
  logger.log('支付宝原始响应', payload);

  const objectGraph = collectObjectGraph(payload);

  const tradeNo = pickFirstString(objectGraph, ['tradeNo', 'trade_no']);
  const qrCode = pickFirstString(objectGraph, ['qrCode', 'qr_code']);

  const errorCode = pickFirstString(objectGraph, ['code', 'subCode', 'sub_code']);
  const errorMessage = pickFirstString(objectGraph, ['message', 'msg', 'sub_msg']);
  const traceId = typeof response.traceId === 'string' ? response.traceId : undefined;

  const friendlyErrorMessage = (() => {
    const details = [
      response.responseHttpStatus && response.responseHttpStatus !== 200
        ? `HTTP ${response.responseHttpStatus}`
        : undefined,
      errorCode,
      errorMessage,
      traceId ? `traceId: ${traceId}` : undefined,
    ].filter(Boolean);
    if (details.length > 0) {
      return `Failed to create Alipay pre-order: ${details.join(' - ')}`;
    }
    return 'Failed to create Alipay pre-order';
  })();

  if (!qrCode || !tradeNo) {
    logger.log('响应缺少必要字段', { tradeNo, qrCode, errorCode, errorMessage });
    throw new GatewayError(friendlyErrorMessage, logger.toString());
  }

  logger.log('预订单创建成功', { tradeNo, qrCode });

  return {
    tradeNo,
    qrCode,
    gateway: 'alipay',
    payload: payload as Record<string, unknown>,
  };
}

export function getNotifyVerifier() {
  const client = getClient();
  if (!client) {
    return {
      verify: () => true,
    };
  }
  return {
    verify: (params: Record<string, string>) => client.checkNotifySignV2(params),
  };
}
