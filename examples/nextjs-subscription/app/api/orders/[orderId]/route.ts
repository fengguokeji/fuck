import { NextResponse } from 'next/server';
import { getOrder, getStoredPaymentUrl } from '../../../../lib/orders';
import { buildQrImageUrl } from '../../../../lib/qr';

export const runtime = 'nodejs';

type RouteContext = {
  params: {
    orderId: string;
  };
};

export async function GET(request: Request, context: RouteContext) {
  const emailParam = new URL(request.url).searchParams.get('email');
  if (!emailParam) {
    return NextResponse.json({ error: '缺少邮箱信息' }, { status: 400 });
  }

  const order = await getOrder(context.params.orderId);
  if (!order || order.email !== emailParam.toLowerCase()) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    status: order.status,
    qrCode: order.qrCode ?? null,
    qrImage: order.qrCode ? buildQrImageUrl(order.qrCode) : null,
    paymentUrl: getStoredPaymentUrl(order),
    tutorialUrl: order.tutorialUrl,
    tradeNo: order.tradeNo ?? null,
    updatedAt: order.updatedAt.toISOString(),
  });
}
