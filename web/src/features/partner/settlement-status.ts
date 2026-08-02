import type { MessageKey } from '@/shared/i18n';

/**
 * Payout status -> badge tone and message key.
 *
 * Explicit maps rather than building `partnerSettlements.status_${status}` at
 * runtime: the catalogue is typed, so a status the API adds later fails to
 * compile here instead of rendering the raw key to a venue owner.
 */
export type SettlementStatus = 'draft' | 'approved' | 'processing' | 'paid' | 'failed';

const TONES = {
  draft: 'neutral',
  approved: 'info',
  processing: 'info',
  paid: 'win',
  failed: 'loss',
} as const satisfies Record<SettlementStatus, string>;

const LABELS = {
  draft: 'partnerSettlements.status_draft',
  approved: 'partnerSettlements.status_approved',
  processing: 'partnerSettlements.status_processing',
  paid: 'partnerSettlements.status_paid',
  failed: 'partnerSettlements.status_failed',
} as const satisfies Record<SettlementStatus, MessageKey>;

function normalise(status: string): SettlementStatus {
  return status in TONES ? (status as SettlementStatus) : 'draft';
}

export function settlementTone(status: string): (typeof TONES)[SettlementStatus] {
  return TONES[normalise(status)];
}

export function settlementLabelKey(status: string): MessageKey {
  return LABELS[normalise(status)];
}
