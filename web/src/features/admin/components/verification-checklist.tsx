'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/cn';



const CHECKS = [
  { key: 'phoneVerifiedByOps', label: 'Phone answered; owner confirms they operate the venue' },
  { key: 'pinMatchesSatellite', label: 'Map pin matches satellite view AND the actual gate' },
  { key: 'photosAuthentic', label: 'Photos are of this venue — not stock, not a competitor' },
  { key: 'courtCountVerified', label: 'Court count matches reality (site visit or video walk)' },
  { key: 'ownershipDocSeen', label: 'Ownership/lease document or utility bill seen' },
  { key: 'bankNameMatches', label: 'Bank account name matches the owner or business' },
  { key: 'pricingSane', label: 'Pricing is sane for the area' },
] as const;

import {
  useVerifyApplication,
  useApproveApplication,
  useRejectApplication,
} from '@/shared/services/admin-service';

export function VerificationChecklist({
  applicationPublicId,
  initial,
  status,
  rejectionReason,
}: {
  applicationPublicId: string;
  initial: Record<string, boolean | string | undefined>;
  status: string;
  rejectionReason?: string | undefined;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CHECKS.map((check) => [check.key, initial[check.key] === true])),
  );

  const verifyMutation = useVerifyApplication();
  const approveMutation = useApproveApplication();
  const rejectMutation = useRejectApplication();

  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';

  const ticked = CHECKS.filter((check) => checked[check.key]).length;

  const isSaving = verifyMutation.isPending || approveMutation.isPending || rejectMutation.isPending;
  const error =
    verifyMutation.error?.message ||
    approveMutation.error?.message ||
    rejectMutation.error?.message ||
    null;

  return (
    <section>
      <h2 className="font-display mb-1 text-lg uppercase">Verification checklist</h2>
      <p className="text-ink-muted mb-5 text-xs">
        All seven must be ticked before this venue can go live.
      </p>

      {isApproved && (
        <div className="mb-6">
          <ApprovedNotice />
        </div>
      )}

      {isRejected && (
        <div className="mb-6">
          <RejectedNotice reason={rejectionReason} />
        </div>
      )}

      <ChecklistItems
        checked={checked}
        onToggle={(key, value) => setChecked((current) => ({ ...current, [key]: value }))}
        disabled={isApproved}
      />

      {error ? (
        <p role="alert" className="text-loss mt-4 text-sm">
          {error}
        </p>
      ) : null}

      <ChecklistActions
        ticked={ticked}
        isSaving={isSaving}
        isApproved={isApproved}
        isRejected={isRejected}
        onSave={async () => {
          try {
            await verifyMutation.mutateAsync({ publicId: applicationPublicId, checklist: checked });
            router.refresh();
          } catch (err) {
            console.error(err);
          }
        }}
        onApprove={async () => {
          try {
            await verifyMutation.mutateAsync({ publicId: applicationPublicId, checklist: checked });
            await approveMutation.mutateAsync(applicationPublicId);
            router.refresh();
          } catch (err) {
            console.error(err);
          }
        }}
        onReject={async (reason) => {
          try {
            await rejectMutation.mutateAsync({ publicId: applicationPublicId, reason });
            router.refresh();
          } catch (err) {
            console.error(err);
          }
        }}
      />
    </section>
  );
}

function ApprovedNotice() {
  return (
    <div className="border-win/40 bg-win/10 flex items-center gap-3 border p-4 text-sm">
      <Check className="text-win size-4" />
      <span className="text-ink-secondary">
        This venue is approved and live. Slots have been generated.
      </span>
    </div>
  );
}

function RejectedNotice({ reason }: { reason?: string | undefined }) {
  return (
    <div className="border-loss/40 bg-loss/10 flex items-start gap-3 border p-4 text-sm">
      <X className="text-loss mt-0.5 size-4 shrink-0" />
      <div>
        <span className="text-ink font-semibold">This application was rejected.</span>
        <p className="text-ink-secondary mt-1">Reason: {reason || 'No reason specified'}</p>
      </div>
    </div>
  );
}

function ChecklistActions({
  ticked,
  isSaving,
  isApproved,
  isRejected,
  onSave,
  onApprove,
  onReject,
}: {
  ticked: number;
  isSaving: boolean;
  isApproved: boolean;
  isRejected: boolean;
  onSave: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const allTicked = ticked === CHECKS.length;

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {!isApproved && (
        <Button variant="secondary" disabled={isSaving} onClick={onSave}>
          Save progress
        </Button>
      )}
      <Button disabled={isApproved || !allTicked || isSaving} onClick={onApprove}>
        {isApproved
          ? 'Approved & Live'
          : allTicked
            ? 'Approve & go live'
            : `Approve (${String(ticked)}/${String(CHECKS.length)})`}
      </Button>
      <Button variant="danger" disabled={isSaving} onClick={() => {
        const reason = window.prompt('Enter rejection reason (minimum 5 characters):');
        if (reason === null) return;
        if (reason.trim().length < 5) {
          window.alert('Rejection reason must be at least 5 characters.');
          return;
        }
        onReject(reason);
      }}>
        {isRejected ? 'Change Rejection Reason' : 'Reject Application'}
      </Button>
    </div>
  );
}

function ChecklistItems({
  checked,
  onToggle,
  disabled,
}: {
  checked: Record<string, boolean>;
  onToggle: (key: string, value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="divide-line-subtle border-line-subtle divide-y border-y">
      {CHECKS.map((check) => (
        <li key={check.key}>
          <label className={cn(
            "flex items-start gap-3 px-1 py-3 transition-colors duration-150",
            disabled ? "opacity-75 cursor-not-allowed" : "hover:bg-elevated/60 cursor-pointer"
          )}>
            <input
              type="checkbox"
              checked={checked[check.key] ?? false}
              onChange={(event) => !disabled && onToggle(check.key, event.target.checked)}
              disabled={disabled}
              className="accent-volt mt-0.5 size-4 shrink-0"
            />
            <span className={cn('text-sm', checked[check.key] ? 'text-ink' : 'text-ink-secondary')}>
              {check.label}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
