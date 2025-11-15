import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

import type { OrderStatus } from '../../../lib/db';

type OrderDetailPageProps = {
  params: {
    orderId: string;
  };
  searchParams?: {
    email?: string;
  };
};

type OrderStatusResponse = {
  id: string;
  status: OrderStatus;
  qrCode: string | null;
  qrImage: string | null;
  tradeNo: string | null;
  tutorialUrl: string;
  updatedAt: string;
};

async function fetchOrderDetail(orderId: string, email: string): Promise<OrderStatusResponse | null> {
  if (!email) {
    return null;
  }

  const headerList = headers();
  const forwardedHost = headerList.get('x-forwarded-host');
  const host = forwardedHost ?? headerList.get('host');
  if (!host) {
    return null;
  }
  const forwardedProto = headerList.get('x-forwarded-proto');
  const protocol = forwardedProto ?? (host.includes('localhost') ? 'http' : 'https');
  const apiUrl = `${protocol}://${host}/api/orders/${orderId}?email=${encodeURIComponent(email)}`;

  const response = await fetch(apiUrl, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as OrderStatusResponse;
}

export default async function OrderDetailPage({ params, searchParams }: OrderDetailPageProps) {
  const email = searchParams?.email ?? '';
  const order = await fetchOrderDetail(params.orderId, email);

  if (!order) {
    notFound();
  }

  const isPaid = order.status === 'paid';

  return (
    <section className="section-card order-detail-card">
      <div className="section-header">
        <div className="section-header-text">
          <h2>订单详情</h2>
          <p className="section-subtitle">下单邮箱：{email || '（未提供）'}</p>
        </div>
        <div className="order-detail-actions">
          <Link href="/" className="secondary-button">
            返回套餐列表
          </Link>
          <a className="primary-button tutorial-cta-button" href={order.tutorialUrl} target="_blank" rel="noreferrer">
            点击查看教程
          </a>
        </div>
      </div>

      <div className="payment-panel">
        <div className="qr-box">
          <span className="qr-label">{isPaid ? '支付完成' : '扫码支付'}</span>
          {order.qrImage ? (
            <img src={order.qrImage} alt={`订单 ${order.id} 的支付二维码`} className="qr-image" />
          ) : (
            <div className="qr-missing">暂未生成二维码，请稍后刷新页面。</div>
          )}
          <p className="qr-tip">
            {isPaid
              ? '订单已同步为已支付，您可以直接根据教学链接完成配置。'
              : '打开支付宝扫描二维码完成支付，系统会在成功后自动刷新订单状态。'}
          </p>
        </div>
        <dl className="order-metadata">
          <div>
            <dt>订单号</dt>
            <dd>{order.id}</dd>
          </div>
          <div>
            <dt>支付宝交易号</dt>
            <dd>{order.tradeNo ?? '—'}</dd>
          </div>
          <div>
            <dt>最后同步时间</dt>
            <dd>{new Date(order.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
