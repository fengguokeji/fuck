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
  const router = useRouter();

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) {
      return;
    }
    setError(null);
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
      const detailUrl = `/orders/${data.orderId}?email=${encodeURIComponent(normalizedEmail)}`;
      router.push(detailUrl);
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

    </form>
  );
}
