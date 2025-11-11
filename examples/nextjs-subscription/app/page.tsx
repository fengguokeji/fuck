'use client';

import { useMemo, useState } from 'react';
import { plans } from '../lib/plans';

type CreateOrderResponse = {
  orderId: string;
  tradeNo: string;
  qrCode: string;
  status: string;
  gateway: 'alipay' | 'mock';
  tutorialUrl: string;
};

type OrderHistoryItem = {
  id: string;
  planId: string;
  amount: number;
  currency: string;
  status: string;
  tradeNo?: string;
  qrCode?: string;
  tutorialUrl: string;
  createdAt: string;
  updatedAt: string;
};

type HistoryResponse = {
  orders: OrderHistoryItem[];
};

export default function HomePage() {
  const [selectedPlan, setSelectedPlan] = useState(plans[0].id);
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<CreateOrderResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyEmail, setHistoryEmail] = useState('');
  const [history, setHistory] = useState<OrderHistoryItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const plan = useMemo(() => plans.find((p) => p.id === selectedPlan) ?? plans[0], [selectedPlan]);

  async function submitOrder() {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, planId: selectedPlan }),
      });
      const data = (await res.json()) as CreateOrderResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? '无法创建订单');
      }
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setCreating(false);
    }
  }

  async function queryHistory() {
    setHistoryLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/history?email=${encodeURIComponent(historyEmail)}`);
      const data = (await res.json()) as HistoryResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? '查询失败');
      }
      setHistory(data.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-12">
      <section className="grid gap-6 md:grid-cols-3">
        {plans.map((tier) => {
          const isActive = tier.id === selectedPlan;
          return (
            <button
              key={tier.id}
              onClick={() => setSelectedPlan(tier.id)}
              className={`flex flex-col gap-3 rounded-xl border p-6 text-left transition focus:outline-none focus:ring ${
                isActive ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-400' : 'border-slate-800 hover:border-blue-400'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold">{tier.name}</span>
                <span className="text-2xl font-bold text-blue-300">
                  ¥{tier.price}
                  <span className="text-xs font-medium text-slate-400">/月</span>
                </span>
              </div>
              <p className="text-sm text-slate-300">{tier.description}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-400">
                {tier.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 shadow-xl">
        <h2 className="text-xl font-semibold">立即订阅</h2>
        <p className="mt-2 text-sm text-slate-400">
          下单后将生成支付宝二维码，请使用支付宝扫码完成支付。
        </p>
        <div className="mt-6 flex flex-col gap-4 md:flex-row">
          <label className="flex flex-1 flex-col gap-2 text-sm">
            <span>联系邮箱</span>
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-blue-400"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button
            onClick={submitOrder}
            disabled={creating || !email}
            className="mt-2 inline-flex items-center justify-center rounded-md bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700 md:mt-auto"
          >
            {creating ? '创建中…' : `购买 ${plan.name}`}
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {order && (
          <div className="mt-8 grid gap-4 md:grid-cols-[280px,1fr] md:gap-10">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
              <span className="text-xs uppercase tracking-widest text-slate-500">扫描支付</span>
              <img src={order.qrCode} alt="Alipay QR" className="h-64 w-64 rounded-md bg-white p-2" />
              <p className="text-xs text-slate-400">
                {order.gateway === 'mock'
                  ? '当前处于模拟模式，二维码仅用于演示。订单会自动标记为已支付。'
                  : '使用支付宝扫描二维码完成支付，支付成功后系统将自动为您开通权限。'}
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-300">
              <div>
                <span className="text-xs uppercase text-slate-500">订单编号</span>
                <p className="font-mono text-base text-blue-200">{order.orderId}</p>
              </div>
              <div>
                <span className="text-xs uppercase text-slate-500">支付状态</span>
                <p className="font-medium text-emerald-300">{order.status === 'paid' ? '已支付' : '待支付'}</p>
              </div>
              <div>
                <span className="text-xs uppercase text-slate-500">使用教程</span>
                <p>
                  <a className="text-blue-300 underline" href={order.tutorialUrl} target="_blank" rel="noreferrer">
                    点击查看开通指引
                  </a>
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
                <p>
                  支付完成后，可使用邮箱 {email || 'you@example.com'} 在下方查询历史订单重新获取二维码与教程。
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 shadow-xl">
        <h2 className="text-xl font-semibold">邮箱查询历史订单</h2>
        <p className="mt-2 text-sm text-slate-400">
          输入邮箱即可查看最近的订单详情，并重新获取二维码和使用教程。
        </p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-blue-400"
            placeholder="you@example.com"
            value={historyEmail}
            onChange={(event) => setHistoryEmail(event.target.value)}
          />
          <button
            onClick={queryHistory}
            disabled={historyLoading || !historyEmail}
            className="inline-flex items-center justify-center rounded-md bg-slate-800 px-6 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {historyLoading ? '查询中…' : '查询订单'}
          </button>
        </div>

        {history && (
          <div className="mt-6 space-y-4">
            {history.length === 0 && <p className="text-sm text-slate-400">暂无订单记录。</p>}
            {history.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-blue-200">订单号：{item.id}</p>
                    <p className="text-xs text-slate-400">状态：{item.status === 'paid' ? '已支付' : '待支付'}</p>
                  </div>
                  {item.qrCode && (
                    <a
                      href={item.qrCode}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-blue-300 underline"
                    >
                      重新获取二维码
                    </a>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>套餐：{plans.find((p) => p.id === item.planId)?.name ?? item.planId}</span>
                  <span>
                    金额：¥{item.amount} {item.currency}
                  </span>
                  <a className="text-blue-300 underline" href={item.tutorialUrl} target="_blank" rel="noreferrer">
                    查看使用教程
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
