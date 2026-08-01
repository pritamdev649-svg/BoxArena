import type { Metadata } from 'next';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin' } };

/** Metadata only — the sidebar shell lives in the (panel) group. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
