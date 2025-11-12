import Link from 'next/link';
import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME ?? '智能助理订阅中心',
  description:
    '基于支付宝支付的订阅演示：创建二维码收款、异步回调更新状态，并支持邮箱检索历史订单。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? '智能助理订阅中心';

  return (
    <html lang="zh-CN">
      <body className="app-body">
        <div className="app-container">
          <header className="site-header">
            <Link href="/" className="site-logo">
              {siteName}
            </Link>
          </header>
          <section className="hero-card">
            <span className="hero-chip">极速部署 · 无需运维</span>
            <h1 className="hero-title">解锁您的专属订阅服务</h1>
            <p className="hero-subtitle">
              通过支付宝扫码即可完成支付，支付成功后自动开通权限。支持邮箱自助查询历史订单与教学链接，适配
              Vercel Serverless 环境。
            </p>
            <nav className="site-actions">
              <Link className="nav-button" href="/orders">
                订单查询
              </Link>
              <a
                className="nav-button nav-button--ghost"
                href="https://tawk.to/chat/67078bc702d78d1a30ef65d0/1i9qnk1me"
                target="_blank"
                rel="noreferrer"
              >
                在线客服
              </a>
            </nav>
          </section>
          <main className="page-content">{children}</main>
          <footer className="page-footer">
            构建于 alipay-sdk 示例项目。如需支持，请联系{' '}
            <a className="footer-link" href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com'}`}>
              {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com'}
            </a>
            。
          </footer>
        </div>
      </body>
    </html>
  );
}
