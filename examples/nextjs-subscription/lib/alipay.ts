import { randomUUID } from 'crypto';
import { AlipaySdk } from 'alipay-sdk';
import { findPlan } from './plans';
import type { OrderRecord } from './db';

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

  const plan = findPlan(order.planId);
  const response = await client.curl('POST', '/v3/alipay/trade/precreate', {
    body: {
      out_trade_no: order.id,
      total_amount: order.amount.toFixed(2),
      subject: plan?.name ?? 'Subscription Plan',
      notify_url: derivedNotifyUrl,
      product_code: 'FACE_TO_FACE_PAYMENT',
    },
  });

  const data = response.data as {
    tradeNo?: string;
    trade_no?: string;
    qrCode?: string;
    qr_code?: string;
  };

  const tradeNo = data?.tradeNo ?? data?.trade_no;
  const qrCode = data?.qrCode ?? data?.qr_code;

  if (!qrCode || !tradeNo) {
    throw new Error('Failed to create Alipay pre-order');
  }

  return {
    tradeNo,
    qrCode,
    gateway: 'alipay',
    payload: data as unknown as Record<string, unknown>,
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
