import type { Metadata, Viewport } from 'next';
import { Archivo, Inter } from 'next/font/google';
import { SiteHeader } from '@/shared/ui/site-header';
import { SiteFooter } from '@/shared/ui/site-footer';
import { themeInitScript } from '@/shared/ui/theme-toggle';
import { getAnyToken } from '@/shared/lib/panel-auth';
import { apiFetchSafe } from '@/shared/lib/api';
import { QueryProvider } from '@/shared/providers/query-provider';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import './globals.css';

/**
 * Archivo carries the display/broadcast weight; Inter does all UI text.
 * Both self-hosted by next/font — no external request, no layout shift.
 */
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: "BoxArena — Lucknow's Box Cricket, Turf Football & Badminton League",
    template: '%s · BoxArena',
  },
  description:
    "Lucknow's real amateur league. Book a turf, find opponents at your level, record verified scores, and climb the city table.",
  metadataBase: new URL(process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000'),
};

export const viewport: Viewport = {
  themeColor: '#0a0e13',
  colorScheme: 'dark',
};

interface UserMe {
  fullName: string;
  phoneNumber: string;
  role: string;
  avatarUrl?: string;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const token = await getAnyToken();
  const user = token ? await apiFetchSafe<UserMe>(API_ENDPOINTS.usersMe, { token }) : null;

  /*
   * `suppressHydrationWarning` on <html>: themeInitScript stamps data-theme
   * before hydration, so the server markup deliberately differs from the
   * client. Scoped to this ONE element — it does not suppress warnings
   * anywhere else in the tree.
   */
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint — a deferred script
            would let a white flash through on a dark-theme reload. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          <SiteHeader user={user} />
          {children}
          <SiteFooter />
        </QueryProvider>
      </body>
    </html>
  );
}

