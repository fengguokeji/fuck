'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { plans } from '../lib/plans';

type CreateOrderResponse = {
  orderId: string;
  tradeNo: string;
  qrCode: string;
  status: string;
  gateway: 'alipay' | 'mock';
  tutorialUrl: string;
};

export default function HomePage() {
  const [selectedPlan, setSelectedPlan] = useState(plans[0].id);
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<CreateOrderResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(() => plans.find((p) => p.id === selectedPlan) ?? plans[0], [selectedPlan]);

  async function submitOrder() {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, planId: selectedPlan }),
      });
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
    <>
      <section className="hero-card">
        <span className="hero-chip">极速部署 · 无需运维</span>
        <h1 className="hero-title">解锁您的专属订阅服务</h1>
        <p className="hero-subtitle">
          通过支付宝扫码即可完成支付，支付成功后自动开通权限。支持邮箱自助查询历史订单与教学链接，适配 Vercel
          Serverless 环境。
        </p>
        <nav className="site-actions">
          <Link className="nav-button" href="/orders">
            订单查询
          </Link>
          <a
            className="nav-button nav-button--ghost"
            href="https://tawk.to/chat/67078bc702d78d1a30ef65d0/1i9qnk1me"
            target="_blank"
            rel="noreferrer"
          >
            在线客服
          </a>
        </nav>
      </section>
      <div className="plan-section">
        <div className="plan-grid">
          {plans.map((tier) => {
            const isActive = tier.id === selectedPlan;
            return (
              <button
                key={tier.id}
                onClick={() => setSelectedPlan(tier.id)}
                className="plan-button"
                aria-pressed={isActive}
              >
                <div className={`plan-card${isActive ? ' plan-card--active' : ''}`}>
                  {tier.highlight && <span className="plan-badge">{tier.highlight}</span>}
                  <div className="plan-title">
                    <span className="plan-name">{tier.name}</span>
                    <span className="plan-price">
                      ¥{tier.price}
                      <span>/{tier.billingCycle}</span>
                    </span>
                  </div>
                  <p className="plan-description">{tier.description}</p>
                  <ul className="plan-feature-list">
                    {tier.features.map((feature) => (
                      <li key={feature} className="plan-feature">
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            );
          })}
        </div>

        <section className="section-card">
          <div className="section-header">
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
              />
            </div>
            <button onClick={submitOrder} disabled={creating || !email} className="primary-button">
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
        </section>
      </div>
    </>
  );
}
