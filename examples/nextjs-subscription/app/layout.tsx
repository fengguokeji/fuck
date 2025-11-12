import './globals.css';
import type { ReactNode } from 'react';
import { PageFrame } from './page-frame';

export const metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME ?? '智能助理订阅中心',
  description:
    '基于支付宝支付的订阅演示：创建二维码收款、异步回调更新状态，并支持邮箱检索历史订单。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="app-body">
        <PageFrame>{children}</PageFrame>
      </body>
    </html>
  );
}
