import { createSign, createVerify } from 'crypto';
import { findPlan } from './plans';
import type { OrderRecord } from './db';

export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayError';
  }
}

const ALIPAY_ALGORITHM_MAPPING = {
  RSA: 'RSA-SHA1',
  RSA2: 'RSA-SHA256',
} as const;

type SignType = keyof typeof ALIPAY_ALGORITHM_MAPPING;

type PrecreateRequestBody = {
  out_trade_no: string;
  total_amount: string;
  subject: string;
  product_code?: string;
};

export type PreOrderResult = {
  tradeNo: string;
  qrCode: string;
  gateway: 'alipay';
  payload: Record<string, unknown>;
};

type AlipayServiceOptions = {
  appId: string;
  privateKey: string;
  publicKey: string;
  notifyUrl: string;
  returnUrl?: string;
  gatewayBase?: string;
  method?: string;
  signType?: SignType;
};

class AlipayService {
  private readonly gatewayUrl: string;
  private readonly method: string;
  private readonly charset = 'utf-8';
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly signType: SignType;

  constructor(private readonly options: AlipayServiceOptions) {
    this.method = options.method ?? 'alipay.trade.precreate';
    this.signType = options.signType ?? 'RSA2';
    const gatewayBase = options.gatewayBase ?? 'https://openapi.alipay.com';
    this.gatewayUrl = `${gatewayBase}/gateway.do?charset=${this.charset}`;
    this.privateKey = this.normalizeKey(options.privateKey, 'RSA PRIVATE KEY');
    this.publicKey = this.normalizeKey(options.publicKey, 'PUBLIC KEY');
  }

  async precreate(body: PrecreateRequestBody) {
    const params = this.buildCommonParams(body);
    const signedParams = this.sign(params);
    const payload = await this.postForm(signedParams);
    const responseKey = `${this.method.replace(/\./g, '_')}_response`;
    const response = payload[responseKey];
    if (!response || typeof response !== 'object') {
      throw new Error('支付宝返回数据格式异常');
    }
    const responseRecord = response as Record<string, unknown>;
    const code = responseRecord.code as string | undefined;
    if (code !== '10000') {
      const message = (responseRecord.sub_msg ?? responseRecord.msg ?? '调用失败') as string;
      throw new Error(`支付宝返回错误: ${code ?? 'UNKNOWN'} - ${message}`);
    }
    const qrCode = (responseRecord.qr_code ?? responseRecord.qrCode) as string | undefined;
    const tradeNo = (responseRecord.trade_no ?? responseRecord.tradeNo ?? body.out_trade_no) as
      | string
      | undefined;
    if (!qrCode) {
      throw new Error('支付宝返回数据缺少二维码');
    }
    return {
      tradeNo: tradeNo ?? body.out_trade_no,
      qrCode,
      payload,
    } satisfies PreOrderResult;
  }

  verify(params: Record<string, string>) {
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
    const signContent = this.getSignContent(filtered);
    const verifier = createVerify(ALIPAY_ALGORITHM_MAPPING[signType] ?? ALIPAY_ALGORITHM_MAPPING.RSA2);
    return verifier.update(signContent, 'utf8').verify(this.publicKey, sign, 'base64');
  }

  private buildCommonParams(body: PrecreateRequestBody) {
    const params: Record<string, string> = {
      app_id: this.options.appId,
      method: this.method,
      format: 'JSON',
      charset: this.charset,
      sign_type: this.signType,
      version: '1.0',
      timestamp: this.getCurrentTime(),
      biz_content: JSON.stringify(body),
    };
    if (this.options.notifyUrl) {
      params.notify_url = this.options.notifyUrl;
    }
    if (this.options.returnUrl) {
      params.return_url = this.options.returnUrl;
    }
    return params;
  }

  private sign(params: Record<string, string>) {
    const signContent = this.getSignContent(params);
    const signer = createSign(ALIPAY_ALGORITHM_MAPPING[this.signType]);
    const signature = signer.update(signContent, 'utf8').sign(this.privateKey, 'base64');
    return { ...params, sign: signature };
  }

  private getSignContent(params: Record<string, string>) {
    return Object.keys(params)
      .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
  }

  private normalizeKey(key: string, type: 'RSA PRIVATE KEY' | 'PUBLIC KEY') {
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
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('无法解析支付宝响应');
    }
    if (!response.ok) {
      throw new Error(`支付宝网关返回 HTTP ${response.status}`);
    }
    return payload;
  }
}

let alipayClient: AlipayService | null = null;

function readEnv(name: string) {
  const value = process.env[name];
  if (!value || value === 'undefined' || value === 'null') {
    return undefined;
  }
  return value;
}

function resolveConfig(): AlipayServiceOptions {
  const appId = readEnv('ALIPAY_APP_ID');
  const privateKey = readEnv('ALIPAY_PRIVATE_KEY');
  const publicKey = readEnv('ALIPAY_PUBLIC_KEY');
  const notifyUrl = readEnv('ALIPAY_NOTIFY_URL');
  if (!appId || !privateKey || !publicKey || !notifyUrl) {
    throw new Error('缺少支付宝配置，请检查环境变量 ALIPAY_APP_ID/ALIPAY_PRIVATE_KEY/ALIPAY_PUBLIC_KEY/ALIPAY_NOTIFY_URL');
  }
  const useSandbox = process.env.ALIPAY_USE_SANDBOX === 'true';
  return {
    appId,
    privateKey,
    publicKey,
    notifyUrl,
    returnUrl: readEnv('ALIPAY_RETURN_URL'),
    gatewayBase: useSandbox ? 'https://openapi.alipaydev.com' : 'https://openapi.alipay.com',
    method: readEnv('ALIPAY_METHOD') ?? 'alipay.trade.precreate',
  };
}

function getClient() {
  if (!alipayClient) {
    const config = resolveConfig();
    alipayClient = new AlipayService(config);
  }
  return alipayClient;
}

export async function createPreOrder(order: OrderRecord): Promise<PreOrderResult> {
  const plan = findPlan(order.planId);
  const requestBody: PrecreateRequestBody = {
    out_trade_no: order.id,
    total_amount: order.amount.toFixed(2),
    subject: plan?.name ?? 'Subscription Plan',
    product_code: 'FACE_TO_FACE_PAYMENT',
  };
  try {
    const client = getClient();
    const result = await client.precreate(requestBody);
    return {
      tradeNo: result.tradeNo,
      qrCode: result.qrCode,
      gateway: 'alipay',
      payload: result.payload,
    } satisfies PreOrderResult;
  } catch (error) {
    throw new GatewayError(error instanceof Error ? error.message : '创建支付宝订单失败');
  }
}

export function getNotifyVerifier() {
  const client = getClient();
  return {
    verify: (params: Record<string, string>) => client.verify(params),
  };
}
