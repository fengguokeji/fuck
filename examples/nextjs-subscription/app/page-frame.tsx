'use client';

import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

type PageFrameProps = {
  children: ReactNode;
};

export function PageFrame({ children }: PageFrameProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function updateScale() {
      const content = contentRef.current;
      if (!content) {
        return;
      }

      const viewportWidth = window.innerWidth - 32;
      const viewportHeight = window.innerHeight - 32;
      const contentWidth = content.scrollWidth;
      const contentHeight = content.scrollHeight;

      if (contentWidth === 0 || contentHeight === 0) {
        setScale(1);
        return;
      }

      const widthScale = viewportWidth / contentWidth;
      const heightScale = viewportHeight / contentHeight;
      const nextScale = Math.min(1, widthScale, heightScale);
      const normalized = Number.isFinite(nextScale) && nextScale > 0 ? Number(nextScale.toFixed(3)) : 1;

      setScale(normalized);
    }

    const resizeHandler = () => updateScale();
    updateScale();
    window.addEventListener('resize', resizeHandler);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && contentRef.current) {
      observer = new ResizeObserver(updateScale);
      observer.observe(contentRef.current);
    }

    return () => {
      window.removeEventListener('resize', resizeHandler);
      observer?.disconnect();
    };
  }, []);

  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com';

  return (
    <div className="viewport-shell">
      <div className="viewport-scale">
        <div className="viewport-scale-inner" style={{ transform: `scale(${scale})` }}>
          <div ref={contentRef} className="app-container">
            <main className="page-content">{children}</main>
            <footer className="page-footer">
              构建于 alipay-sdk 示例项目。如需支持，请联系{' '}
              <a className="footer-link" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              。
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
