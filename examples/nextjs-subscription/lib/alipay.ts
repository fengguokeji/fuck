import { randomUUID, X509Certificate } from 'crypto';
import { readFileSync } from 'fs';
import { AlipaySdk, type AlipaySdkConfig } from 'alipay-sdk';
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
  qrCode?: string;
  paymentUrl?: string;
  gateway: 'alipay' | 'mock';
  payload: Record<string, unknown>;
};

type PagePayRequestBody = {
  out_trade_no: string;
  total_amount: string;
  subject: string;
  product_code: string;
};

type CertificateConfig = {
  appCertContent: string;
  alipayPublicCertContent: string;
  alipayRootCertContent: string;
};

type GatewayClient = {
  sdk: AlipaySdk;
  defaultNotifyUrl?: string;
  defaultReturnUrl?: string;
};

let alipayClient: GatewayClient | null = null;

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

function readKeyMaterial(name: string) {
  const value = readEnv(name);
  if (!value) {
    return undefined;
  }
  return readFileIfPresent(value) ?? value;
}

function readCertMaterial(name: string) {
  return readKeyMaterial(name);
}

function resolveCertificateConfig(): CertificateConfig | null {
  const appCertContent = readCertMaterial('ALIPAY_APP_CERT_PATH');
  const alipayPublicCertContent = readCertMaterial('ALIPAY_ALIPAY_PUBLIC_CERT_PATH');
  const alipayRootCertContent = readCertMaterial('ALIPAY_ALIPAY_ROOT_CERT_PATH');
  if (appCertContent && alipayPublicCertContent && alipayRootCertContent) {
    return { appCertContent, alipayPublicCertContent, alipayRootCertContent };
  }
  return null;
}

function resolveAlipayPublicKey() {
  const direct = readKeyMaterial('ALIPAY_ALIPAY_PUBLIC_KEY');
  if (direct) {
    return direct;
  }
  const certContent = readCertMaterial('ALIPAY_ALIPAY_PUBLIC_CERT_PATH');
  if (!certContent) {
    return undefined;
  }
  try {
    const cert = new X509Certificate(certContent);
    return cert.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  } catch {
    return undefined;
  }
}

function shouldForceMockGateway() {
  return process.env.ALIPAY_FORCE_MOCK === 'true';
}

const derivedNotifyUrl =
  process.env.ALIPAY_NOTIFY_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/alipay/notify` : undefined);

function getGatewayBase() {
  return process.env.ALIPAY_USE_SANDBOX === 'true'
    ? 'https://openapi.alipaydev.com'
    : 'https://openapi.alipay.com';
}

function buildSdkConfig(): AlipaySdkConfig | null {
  const appId = readEnv('ALIPAY_APP_ID');
  const privateKey = readKeyMaterial('ALIPAY_PRIVATE_KEY');
  if (!appId || !privateKey) {
    return null;
  }
  const config: AlipaySdkConfig = {
    appId,
    privateKey,
    gateway: `${getGatewayBase()}/gateway.do`,
    signType: 'RSA2',
  };
  const certificateConfig = resolveCertificateConfig();
  if (certificateConfig) {
    config.appCertContent = certificateConfig.appCertContent;
    config.alipayPublicCertContent = certificateConfig.alipayPublicCertContent;
    config.alipayRootCertContent = certificateConfig.alipayRootCertContent;
    return config;
  }
  const alipayPublicKey = resolveAlipayPublicKey();
  if (!alipayPublicKey) {
    return null;
  }
  config.alipayPublicKey = alipayPublicKey;
  return config;
}

function hasAlipayKeyMaterial() {
  return Boolean(buildSdkConfig());
}

function getClient(): GatewayClient | null {
  if (shouldForceMockGateway()) {
    return null;
  }
  if (alipayClient) {
    return alipayClient;
  }
  const sdkConfig = buildSdkConfig();
  if (!sdkConfig) {
    return null;
  }
  const sdk = new AlipaySdk(sdkConfig);
  alipayClient = {
    sdk,
    defaultNotifyUrl: derivedNotifyUrl,
    defaultReturnUrl: readEnv('ALIPAY_RETURN_URL'),
  };
  return alipayClient;
}

export function isMockMode() {
  if (shouldForceMockGateway()) {
    return true;
  }
  return !hasAlipayKeyMaterial();
}

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

  const logger = new DebugLogger('alipay:pagepay');
  const plan = findPlan(order.planId);

  logger.log('准备创建支付宝网页收银台链接', {
    orderId: order.id,
    planId: order.planId,
    amount: order.amount,
    useSandbox: process.env.ALIPAY_USE_SANDBOX === 'true',
  });
  logger.log('订单上下文', order);

  const requestBody: PagePayRequestBody = {
    out_trade_no: order.id,
    total_amount: order.amount.toFixed(2),
    subject: plan?.name ?? 'Subscription Plan',
    product_code: 'FAST_INSTANT_TRADE_PAY',
  };
  logger.log('请求参数', requestBody);

  try {
    const execParams: Record<string, unknown> = { bizContent: requestBody };
    const notifyUrl = client.defaultNotifyUrl ?? derivedNotifyUrl;
    if (notifyUrl) {
      execParams.notifyUrl = notifyUrl;
    }
    if (client.defaultReturnUrl) {
      execParams.returnUrl = client.defaultReturnUrl;
    }

    const paymentUrl = client.sdk.pageExecute('alipay.trade.page.pay', 'GET', execParams);

    if (!paymentUrl) {
      throw new Error('未能生成支付宝支付链接');
    }

    logger.log('支付链接生成成功', { paymentUrl });

    return {
      tradeNo: order.id,
      qrCode: paymentUrl,
      paymentUrl,
      gateway: 'alipay',
      payload: {
        requestBody,
        paymentUrl,
      },
    } satisfies PreOrderResult;
  } catch (error) {
    logger.log('调用支付宝页面支付接口失败', serializeError(error));
    throw new GatewayError(
      error instanceof Error ? error.message : 'Failed to create Alipay payment link',
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
    verify: (params: Record<string, string>) => client.sdk.checkNotifySignV2(params),
  };
}
