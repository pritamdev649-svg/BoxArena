'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Menu, X, LogOut, LayoutDashboard } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { isPanelRoute } from '@/shared/lib/panel-routes';
import { signOut } from '@/shared/lib/sign-out';
import { Button } from './button';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { Badge, type BadgeTone } from './badge';
import { t } from '@/shared/i18n';

const NAV = [
  { href: '/arenas', labelKey: 'nav.arenas' },
  { href: '/challenges', labelKey: 'nav.challenges' },
  { href: '/leaderboard', labelKey: 'nav.leaderboard' },
  { href: '/partner', labelKey: 'nav.partner' },
] as const;

interface UserMe {
  fullName: string;
  phoneNumber: string;
  role: string;
  avatarUrl?: string;
}

export function SiteHeader({ user }: { user: UserMe | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  /** Panels bring their own shell (see PanelShell). */
  if (isPanelRoute(pathname)) return null;

  return (
    <header className="border-line-subtle bg-canvas/90 sticky top-0 z-50 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-8 px-6">
        <Link href="/" className="shrink-0" aria-label={t('common.homeLink')}>
          <Logo />
        </Link>

        <DesktopNav />

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {user ? (
            <ProfileDropdown user={user} />
          ) : (
            <Button size="sm" variant="secondary" asChild>
              <Link href="/login">{t('common.signIn')}</Link>
            </Button>
          )}
        </div>

        <MenuToggle isOpen={isOpen} onToggle={() => setIsOpen((open) => !open)} />
      </div>

      {isOpen ? <MobileNav user={user} onNavigate={() => setIsOpen(false)} /> : null}
    </header>
  );
}

function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden flex-1 items-center gap-6 md:flex">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'text-sm transition-colors duration-150',
            pathname.startsWith(item.href)
              ? 'text-ink font-medium'
              : 'text-ink-secondary hover:text-ink',
          )}
        >
          {t(item.labelKey)}
        </Link>
      ))}
    </nav>
  );
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) {
    return first.slice(0, 2).toUpperCase();
  }
  const last = parts[parts.length - 1];
  const firstChar = first[0] ?? '';
  const lastChar = last ? (last[0] ?? '') : '';
  return (firstChar + lastChar).toUpperCase();
}


const ROLE_TONE: Record<string, BadgeTone> = {
  admin: 'loss',
  super_admin: 'loss',
  arena_owner: 'warning',
};

function roleTone(role: string): BadgeTone {
  return ROLE_TONE[role] ?? 'win';
}

/** The panel a role belongs to, or null for a plain player. */
function panelLinkFor(role: string): { href: string; label: string } | null {
  if (role === 'arena_owner' || role === 'arena_staff') {
    return { href: '/partner/dashboard', label: t('panel.partnerTitle') };
  }
  if (role === 'admin' || role === 'super_admin') {
    return { href: '/admin', label: t('panel.adminTitle') };
  }
  return null;
}

async function handleSignOut(): Promise<void> {
  await signOut();
  /** Full reload, not router.push — every server component holds stale session data. */
  window.location.href = '/';
}

function ProfileDropdown({ user }: { user: UserMe }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-elevated border-line hover:border-line-strong text-volt-ink font-display flex size-9 cursor-pointer items-center justify-center rounded-full border text-sm transition-colors duration-150 select-none"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {getInitials(user.fullName)}
      </button>

      {isOpen ? (
        <div className="border-line-subtle bg-surface rounded-control absolute top-12 right-0 z-50 w-64 border p-4 shadow-xl">
          <ProfileIdentity user={user} />
          <ProfileActions user={user} />
        </div>
      ) : null}
    </div>
  );
}

function ProfileIdentity({ user }: { user: UserMe }) {
  return (
    <div className="border-line-subtle flex flex-col gap-1 border-b pb-3">
      <div className="flex items-center gap-2">
        <span className="text-ink font-display max-w-[150px] truncate text-sm font-medium">
          {user.fullName}
        </span>
        <Badge tone={roleTone(user.role)}>{user.role.replace(/_/gu, ' ')}</Badge>
      </div>
      <span className="text-ink-secondary tabular text-xs">{user.phoneNumber}</span>
    </div>
  );
}

function ProfileActions({ user }: { user: UserMe }) {
  const panel = panelLinkFor(user.role);

  return (
    <div className="flex flex-col gap-1 pt-2">
      {panel ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs font-normal"
          asChild
        >
          <Link href={panel.href}>
            <LayoutDashboard className="mr-2 size-3.5" />
            {panel.label}
          </Link>
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="text-loss hover:bg-loss/10 w-full justify-start text-xs font-normal"
      >
        <LogOut className="mr-2 size-3.5" />
        {t('panel.signOut')}
      </Button>
    </div>
  );
}

function MobileNav({ user, onNavigate }: { user: UserMe | null; onNavigate: () => void }) {
  return (
    <nav className="border-line-subtle divide-line-subtle divide-y border-t md:hidden">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className="text-ink-secondary hover:text-ink block px-6 py-4 text-sm"
        >
          {t(item.labelKey)}
        </Link>
      ))}

      {user ? (
        <MobileAccount user={user} onNavigate={onNavigate} />
      ) : (
        <Link
          href="/login"
          onClick={onNavigate}
          className="text-volt-ink block px-6 py-4 text-sm font-medium"
        >
          {t('common.signIn')}
        </Link>
      )}
    </nav>
  );
}

function MobileAccount({ user, onNavigate }: { user: UserMe; onNavigate: () => void }) {
  const panel = panelLinkFor(user.role);

  return (
    <div className="space-y-4 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="bg-elevated border-line text-volt-ink font-display flex size-10 items-center justify-center rounded-full border text-sm">
          {getInitials(user.fullName)}
        </div>
        <div>
          <p className="text-ink text-sm font-medium">{user.fullName}</p>
          <p className="text-ink-secondary tabular text-xs">{user.phoneNumber}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {panel ? (
          <Button
            size="sm"
            variant="secondary"
            className="w-full justify-start text-xs font-normal"
            asChild
          >
            <Link href={panel.href} onClick={onNavigate}>
              <LayoutDashboard className="mr-2 size-3.5" />
              {panel.label}
            </Link>
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          onClick={handleSignOut}
          className="text-loss hover:bg-loss/10 w-full justify-start text-xs font-normal"
        >
          <LogOut className="mr-2 size-3.5" />
          {t('panel.signOut')}
        </Button>
      </div>
    </div>
  );
}

/** 44px target — the accessibility floor for touch (design_system.md §9). */
function MenuToggle({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-ink-secondary hover:text-ink ml-auto flex size-11 items-center justify-center md:hidden"
      aria-label={isOpen ? t('common.closeMenu') : t('common.openMenu')}
      aria-expanded={isOpen}
    >
      {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
    </button>
  );
}

