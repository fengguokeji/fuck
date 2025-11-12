'use client';

import { useMemo, useState } from 'react';
import { plans } from '../../lib/plans';

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

function formatDateTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
}

export default function OrdersPage() {
  const [email, setEmail] = useState('');
  const [history, setHistory] = useState<OrderHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planMap = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), []);

  async function queryHistory() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/history?email=${encodeURIComponent(email)}`);
      const data = (await res.json()) as HistoryResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? '查询失败');
      }
      setHistory(data.orders);
    } catch (err) {
      setHistory(null);
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || loading) {
      return;
    }
    void queryHistory();
  }

  return (
    <div className="plan-section">
      <section className="section-card">
        <div className="section-header">
          <div className="section-header-text">
            <h2>订单查询中心</h2>
            <p>输入下单邮箱后，将展示全部历史订单，可直接重新获取二维码与教学链接。</p>
          </div>
        </div>

        <form className="form-row" onSubmit={handleSubmit}>
          <div className="input-field">
            <label htmlFor="orders-email">查询邮箱</label>
            <input
              id="orders-email"
              className="input-control"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
            />
          </div>
          <button type="submit" disabled={loading || !email} className="secondary-button">
            {loading ? '查询中…' : '查询订单'}
          </button>
        </form>

        {error && <div className="alert-error">{error}</div>}

        {history && (
          <div className="history-list">
            {history.length === 0 && <p>暂无订单记录。</p>}
            {history.map((item) => {
              const planMeta = planMap.get(item.planId);
              return (
                <div key={item.id} className="history-item">
                  <div className="history-item-header">
                    <div>
                      <div className="history-title">订单号：{item.id}</div>
                      <div className="history-meta">
                        <span>状态：{item.status === 'paid' ? '已支付' : '待支付'}</span>
                        {item.tradeNo && <span>流水号：{item.tradeNo}</span>}
                        <span>下单时间：{formatDateTime(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="history-item-body">
                    <div className="history-qr-box">
                      {item.qrCode ? (
                        <>
                          <img src={item.qrCode} alt={`订单 ${item.id} 的二维码`} />
                          <span>扫码支付或重新获取链接</span>
                        </>
                      ) : (
                        <span>暂无二维码信息</span>
                      )}
                    </div>
                    <div className="history-info">
                      <strong>{planMeta?.name ?? item.planId}</strong>
                      <span>
                        金额：¥{item.amount}
                      </span>
                      <a className="history-link" href={item.tutorialUrl} target="_blank" rel="noreferrer">
                        查看使用教程
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
