import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrder } from '../../../lib/orders';

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

  const isPaid = order.status === 'paid';

  return (
    <section className="section-card order-detail-card">
      <div className="section-header">
        <div className="section-header-text">
          <h2>订单详情</h2>
        </div>
        <div className="order-detail-actions">
          <Link href="/" className="secondary-button">
            返回套餐列表
          </Link>
          <a
            className="primary-button tutorial-cta-button"
            href={order.tutorialUrl}
            target="_blank"
            rel="noreferrer"
          >
            点击查看教程
          </a>
        </div>
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
        </div>
      </div>
    </section>
  );
}
