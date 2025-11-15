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
  qrCode: string;
  gateway: 'alipay' | 'mock';
  payload: Record<string, unknown>;
};

type PrecreateRequestBody = {
  out_trade_no: string;
  total_amount: string;
  subject: string;
  notify_url?: string;
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
    const { notify_url, ...bizContent } = requestBody;
    const execParams: Record<string, unknown> = { bizContent };
    const notifyUrl = notify_url ?? client.defaultNotifyUrl;
    if (notifyUrl) {
      execParams.notifyUrl = notifyUrl;
    }
    if (client.defaultReturnUrl) {
      execParams.returnUrl = client.defaultReturnUrl;
    }
    const result = await client.sdk.exec(
      'alipay.trade.precreate',
      execParams,
    );

    const code = result.code;
    if (code !== '10000') {
      const subMsg = result.subMsg ?? result.sub_msg ?? result.msg ?? 'UNKNOWN ERROR';
      throw new Error(`支付宝返回错误: ${code ?? 'UNKNOWN'} - ${subMsg}`);
    }

    const qrCode = (result.qrCode ?? result.qr_code) as string | undefined;
    const tradeNo = (result.tradeNo ?? result.trade_no ?? order.id) as string | undefined;

    if (!qrCode) {
      throw new Error('支付宝返回数据缺少二维码');
    }

    logger.log('预订单创建成功', { tradeNo, qrCode });

    return {
      tradeNo: tradeNo ?? order.id,
      qrCode,
      gateway: 'alipay',
      payload: result,
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
    verify: (params: Record<string, string>) => client.sdk.checkNotifySignV2(params),
  };
}
