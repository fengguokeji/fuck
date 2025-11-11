import { NextResponse } from 'next/server';
import { getOrders } from '../../../../lib/orders';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: '缺少邮箱参数' }, { status: 400 });
  }

  const orders = await getOrders(email.toLowerCase());

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      planId: order.planId,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      tradeNo: order.tradeNo,
      qrCode: order.qrCode,
      tutorialUrl: order.tutorialUrl,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    })),
  });
}
