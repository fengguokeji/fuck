import { randomUUID, createSign, createVerify, X509Certificate } from 'crypto';
import { readFileSync } from 'fs';
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

const SIGN_ALGORITHMS = {
  RSA: 'RSA-SHA1',
  RSA2: 'RSA-SHA256',
} as const;

type SignType = keyof typeof SIGN_ALGORITHMS;

type LegacyClientOptions = {
  appId: string;
  privateKey: string;
  alipayPublicKey?: string;
  gatewayBase?: string;
  charset?: string;
  signType?: SignType;
  defaultNotifyUrl?: string;
  defaultReturnUrl?: string;
};

class LegacyAlipayClient {
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly alipayPublicKey?: string;
  private readonly gatewayUrl: string;
  private readonly signType: SignType;
  private readonly charset: string;
  private readonly defaultNotifyUrl?: string;
  private readonly defaultReturnUrl?: string;

  constructor(options: LegacyClientOptions) {
    this.appId = options.appId;
    this.privateKey = this.normalizeKey(options.privateKey, 'PRIVATE KEY');
    this.alipayPublicKey = options.alipayPublicKey
      ? this.normalizeKey(options.alipayPublicKey, 'PUBLIC KEY')
      : undefined;
    this.signType = options.signType ?? 'RSA2';
    this.charset = options.charset ?? 'utf-8';
    const gatewayBase = options.gatewayBase ?? 'https://openapi.alipay.com';
    this.gatewayUrl = `${gatewayBase}/gateway.do?charset=${this.charset}`;
    this.defaultNotifyUrl = options.defaultNotifyUrl;
    this.defaultReturnUrl = options.defaultReturnUrl;
  }

  async precreate(body: PrecreateRequestBody) {
    const { notify_url, ...bizContent } = body;
    const response = await this.call('alipay.trade.precreate', {
      bizContent,
      notifyUrl: notify_url,
    });

    const code = response.response.code;
    if (code !== '10000') {
      const subMsg = response.response.sub_msg ?? response.response.msg ?? 'UNKNOWN ERROR';
      throw new Error(`支付宝返回错误: ${code ?? 'UNKNOWN'} - ${subMsg}`);
    }

    const qrCode = (response.response.qr_code ?? response.response.qrCode) as string | undefined;
    const tradeNo = (response.response.trade_no ?? response.response.tradeNo ?? body.out_trade_no) as string | undefined;

    if (!qrCode) {
      throw new Error('支付宝返回数据缺少二维码');
    }

    return {
      tradeNo: tradeNo ?? body.out_trade_no,
      qrCode,
      payload: response.raw,
    } satisfies Omit<PreOrderResult, 'gateway'>;
  }

  verify(params: Record<string, string>) {
    if (!this.alipayPublicKey) {
      return false;
    }
    const sign = params.sign;
    if (!sign) {
      return false;
    }
    const signType = (params.sign_type as SignType | undefined) ?? this.signType;
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (key === 'sign' || key === 'sign_type') {
        continue;
      }
      filtered[key] = value;
    }
    const content = this.buildSignContent(filtered);
    const verifier = createVerify(SIGN_ALGORITHMS[signType] ?? SIGN_ALGORITHMS.RSA2);
    return verifier.update(content, 'utf8').verify(this.alipayPublicKey, sign, 'base64');
  }

  private async call(method: string, options: {
    bizContent?: Record<string, unknown>;
    notifyUrl?: string;
    returnUrl?: string;
    extraParams?: Record<string, string>;
  }) {
    const params = this.buildCommonParams(method, options);
    const signed = this.signParams(params);
    const payload = await this.postForm(signed);
    return this.extractResponse(method, payload);
  }

  private buildCommonParams(method: string, options: {
    bizContent?: Record<string, unknown>;
    notifyUrl?: string;
    returnUrl?: string;
    extraParams?: Record<string, string>;
  }) {
    const params: Record<string, string> = {
      app_id: this.appId,
      method,
      format: 'JSON',
      charset: this.charset,
      sign_type: this.signType,
      timestamp: this.getCurrentTime(),
      version: '1.0',
      ...(options.extraParams ?? {}),
    };

    const notifyUrl = options.notifyUrl ?? this.defaultNotifyUrl;
    if (notifyUrl) {
      params.notify_url = notifyUrl;
    }

    const returnUrl = options.returnUrl ?? this.defaultReturnUrl;
    if (returnUrl) {
      params.return_url = returnUrl;
    }

    if (options.bizContent) {
      params.biz_content = JSON.stringify(options.bizContent);
    }

    return params;
  }

  private signParams(params: Record<string, string>) {
    const signStr = this.buildSignContent(params);
    const sign = createSign(SIGN_ALGORITHMS[this.signType])
      .update(signStr, 'utf8')
      .sign(this.privateKey, 'base64');
    return { ...params, sign };
  }

  private buildSignContent(params: Record<string, string>) {
    return Object.keys(params)
      .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
  }

  private normalizeKey(key: string, type: 'PRIVATE KEY' | 'PUBLIC KEY') {
    const trimmed = key.trim();
    if (trimmed.includes('BEGIN')) {
      return trimmed;
    }
    const chunks = trimmed.replace(/\s+/g, '').match(/.{1,64}/g) ?? [];
    return `-----BEGIN ${type}-----\n${chunks.join('\n')}\n-----END ${type}-----`;
  }

  private getCurrentTime() {
    const date = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private async postForm(params: Record<string, string>) {
    const body = new URLSearchParams(params);
    const response = await fetch(this.gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const text = await response.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`无法解析支付宝响应: ${text}`);
    }
    if (!response.ok) {
      throw new Error(`支付宝网关返回 HTTP ${response.status}`);
    }
    return parsed;
  }

  private extractResponse(method: string, payload: Record<string, unknown>) {
    const responseKey = `${method.replace(/\./g, '_')}_response`;
    const response = payload[responseKey];
    if (!response || typeof response !== 'object') {
      throw new Error('支付宝返回数据格式异常');
    }
    return { response: response as Record<string, unknown>, raw: payload };
  }
}

let alipayClient: LegacyAlipayClient | null = null;

function readEnv(name: string) {
  const value = process.env[name];
  if (!value || value === 'undefined' || value === 'null') {
    return undefined;
  }
  return value;
}

function readFileIfPresent(path?: string) {
  if (!path) {
    return undefined;
  }
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

function resolveAlipayPublicKey() {
  const direct = readEnv('ALIPAY_ALIPAY_PUBLIC_KEY');
  if (direct) {
    return direct;
  }
  const certPath = readEnv('ALIPAY_ALIPAY_PUBLIC_CERT_PATH');
  if (!certPath) {
    return undefined;
  }
  const content = readFileIfPresent(certPath);
  if (!content) {
    return undefined;
  }
  try {
    const cert = new X509Certificate(content);
    return cert.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  } catch {
    return undefined;
  }
}

function shouldForceMockGateway() {
  return process.env.ALIPAY_FORCE_MOCK === 'true';
}

function hasAlipayKeyMaterial() {
  const appId = readEnv('ALIPAY_APP_ID');
  const privateKey = readEnv('ALIPAY_PRIVATE_KEY');
  const publicKey = resolveAlipayPublicKey();
  return Boolean(appId && privateKey && publicKey);
}

const derivedNotifyUrl =
  process.env.ALIPAY_NOTIFY_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/alipay/notify` : undefined);

function getGatewayBase() {
  return process.env.ALIPAY_USE_SANDBOX === 'true'
    ? 'https://openapi.alipaydev.com'
    : 'https://openapi.alipay.com';
}

function getClient(): LegacyAlipayClient | null {
  if (shouldForceMockGateway()) {
    return null;
  }
  if (!hasAlipayKeyMaterial()) {
    return null;
  }
  if (!alipayClient) {
    const appId = readEnv('ALIPAY_APP_ID')!;
    const privateKey = readEnv('ALIPAY_PRIVATE_KEY')!;
    const publicKey = resolveAlipayPublicKey()!;
    alipayClient = new LegacyAlipayClient({
      appId,
      privateKey,
      alipayPublicKey: publicKey,
      gatewayBase: getGatewayBase(),
      defaultNotifyUrl: derivedNotifyUrl,
      defaultReturnUrl: readEnv('ALIPAY_RETURN_URL'),
    });
  }
  return alipayClient;
}

export function isMockMode() {
  if (shouldForceMockGateway()) {
    return true;
  }
  return !hasAlipayKeyMaterial();
}

type PrecreateRequestBody = {
  out_trade_no: string;
  total_amount: string;
  subject: string;
  notify_url?: string;
  product_code: string;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return error;
}

function buildMockPreOrder(order: OrderRecord): PreOrderResult {
  const qrContent = `MOCK_PAYMENT://${order.id}`;
  return {
    tradeNo: `MOCK-${randomUUID()}`,
    qrCode: qrContent,
    gateway: 'mock',
    payload: {
      qrContent,
    },
  };
}

export async function createPreOrder(order: OrderRecord): Promise<PreOrderResult> {
  if (isMockMode()) {
    return buildMockPreOrder(order);
  }

  const client = getClient();
  if (!client) {
    return buildMockPreOrder(order);
  }

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

  try {
    const result = await client.precreate(requestBody);
    logger.log('预订单创建成功', { tradeNo: result.tradeNo, qrCode: result.qrCode });
    return {
      tradeNo: result.tradeNo,
      qrCode: result.qrCode,
      gateway: 'alipay',
      payload: result.payload,
    } satisfies PreOrderResult;
  } catch (error) {
    logger.log('调用支付宝预创建接口失败', serializeError(error));
    throw new GatewayError(
      error instanceof Error ? error.message : 'Failed to create Alipay pre-order',
      logger.toString(),
    );
  }
}

export function getNotifyVerifier() {
  const client = getClient();
  if (!client) {
    return {
      verify: () => true,
    };
  }
  return {
    verify: (params: Record<string, string>) => client.verify(params),
  };
}
