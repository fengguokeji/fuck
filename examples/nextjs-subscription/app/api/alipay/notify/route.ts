import { NextResponse } from 'next/server';
import { getNotifyVerifier } from '../../../../lib/alipay';
import { markOrderStatus, getOrder } from '../../../../lib/orders';

export const runtime = 'nodejs';

function parseForm(body: string) {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

export async function POST(request: Request) {
  const body = await request.text();
  const payload = parseForm(body);

  const verifier = getNotifyVerifier();
  const verified = verifier.verify(payload);

  if (!verified) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const outTradeNo = payload.out_trade_no;
  const tradeStatus = payload.trade_status;

  if (!outTradeNo) {
    return NextResponse.json({ error: 'missing out_trade_no' }, { status: 400 });
  }

  const order = await getOrder(outTradeNo);
  if (!order) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 });
  }

  if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
    await markOrderStatus(order.id, 'paid', {
      gatewayPayload: payload,
      tradeNo: payload.trade_no ?? order.tradeNo,
    });
  }

  return new NextResponse('success');
}
