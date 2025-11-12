import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME ?? '智能助理订阅中心',
  description:
    '基于支付宝支付的订阅演示：创建二维码收款、异步回调更新状态，并支持邮箱检索历史订单。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="app-body">
        <div className="app-container">
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
