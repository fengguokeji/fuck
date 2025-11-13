import Link from 'next/link';
import { plans } from '../lib/plans';

export default function HomePage() {
  return (
    <>
      <section className="hero-card">
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
          {plans.map((tier) => (
            <Link key={tier.id} href={`/checkout/${tier.id}`} className="plan-link" aria-label={`选择${tier.name}套餐`}>
              <div className="plan-card">
                {tier.highlight && <span className="plan-badge">{tier.highlight}</span>}
                <div className="plan-title">
                  <span className="plan-name">{tier.name}</span>
                  <span className="plan-price">¥{tier.price}</span>
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
            </Link>
          ))}
        </div>

        <section className="section-card info-card">
          <div className="section-header">
            <div className="section-header-text">
              <h2>如何下单</h2>
              <p>
                点击上方任意套餐即可跳转至下单页面。在新的页面中，您可以确认套餐详情并填写联系邮箱来生成支付宝扫码支付订单。
              </p>
            </div>
            <div className="section-summary">
              <strong>填写邮箱即可生成二维码</strong>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
