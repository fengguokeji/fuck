import { randomUUID } from 'crypto';
import { findPlan } from './plans';
import type { OrderRecord, OrderStatus } from './db';
import { saveOrder, updateOrder, findOrdersByEmail, findOrderById } from './db';
import { createPreOrder } from './alipay';
import { buildQrImage } from './qr';

export type CreateOrderInput = {
  email: string;
  planId: string;
};

export type CreateOrderResponse = {
  order: OrderRecord;
  tradeNo: string;
  qrCode: string;
  qrImage: string;
};

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResponse> {
  const plan = findPlan(input.planId);
  if (!plan) {
    throw new Error('Unknown plan');
  }

  const now = new Date();
  const order: OrderRecord = {
    id: randomUUID().replace(/-/g, ''),
    email: input.email.toLowerCase(),
    planId: input.planId,
    amount: plan.price,
    currency: plan.currency,
    tutorialUrl: plan.tutorialUrl,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  const preOrder = await createPreOrder(order);
  const qrImage = await buildQrImage(preOrder.qrCode);

  order.tradeNo = preOrder.tradeNo;
  order.qrCode = preOrder.qrCode;
  order.gatewayPayload = preOrder.payload;

  await saveOrder(order);

  return {
    order,
    tradeNo: preOrder.tradeNo,
    qrCode: order.qrCode!,
    qrImage,
  };
}

export async function markOrderStatus(
  orderId: string,
  status: OrderStatus,
  options: {
    gatewayPayload?: Record<string, unknown>;
    tradeNo?: string;
    qrCode?: string;
  } = {}
) {
  return updateOrder(orderId, {
    status,
    gatewayPayload: options.gatewayPayload,
    tradeNo: options.tradeNo,
    qrCode: options.qrCode,
    updatedAt: new Date(),
  });
}

export async function getOrders(email: string) {
  return findOrdersByEmail(email);
}

export async function getOrder(orderId: string) {
  return findOrderById(orderId);
}
