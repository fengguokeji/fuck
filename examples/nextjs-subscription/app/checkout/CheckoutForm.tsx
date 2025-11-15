'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import type { SubscriptionPlan } from '../../lib/plans';

type CreateOrderResponse = {
  orderId: string;
  tradeNo: string;
  qrCode: string;
  status: string;
  gateway: 'alipay' | 'mock';
  tutorialUrl: string;
};

type CheckoutFormProps = {
  plan: SubscriptionPlan;
};

export default function CheckoutForm({ plan }: CheckoutFormProps) {
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [orderResult, setOrderResult] = useState<
    (CreateOrderResponse & { customerEmail: string }) | null
  >(null);
  const router = useRouter();

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) {
      return;
    }
    setError(null);
    setDebugLog(null);
    setCopied(false);
    setCreating(true);
    setOrderResult(null);
    try {
      const normalizedEmail = email.trim();
      if (!normalizedEmail) {
        throw new Error('请输入有效的联系邮箱');
      }
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, planId: plan.id }),
      });
      setEmail(normalizedEmail);
      const data = (await res.json()) as CreateOrderResponse & { error?: string; debugLog?: string };
      if (!res.ok) {
        setDebugLog(data.debugLog ?? null);
        throw new Error(data.error ?? '无法创建订单');
      }
      setDebugLog(null);
      setOrderResult({ ...data, customerEmail: normalizedEmail });
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setCreating(false);
    }
  }

  async function copyDebugLog() {
    if (!debugLog) {
      return;
    }
    try {
      await navigator.clipboard.writeText(debugLog);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[debug-log:copy]', err);
    }
  }

  return (
    <form className="checkout-form" onSubmit={submitOrder}>
      <div className="checkout-form-header">
        <div className="section-header-text">
          <h2>填写信息并下单</h2>
          <p>
            输入联系邮箱后即可创建支付宝预订单，系统会生成扫码支付二维码并在支付后自动更新订单状态。
          </p>
        </div>
        <div className="section-summary">
          <span>当前套餐</span>
          <strong>¥{plan.price}</strong>
        </div>
      </div>

      <div className="form-row">
        <div className="input-field">
          <label htmlFor="checkout-email">联系邮箱</label>
          <input
            id="checkout-email"
            className="input-control"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
          />
        </div>
        <button type="submit" disabled={creating || !email} className="primary-button">
          {creating ? '正在创建订单…' : `使用套餐 ${plan.name}`}
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {debugLog && (
        <div className="debug-panel" role="status">
          <div className="debug-panel-header">
            <div>
              <strong>调试日志</strong>
              <p>请将以下日志发送给支持团队，或点击右侧按钮一键复制。</p>
            </div>
            <button type="button" className="secondary-button" onClick={copyDebugLog}>
              {copied ? '已复制' : '复制日志'}
            </button>
          </div>
          <pre className="debug-panel-body">{debugLog}</pre>
        </div>
      )}

      {orderResult && (
        <section className="checkout-payment-card" aria-live="polite">
          <div className="checkout-payment-card-header">
            <div>
              <p className="payment-pill">订单待支付</p>
              <h3>请使用支付宝扫码付款</h3>
              <p className="payment-hint">
                订单号 {orderResult.orderId} · 金额 ¥{plan.price}
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                router.push(
                  `/orders/${orderResult.orderId}?email=${encodeURIComponent(orderResult.customerEmail)}`,
                )
              }
            >
              查看订单详情
            </button>
          </div>
          <div className="payment-panel">
            <div className="qr-box">
              <span className="qr-label">扫码支付</span>
              <img
                src={orderResult.qrCode}
                alt={`订单 ${orderResult.orderId} 的支付宝支付二维码`}
                className="qr-image"
              />
              <p className="qr-tip">
                请使用支付宝扫描二维码完成支付，支付成功后可再次点击「查看订单详情」或前往订单列表查看状态。
              </p>
            </div>
          </div>
        </section>
      )}

    </form>
  );
}
