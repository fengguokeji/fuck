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
  payload: Record<string, unknown>;
};

let alipayClient: AlipaySdk | null = null;

function readEnv(name: string) {
  const value = process.env[name];
  if (!value || value === 'undefined' || value === 'null') {
    return undefined;
  }
  return value;
}

function hasAlipayKeyMaterial() {
  const appId = readEnv('ALIPAY_APP_ID');
  const privateKey = readEnv('ALIPAY_PRIVATE_KEY');
  const publicKey = readEnv('ALIPAY_ALIPAY_PUBLIC_KEY');
  const publicCert = readEnv('ALIPAY_ALIPAY_PUBLIC_CERT_PATH');
  return Boolean(appId && privateKey && (publicKey || publicCert));
}

function collectMissingKeyParts() {
  const missing: string[] = [];
  if (!readEnv('ALIPAY_APP_ID')) {
    missing.push('ALIPAY_APP_ID');
  }
  if (!readEnv('ALIPAY_PRIVATE_KEY')) {
    missing.push('ALIPAY_PRIVATE_KEY');
  }
  if (!readEnv('ALIPAY_ALIPAY_PUBLIC_KEY') && !readEnv('ALIPAY_ALIPAY_PUBLIC_CERT_PATH')) {
    missing.push('ALIPAY_ALIPAY_PUBLIC_KEY 或 ALIPAY_ALIPAY_PUBLIC_CERT_PATH');
  }
  return missing;
}

const derivedNotifyUrl =
  process.env.ALIPAY_NOTIFY_URL ??
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

function getClient(): AlipaySdk {
  if (!hasAlipayKeyMaterial()) {
    const missingKeyParts = collectMissingKeyParts();
    throw new GatewayError(
      `缺少以下支付宝配置：${missingKeyParts.join('、')}。请在环境变量中补齐后再创建订单。`,
    );
  }
  if (!alipayClient) {
    const endpointConfig = getEndpointConfig();
    const appId = readEnv('ALIPAY_APP_ID')!;
    const privateKey = readEnv('ALIPAY_PRIVATE_KEY')!;
    alipayClient = new AlipaySdk({
      appId,
      privateKey,
      alipayPublicKey: readEnv('ALIPAY_ALIPAY_PUBLIC_KEY'),
      alipayRootCertPath: readEnv('ALIPAY_ALIPAY_ROOT_CERT_PATH'),
      alipayPublicCertPath: readEnv('ALIPAY_ALIPAY_PUBLIC_CERT_PATH'),
      appCertPath: readEnv('ALIPAY_APP_CERT_PATH'),
      ...(endpointConfig ?? {}),
    });
  }
  return alipayClient;
}

type UnknownRecord = Record<string, unknown>;

type PrecreateRequestBody = {
  out_trade_no: string;
  total_amount: string;
  subject: string;
  notify_url?: string;
  product_code: string;
};

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

type AttemptStage = 'v3' | 'v2';

type AttemptMeta = {
  stage: AttemptStage;
  httpStatus?: number;
  traceId?: string;
  errorCode?: string;
  errorMessage?: string;
};

type AttemptSuccess = {
  tradeNo: string;
  qrCode: string;
  payload: Record<string, unknown>;
};

type AttemptResult =
  | { success: true; value: AttemptSuccess }
  | { success: false; meta: AttemptMeta };

function extractResponseFields(payload: unknown) {
  const graph = collectObjectGraph(payload);
  return {
    tradeNo: pickFirstString(graph, ['tradeNo', 'trade_no']),
    qrCode: pickFirstString(graph, ['qrCode', 'qr_code']),
    errorCode: pickFirstString(graph, ['code', 'subCode', 'sub_code']),
    errorMessage: pickFirstString(graph, ['message', 'msg', 'sub_msg']),
  };
}

function describeFailure(meta?: AttemptMeta) {
  if (!meta) {
    return 'Failed to create Alipay pre-order';
  }
  const stageLabel = meta.stage === 'v3' ? 'V3 接口' : 'gateway.do 接口';
  const details = [
    stageLabel,
    meta.httpStatus ? `HTTP ${meta.httpStatus}` : undefined,
    meta.errorCode,
    meta.errorMessage,
    meta.traceId ? `traceId: ${meta.traceId}` : undefined,
  ].filter(Boolean);
  if (details.length === 0) {
    return 'Failed to create Alipay pre-order';
  }
  return `Failed to create Alipay pre-order: ${details.join(' - ')}`;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return error;
}

function collectErrorMeta(error: unknown, stage: AttemptStage): AttemptMeta {
  const meta: AttemptMeta = { stage };
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record.traceId === 'string') {
      meta.traceId = record.traceId;
    }
    if (typeof record.responseHttpStatus === 'number') {
      meta.httpStatus = record.responseHttpStatus;
    }
    if (typeof record.code === 'string') {
      meta.errorCode = record.code;
    }
  }
  if (error instanceof Error) {
    meta.errorMessage = error.message;
  }
  return meta;
}

export async function createPreOrder(order: OrderRecord): Promise<PreOrderResult> {
  const missingKeyParts = collectMissingKeyParts();
  if (missingKeyParts.length > 0) {
    throw new GatewayError(
      `缺少以下支付宝配置：${missingKeyParts.join('、')}。请在环境变量中补齐后再创建订单。`,
    );
  }

  const client = getClient();

  const logger = new DebugLogger('alipay:precreate');
  const plan = findPlan(order.planId);

  logger.log('准备创建支付宝预订单', {
    orderId: order.id,
    planId: order.planId,
    amount: order.amount,
    useSandbox: process.env.ALIPAY_USE_SANDBOX === 'true',
  });
  logger.log('订单上下文', order);

  const requestBody: PrecreateRequestBody = {
    out_trade_no: order.id,
    total_amount: order.amount.toFixed(2),
    subject: plan?.name ?? 'Subscription Plan',
    notify_url: derivedNotifyUrl,
    product_code: 'FACE_TO_FACE_PAYMENT',
  };
  logger.log('请求参数', requestBody);
  let resolvedResult: PreOrderResult | null = null;

  const v3Result = await attemptV3Precreate(client, requestBody, logger);
  if (v3Result.success) {
    logger.log('预订单创建成功 (V3)', { tradeNo: v3Result.value.tradeNo, qrCode: v3Result.value.qrCode });
    resolvedResult = {
      tradeNo: v3Result.value.tradeNo,
      qrCode: v3Result.value.qrCode,
      payload: v3Result.value.payload,
    } satisfies PreOrderResult;
  } else {
    logger.log('V3 接口未返回二维码，准备降级调用 gateway.do 接口');

    const v2Result = await attemptV2Precreate(client, requestBody, logger);
    if (v2Result.success) {
      logger.log('预订单创建成功 (gateway.do)', {
        tradeNo: v2Result.value.tradeNo,
        qrCode: v2Result.value.qrCode,
      });
      resolvedResult = {
        tradeNo: v2Result.value.tradeNo,
        qrCode: v2Result.value.qrCode,
        payload: v2Result.value.payload,
      } satisfies PreOrderResult;
    } else {
      const fallbackMeta = v2Result.meta ?? v3Result.meta;
      throw new GatewayError(describeFailure(fallbackMeta), logger.toString());
    }
  }

  if (!resolvedResult) {
    throw new GatewayError('无法确定支付宝预订单结果', logger.toString());
  }

  return resolvedResult;
}

async function attemptV3Precreate(
  client: AlipaySdk,
  requestBody: PrecreateRequestBody,
  logger: DebugLogger,
): Promise<AttemptResult> {
  try {
    const response = await client.curl('POST', '/v3/alipay/trade/precreate', {
      body: requestBody,
    });
    logger.log('支付宝 V3 响应元数据', {
      traceId: response.traceId,
      httpStatus: response.responseHttpStatus,
    });
    logger.log('支付宝 V3 原始响应', response.data);

    const fields = extractResponseFields(response.data);
    if (fields.qrCode) {
      if (!fields.tradeNo) {
        logger.log('支付宝 V3 响应缺少 tradeNo，使用 out_trade_no 兜底', {
          outTradeNo: requestBody.out_trade_no,
        });
      }
      return {
        success: true,
        value: {
          tradeNo: fields.tradeNo ?? requestBody.out_trade_no,
          qrCode: fields.qrCode,
          payload: response.data as Record<string, unknown>,
        },
      };
    }

    logger.log('支付宝 V3 响应缺少必要字段', fields);
    return {
      success: false,
      meta: {
        stage: 'v3',
        traceId: typeof response.traceId === 'string' ? response.traceId : undefined,
        httpStatus: response.responseHttpStatus,
        errorCode: fields.errorCode,
        errorMessage: fields.errorMessage,
      },
    };
  } catch (error) {
    logger.log('调用支付宝 V3 接口失败', serializeError(error));
    return { success: false, meta: collectErrorMeta(error, 'v3') };
  }
}

async function attemptV2Precreate(
  client: AlipaySdk,
  requestBody: PrecreateRequestBody,
  logger: DebugLogger,
): Promise<AttemptResult> {
  try {
    const { notify_url, ...bizContent } = requestBody;
    const response = await client.exec('alipay.trade.precreate', {
      notify_url,
      bizContent,
    });
    logger.log('支付宝 gateway.do 原始响应', response);

    const fields = extractResponseFields(response);
    if (fields.qrCode) {
      if (!fields.tradeNo) {
        logger.log('gateway.do 响应缺少 tradeNo，使用 out_trade_no 兜底', {
          outTradeNo: requestBody.out_trade_no,
        });
      }
      return {
        success: true,
        value: {
          tradeNo: fields.tradeNo ?? requestBody.out_trade_no,
          qrCode: fields.qrCode,
          payload: response as Record<string, unknown>,
        },
      };
    }

    logger.log('gateway.do 响应缺少必要字段', fields);
    return {
      success: false,
      meta: {
        stage: 'v2',
        errorCode: fields.errorCode,
        errorMessage: fields.errorMessage,
      },
    };
  } catch (error) {
    logger.log('调用支付宝 gateway.do 接口失败', serializeError(error));
    return { success: false, meta: collectErrorMeta(error, 'v2') };
  }
}

export function getNotifyVerifier() {
  const client = getClient();
  return {
    verify: (params: Record<string, string>) => client.checkNotifySignV2(params),
  };
}
