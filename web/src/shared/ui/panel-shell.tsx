'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, LogOut, Menu, X } from 'lucide-react';
import { signOut } from '@/shared/lib/sign-out';
import { cn } from '@/shared/lib/cn';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { usePartnerStore } from '@/shared/store/partner-store';
import { t, type MessageKey } from '@/shared/i18n';

/**
 * WebSocket client listener to handle real-time notifications (such as application rejection)
 * using an acknowledgement protocol.
 */
function WebSocketListener({ token }: { token: string }) {
  const wsRef = useRef<WebSocket | null>(null);
  const setSocketConnected = usePartnerStore((state) => state.setSocketConnected);
  const setApplicationState = usePartnerStore((state) => state.setApplicationState);
  const applicationStatus = usePartnerStore((state) => state.applicationStatus);
  const rejectionReason = usePartnerStore((state) => state.rejectionReason);

  useEffect(() => {
    if (applicationStatus === 'rejected') {
      window.alert(`Your application was rejected.\n\nReason: ${String(rejectionReason)}`);
      window.location.href = '/partner/login';
    }
  }, [applicationStatus, rejectionReason]);

  useEffect(() => {
    if (!token) return;

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1';
    const url = new URL(apiBase);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '';
    url.searchParams.set('token', token);

    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to BoxArena WebSocket server');
      setSocketConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'application.rejected') {
          console.log('[WS] Application rejected event received:', payload);
          
          // Send acknowledgement back to server (Request-Response WebSocket model)
          ws.send(JSON.stringify({
            type: 'ack',
            messageId: payload.messageId,
          }));

          // Notify state store (which triggers the UI notification effect)
          setApplicationState('rejected', payload.data.reason);
        }
      } catch (err) {
        console.error('[WS] Error processing message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] WebSocket connection closed');
      setSocketConnected(false);
    };

    ws.onerror = (err) => {
      console.error('[WS] WebSocket error:', err);
      setSocketConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [token, setSocketConnected, setApplicationState]);

  return null;
}

/**
 * The shell both operator panels sit in.
 *
 * A sidebar rather than a top strip because these are tools, not pages: the
 * nav is grouped by job (manage / money / account), stays visible while you
 * work, and has room to grow past the six items a horizontal bar tops out at
 * (design_system.md §4 — squared, dense, tool-like).
 *
 * Public site chrome is suppressed on these routes; an operator panel that
 * also shows "Sign in" and a marketing footer reads as a bolted-on page.
 */

export interface PanelNavItem {
  href: string;
  labelKey: MessageKey;
  /** Matched with startsWith. Set false for index routes like /admin. */
  prefixMatch?: boolean;
}

export interface PanelNavSection {
  headingKey: MessageKey;
  items: PanelNavItem[];
}

export interface PanelShellProps {
  titleKey: MessageKey;
  sections: PanelNavSection[];
  /** Who is signed in — name and role, resolved server-side. */
  account?: { name: string; role: string };
  token?: string;
  children: React.ReactNode;
}

export function PanelShell({ titleKey, sections, account, token, children }: PanelShellProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      {token ? <WebSocketListener token={token} /> : null}
      <MobileBar titleKey={titleKey} isOpen={isOpen} onToggle={() => setIsOpen((v) => !v)} />

      <Sidebar
        titleKey={titleKey}
        sections={sections}
        {...(account ? { account } : {})}
        isOpen={isOpen}
        onNavigate={() => setIsOpen(false)}
      />

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function MobileBar({
  titleKey,
  isOpen,
  onToggle,
}: {
  titleKey: MessageKey;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-line-subtle bg-surface flex items-center gap-3 border-b px-4 py-3 lg:hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? t('panel.closeNav') : t('panel.openNav')}
        className="text-ink-secondary hover:text-ink -ml-2 flex size-11 items-center justify-center"
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      <Logo className="text-base" />
      <span className="label-caps text-ink-muted">{t(titleKey)}</span>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </div>
  );
}

function Sidebar({
  titleKey,
  sections,
  account,
  isOpen,
  onNavigate,
}: {
  titleKey: MessageKey;
  sections: PanelNavSection[];
  account?: { name: string; role: string };
  isOpen: boolean;
  onNavigate: () => void;
}) {
  return (
    <aside
      className={cn(
        'border-line-subtle bg-surface w-full shrink-0 flex-col border-r lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64',
        isOpen ? 'flex' : 'hidden',
      )}
    >
      <div className="border-line-subtle hidden items-center gap-3 border-b px-5 py-4 lg:flex">
        <Logo className="text-base" />
        <span className="label-caps text-ink-muted">{t(titleKey)}</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <NavSection key={section.headingKey} section={section} onNavigate={onNavigate} />
        ))}
      </nav>

      <AccountBlock {...(account ? { account } : {})} />
    </aside>
  );
}

function NavSection({
  section,
  onNavigate,
}: {
  section: PanelNavSection;
  onNavigate: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="mb-5">
      <p className="label-caps text-ink-muted px-3 pb-2">{t(section.headingKey)}</p>
      <ul className="space-y-0.5">
        {section.items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive(pathname, item) ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center rounded-chip px-3 py-2 text-sm transition-colors duration-150',
                isActive(pathname, item)
                  ? 'bg-inset text-ink font-medium'
                  : 'text-ink-secondary hover:bg-elevated hover:text-ink',
              )}
            >
              {t(item.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function isActive(pathname: string, item: PanelNavItem): boolean {
  if (item.prefixMatch === false) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function AccountBlock({ account }: { account?: { name: string; role: string } }) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut();
    if (pathname.startsWith('/admin')) {
      window.location.href = '/admin/login';
    } else if (pathname.startsWith('/partner')) {
      window.location.href = '/partner/login';
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="border-line-subtle border-t px-5 py-4">
      {account ? (
        <div className="mb-3">
          <p className="label-caps text-ink-muted">{t('panel.signedInAs')}</p>
          <p className="text-ink mt-1 truncate text-sm font-medium">{account.name}</p>
          <p className="text-ink-muted text-xs capitalize">{account.role.replace(/_/gu, ' ')}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleSignOut}
          className="text-ink-secondary hover:text-ink flex items-center gap-1.5 text-xs font-normal cursor-pointer"
        >
          <LogOut className="size-3.5" />
          {t('panel.signOut')}
        </button>

        <Link
          href="/"
          className="text-ink-secondary hover:text-ink flex items-center gap-1.5 text-xs"
        >
          <ChevronLeft className="size-3.5" />
          {t('panel.backToSite')}
        </Link>
      </div>
    </div>
  );
}
