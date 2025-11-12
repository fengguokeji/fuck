'use client';

import Link from 'next/link';
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
  const [order, setOrder] = useState<CreateOrderResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) {
      return;
    }
    setError(null);
    setOrder(null);
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
      const data = (await res.json()) as CreateOrderResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? '无法创建订单');
      }
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setCreating(false);
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
          <strong>
            ¥{plan.price} / {plan.billingCycle}
          </strong>
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

      {order && (
        <div className="payment-panel">
          <div className="qr-box">
            <span className="qr-label">扫码支付</span>
            <img src={order.qrCode} alt="支付宝二维码" className="qr-image" />
            <p className="qr-tip">
              {order.gateway === 'mock'
                ? '当前处于模拟模式，二维码仅用于演示，订单会自动标记为已支付。'
                : '使用支付宝扫描二维码完成支付，支付成功后系统会立即同步订单状态。'}
            </p>
          </div>
          <div className="order-details">
            <div className="detail-item">
              <span className="detail-label">订单编号</span>
              <span className="detail-value">{order.orderId}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">支付状态</span>
              <span className="detail-value" style={{ color: order.status === 'paid' ? '#4ade80' : '#facc15' }}>
                {order.status === 'paid' ? '已支付' : '待支付'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">教学指引</span>
              <a className="tutorial-link" href={order.tutorialUrl} target="_blank" rel="noreferrer">
                查看使用教程
              </a>
            </div>
            <div className="notice-box">
              支付完成后，可通过右上角「订单查询」入口，使用邮箱 {email || 'you@example.com'} 重新获取二维码与使用教程。
            </div>
            <div className="notice-box notice-box--link">
              <Link href="/orders">前往订单查询页面</Link>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
