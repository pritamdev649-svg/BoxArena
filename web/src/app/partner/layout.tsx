import type { Metadata } from 'next';

export const metadata: Metadata = { title: { default: 'Partner', template: '%s · Partner' } };

/**
 * Metadata only. The public pitch, the lead form and the payouts explainer live
 * directly under /partner and keep full site chrome; the operator screens sit
 * in the (panel) group, which adds the sidebar shell.
 */
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
