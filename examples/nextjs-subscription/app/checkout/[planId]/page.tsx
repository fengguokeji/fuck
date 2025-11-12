import Link from 'next/link';
import { notFound } from 'next/navigation';
import CheckoutForm from '../CheckoutForm';
import { findPlan } from '../../../lib/plans';

type CheckoutPageProps = {
  params: {
    planId: string;
  };
};

export default function CheckoutPage({ params }: CheckoutPageProps) {
  const plan = findPlan(params.planId);

  if (!plan) {
    notFound();
  }

  return (
    <section className="section-card checkout-card">
      <div className="checkout-header">
        <div className="section-header-text">
          <h1>确认套餐并完成下单</h1>
          <p>
            在此页面您可以查看套餐具体包含的权益，填写联系邮箱并生成支付宝二维码。支付完成后订单会自动同步状态。
          </p>
        </div>
        <Link href="/" className="secondary-button">
          返回套餐列表
        </Link>
      </div>

      <div className="checkout-layout">
        <div className="checkout-mobile-summary">
          <span className="checkout-mobile-summary__chip">当前套餐</span>
          <div className="checkout-mobile-summary__heading">
            <h2>{plan.name}</h2>
            <p>
              <strong>¥{plan.price}</strong>
              <span>/{plan.billingCycle}</span>
            </p>
          </div>
          <p className="checkout-mobile-summary__description">{plan.description}</p>
          <ul className="checkout-mobile-summary__features">
            {plan.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <p className="checkout-mobile-summary__hint">
            支持使用同一联系邮箱多次下单，历史订单与二维码可在订单查询页面随时查看。
          </p>
        </div>
        <div className="checkout-plan">
          <div className="plan-card checkout-plan-card">
            {plan.highlight && <span className="plan-badge">{plan.highlight}</span>}
            <div className="plan-title">
              <span className="plan-name">{plan.name}</span>
              <span className="plan-price">
                ¥{plan.price}
                <span>/{plan.billingCycle}</span>
              </span>
            </div>
            <p className="plan-description">{plan.description}</p>
            <ul className="plan-feature-list">
              {plan.features.map((feature) => (
                <li key={feature} className="plan-feature">
                  {feature}
                </li>
              ))}
            </ul>
            <a className="checkout-plan-tutorial" href={plan.tutorialUrl} target="_blank" rel="noreferrer">
              查看使用教程
            </a>
          </div>
          <div className="checkout-plan-hint">
            支持使用同一联系邮箱多次下单，我们会自动保留历史订单，您可在订单查询页面随时查阅二维码与教学链接。
          </div>
        </div>
        <CheckoutForm plan={plan} />
      </div>
    </section>
  );
}
