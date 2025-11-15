import { NextResponse } from 'next/server';
import { createOrder } from '../../../lib/orders';
import { findPlan } from '../../../lib/plans';
import { GatewayError } from '../../../lib/alipay';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, planId } = body ?? {};

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: '请输入有效的邮箱地址' }, { status: 400 });
    }

    if (typeof planId !== 'string' || !findPlan(planId)) {
      return NextResponse.json({ error: '请选择有效的套餐' }, { status: 400 });
    }

    const result = await createOrder({ email, planId });

    return NextResponse.json({
      orderId: result.order.id,
      tradeNo: result.tradeNo,
      qrCode: result.qrCode,
      status: result.order.status,
      gateway: result.gateway,
      tutorialUrl: result.order.tutorialUrl,
    });
  } catch (error) {
    console.error('[orders:create]', error);
    const message = error instanceof Error ? error.message : '创建订单时出现异常，请稍后再试。';
    const debugLog = error instanceof GatewayError && error.debugLog ? error.debugLog : undefined;
    return NextResponse.json({ error: message, debugLog }, { status: 500 });
  }
}
