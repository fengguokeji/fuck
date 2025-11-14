import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrder } from '../../../lib/orders';
import { findPlan } from '../../../lib/plans';

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
  }).format(date);
}

type OrderDetailPageProps = {
  params: {
    orderId: string;
  };
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const order = await getOrder(params.orderId);

  if (!order) {
    notFound();
  }

  const plan = findPlan(order.planId);
  const isPaid = order.status === 'paid';
  const amountLabel = order.currency === 'CNY' ? `¥${order.amount}` : `${order.amount} ${order.currency}`;

  return (
    <section className="section-card order-detail-card">
      <div className="section-header">
        <div className="section-header-text">
          <h2>订单详情</h2>
          <p>
            订单编号 {order.id} 已记录在系统中，所有信息也会发送至 {order.email}，您可以在此页面重新获取二维码与教学指引。
          </p>
        </div>
        <div className="order-detail-actions">
          <Link href="/orders" className="secondary-button">
            返回订单查询
          </Link>
          <Link href="/" className="secondary-button">
            返回套餐列表
          </Link>
        </div>
      </div>

      <div className="order-details order-detail-meta">
        <div className="detail-item">
          <span className="detail-label">当前套餐</span>
          <span className="detail-value">{plan?.name ?? order.planId}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">下单邮箱</span>
          <span className="detail-value">{order.email}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">订单金额</span>
          <span className="detail-value">{amountLabel}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">下单时间</span>
          <span className="detail-value">{formatDateTime(order.createdAt)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">订单状态</span>
          <span className="detail-value" style={{ color: isPaid ? '#16a34a' : '#f59e0b' }}>
            {isPaid ? '已支付' : '待支付'}
          </span>
        </div>
        {order.tradeNo && (
          <div className="detail-item">
            <span className="detail-label">支付流水号</span>
            <span className="detail-value">{order.tradeNo}</span>
          </div>
        )}
      </div>

      <div className="payment-panel">
        <div className="qr-box">
          <span className="qr-label">{isPaid ? '支付完成' : '扫码支付'}</span>
          {order.qrCode ? (
            <img src={order.qrCode} alt={`订单 ${order.id} 的支付二维码`} className="qr-image" />
          ) : (
            <div className="qr-missing">暂未生成二维码，请稍后刷新页面。</div>
          )}
          <p className="qr-tip">
            {isPaid
              ? '订单已同步为已支付，您可以直接根据教学链接完成配置。'
              : '打开支付宝扫描二维码完成支付，系统会在成功后自动刷新订单状态。'}
          </p>
        </div>
        <div className="order-details">
          <div className="detail-item">
            <span className="detail-label">订单编号</span>
            <span className="detail-value">{order.id}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">教学指引</span>
            <a className="tutorial-link" href={order.tutorialUrl} target="_blank" rel="noreferrer">
              查看使用教程
            </a>
          </div>
          <div className="notice-box">
            支付完成后，如需再次获取二维码或教学链接，可返回订单查询页面并输入邮箱 {order.email} 进行检索。
          </div>
          <div className="notice-box notice-box--link">
            <Link href="/orders">前往订单查询页面</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
