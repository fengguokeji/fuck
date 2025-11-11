import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME ?? 'AI Copilot Store',
  description:
    'Subscription checkout demo that creates Alipay QR code payments and supports email-based order lookup.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
          <header className="flex flex-col gap-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {process.env.NEXT_PUBLIC_SITE_NAME ?? 'AI Copilot Store'}
            </h1>
            <p className="text-sm text-slate-300">
              Pay with Alipay, receive instant onboarding, and revisit orders using your email address.
            </p>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-800 pt-8 text-center text-xs text-slate-500">
            Built for the alipay-sdk repository demo. Need help? Contact{' '}
            <a className="underline" href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com'}`}>
              {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com'}
            </a>
            .
          </footer>
        </div>
      </body>
    </html>
  );
}
