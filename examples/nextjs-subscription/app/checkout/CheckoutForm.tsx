'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
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

type ActiveOrderState = CreateOrderResponse & { email: string };

type OrderStatusResponse = {
  id: string;
  status: string;
  qrCode: string | null;
  tradeNo: string | null;
  tutorialUrl: string;
  updatedAt: string;
};

export default function CheckoutForm({ plan }: CheckoutFormProps) {
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeOrder, setActiveOrder] = useState<ActiveOrderState | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isMobileClient, setIsMobileClient] = useState(false);
  const router = useRouter();
  const schemeInvokedRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      return;
    }
    const mobilePattern = /(iPhone|iPad|iPod|Android|Mobile)/i;
    setIsMobileClient(mobilePattern.test(navigator.userAgent));
  }, []);

  const openAlipayClient = useCallback((qrCode: string) => {
    if (!qrCode) {
      return;
    }
    const scheme = `alipays://platformapi/startapp?saId=10000007&qrcode=${encodeURIComponent(qrCode)}`;
    window.location.href = scheme;
  }, []);

  const refreshOrderStatus = useCallback(
    async (orderId: string, orderEmail: string, silent = false) => {
      try {
        const response = await fetch(`/api/orders/${orderId}?email=${encodeURIComponent(orderEmail)}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('无法查询订单状态');
        }
        const payload = (await response.json()) as OrderStatusResponse;
        setActiveOrder((prev) => {
          if (!prev || prev.orderId !== orderId) {
            return prev;
          }
          return {
            ...prev,
            status: payload.status,
            qrCode: payload.qrCode ?? prev.qrCode,
            tradeNo: payload.tradeNo ?? prev.tradeNo,
          };
        });
        if (payload.status === 'paid') {
          router.push(`/orders/${orderId}?email=${encodeURIComponent(orderEmail)}`);
        }
        if (!silent) {
          setStatusError(null);
        }
      } catch (err) {
        if (!silent) {
          setStatusError(err instanceof Error ? err.message : '无法查询订单状态');
        }
      }
    },
    [router],
  );

  useEffect(() => {
    if (!activeOrder) {
      return undefined;
    }
    refreshOrderStatus(activeOrder.orderId, activeOrder.email, true);
    const timer = setInterval(() => {
      refreshOrderStatus(activeOrder.orderId, activeOrder.email, true);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeOrder, refreshOrderStatus]);

  useEffect(() => {
    if (!activeOrder || !isMobileClient || !activeOrder.qrCode || schemeInvokedRef.current) {
      return;
    }
    schemeInvokedRef.current = true;
    openAlipayClient(activeOrder.qrCode);
  }, [activeOrder, isMobileClient, openAlipayClient]);

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) {
      return;
    }
    setError(null);
    setDebugLog(null);
    setCopied(false);
    setCreating(true);
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
      schemeInvokedRef.current = false;
      setStatusError(null);
      setActiveOrder({ ...data, email: normalizedEmail });
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

      {activeOrder && (
        <div className="checkout-payment-panel" role="status">
          <div className="checkout-payment-header">
            <div>
              <p className="checkout-payment-label">当前订单</p>
              <strong>{activeOrder.orderId}</strong>
            </div>
            <span className={`payment-status ${activeOrder.status === 'paid' ? 'payment-status--success' : 'payment-status--pending'}`}>
              {activeOrder.status === 'paid' ? '已支付' : '待支付'}
            </span>
          </div>

          <div className="checkout-payment-body">
            {isMobileClient ? (
              <div className="checkout-payment-mobile">
                <p>
                  {activeOrder.status === 'paid'
                    ? '系统已经同步到支付完成，可直接跳转查看订单详情。'
                    : '系统已尝试唤起支付宝客户端，请在完成支付后返回此页面，我们会自动同步订单状态。'}
                </p>
                {activeOrder.status !== 'paid' && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => activeOrder.qrCode && openAlipayClient(activeOrder.qrCode)}
                  >
                    重新打开支付宝
                  </button>
                )}
              </div>
            ) : (
              <div className="qr-box">
                <span className="qr-label">{activeOrder.status === 'paid' ? '支付完成' : '扫码支付'}</span>
                {activeOrder.qrCode ? (
                  <img
                    src={activeOrder.qrCode}
                    alt={`订单 ${activeOrder.orderId} 的支付二维码`}
                    className="qr-image"
                  />
                ) : (
                  <div className="qr-missing">暂未生成二维码，请稍后刷新页面。</div>
                )}
                <p className="qr-tip">
                  {activeOrder.status === 'paid'
                    ? '检测到支付成功，即将跳转到详情页。'
                    : '请使用支付宝扫描二维码完成支付，系统会定期刷新订单状态。'}
                </p>
              </div>
            )}

            <div className="checkout-payment-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => router.push(`/orders/${activeOrder.orderId}?email=${encodeURIComponent(activeOrder.email)}`)}
              >
                查看订单详情
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => refreshOrderStatus(activeOrder.orderId, activeOrder.email)}
              >
                手动刷新状态
              </button>
            </div>

            {statusError && <div className="alert-warning">{statusError}</div>}
          </div>
        </div>
      )}
    </form>
  );
}
