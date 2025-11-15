import { randomUUID } from 'crypto';
import { findPlan } from './plans';
import { getPlanQrPayload } from './server/plan-secrets';
import type { OrderRecord, OrderStatus } from './db';
import { saveOrder, updateOrder, findOrdersByEmail, findOrderById } from './db';
import { createPreOrder, isMockMode } from './alipay';
import { buildQrImageUrl } from './qr';

export type CreateOrderInput = {
  email: string;
  planId: string;
};

export type CreateOrderResponse = {
  order: OrderRecord;
  tradeNo: string;
  qrCode: string;
  qrImage: string;
  gateway: 'alipay' | 'mock';
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

  const qrContentOverride = isMockMode() ? getPlanQrPayload(plan.id) : undefined;
  const resolvedQrContent = qrContentOverride ?? preOrder.qrCode;
  const qrImage = resolvedQrContent ? buildQrImageUrl(resolvedQrContent) : '';

  order.tradeNo = preOrder.tradeNo;
  order.qrCode = resolvedQrContent;
  order.gatewayPayload = preOrder.payload;

  if (isMockMode()) {
    order.status = 'paid';
  }

  await saveOrder(order);

  return {
    order,
    tradeNo: preOrder.tradeNo,
    qrCode: order.qrCode!,
    qrImage,
    gateway: preOrder.gateway,
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
