'use client';

import { useState } from 'react';
import { SettingsSection, SettingsRow } from '@/shared/ui/settings-section';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { t } from '@/shared/i18n';
import type { OwnerArena, OperatingHours } from '@/features/partner';
import { PhotoManager } from '@/features/partner';
import { updateArenaSettingsAction } from '@/features/partner/actions';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const AMENITY_LABELS: Record<string, string> = {
  parking: 'Parking',
  washroom: 'Washroom',
  floodlights: 'Floodlights',
  changing_room: 'Changing room',
  cafeteria: 'Cafeteria',
  cctv: 'CCTV',
  first_aid: 'First aid',
  equipment_rental: 'Equipment rental',
};

export function SettingsForm({ arena }: { arena: OwnerArena }) {
  const [hours, setHours] = useState<OperatingHours[]>(
    arena.operatingHours ?? [
      { dayOfWeek: 0, openTime: '06:00', closeTime: '23:00', isClosed: false },
      { dayOfWeek: 1, openTime: '06:00', closeTime: '23:00', isClosed: false },
      { dayOfWeek: 2, openTime: '06:00', closeTime: '23:00', isClosed: false },
      { dayOfWeek: 3, openTime: '06:00', closeTime: '23:00', isClosed: false },
      { dayOfWeek: 4, openTime: '06:00', closeTime: '23:00', isClosed: false },
      { dayOfWeek: 5, openTime: '06:00', closeTime: '23:00', isClosed: false },
      { dayOfWeek: 6, openTime: '06:00', closeTime: '23:00', isClosed: false },
    ]
  );
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(arena.amenities ?? []);
  const [images, setImages] = useState<string[]>(arena.images ?? []);
  
  const [freeCancellationHours, setFreeCancellationHours] = useState<number>(
    arena.cancellationPolicy?.freeCancellationHours ?? 12
  );
  const [partialRefundPercent, setPartialRefundPercent] = useState<number>(
    arena.cancellationPolicy?.partialRefundPercent ?? 50
  );

  const [bookingMode, setBookingMode] = useState<string>(arena.bookingMode ?? 'prepaid_only');
  const [depositPercent, setDepositPercent] = useState<number>(arena.depositPercent ?? 20);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [success, setSuccess] = useState(false);

  const isRejected = arena.verificationStatus === 'rejected';

  const handleClosedChange = (dayOfWeek: number, checked: boolean) => {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, isClosed: checked } : h))
    );
  };

  const handleTimeChange = (dayOfWeek: number, field: 'openTime' | 'closeTime', value: string) => {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h))
    );
  };

  const handleToggleAmenity = (key: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    setConflicts([]);
    setSuccess(false);

    const result = await updateArenaSettingsAction(arena.publicId, {
      operatingHours: hours,
      amenities: selectedAmenities,
      images,
      cancellationPolicy: {
        freeCancellationHours,
        partialRefundPercent,
      },
      bookingMode,
      depositPercent: bookingMode === 'pay_at_venue_allowed' ? depositPercent : undefined,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to update settings');
      if (result.conflictingBookings) {
        setConflicts(result.conflictingBookings);
      }
      return;
    }

    setSuccess(true);
    // Clear success banner after 3 seconds
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border-line-subtle flex items-center gap-3 border-b py-4">
        <span className="font-display text-lg uppercase">{arena.name}</span>
        <span className="text-ink-muted text-sm">{arena.address.areaName}</span>
        {isRejected ? (
          <Badge tone="loss" className="ml-auto">
            Rejected
          </Badge>
        ) : (
          <Badge tone={arena.isVerified ? 'win' : 'warning'} className="ml-auto">
            {arena.isVerified ? 'Live' : 'Pending verification'}
          </Badge>
        )}
      </div>

      {isRejected && (
        <div className="border-loss/40 bg-loss/10 rounded-control mt-4 border p-4">
          <h3 className="font-display text-loss text-sm font-semibold uppercase">Rejection Reason</h3>
          <p className="text-ink-secondary mt-1 text-sm">
            {arena.rejectionReason || 'No reason specified'}
          </p>
        </div>
      )}

      <SettingsSection
        heading={t('partnerSettings.hoursHeading')}
        body={t('partnerSettings.hoursBody')}
      >
        <div className="space-y-2">
          {[...hours]
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((day) => (
              <div
                key={day.dayOfWeek}
                className="border-line-subtle flex flex-wrap items-center gap-4 border-b py-3 last:border-0"
              >
                <span className="text-ink text-sm font-medium w-28">
                  {DAY_NAMES[day.dayOfWeek]}
                </span>
                <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={day.isClosed}
                    onChange={(e) => handleClosedChange(day.dayOfWeek, e.target.checked)}
                    className="accent-volt rounded"
                  />
                  Closed
                </label>
                {!day.isClosed && (
                  <div className="ml-auto flex items-center gap-2">
                    <input
                      type="time"
                      value={day.openTime}
                      onChange={(e) => handleTimeChange(day.dayOfWeek, 'openTime', e.target.value)}
                      required
                      className="border-line focus-within:border-line-strong text-ink bg-surface h-9 rounded px-2 text-sm outline-none tabular"
                    />
                    <span className="text-ink-muted text-xs">—</span>
                    <input
                      type="time"
                      value={day.closeTime}
                      onChange={(e) => handleTimeChange(day.dayOfWeek, 'closeTime', e.target.value)}
                      required
                      className="border-line focus-within:border-line-strong text-ink bg-surface h-9 rounded px-2 text-sm outline-none tabular"
                    />
                  </div>
                )}
              </div>
            ))}
        </div>
      </SettingsSection>

      <SettingsSection
        heading={t('partnerPhotos.heading')}
        body={t('partnerPhotos.body')}
      >
        <PhotoManager images={images} onChange={setImages} />
      </SettingsSection>

      <SettingsSection
        heading={t('partnerSettings.amenitiesHeading')}
        body={t('partnerSettings.amenitiesBody')}
      >
        <div className="flex flex-wrap gap-2">
          {Object.entries(AMENITY_LABELS).map(([key, label]) => {
            const isOn = selectedAmenities.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleToggleAmenity(key)}
                className={
                  isOn
                    ? 'bg-volt text-ink-inverse rounded-chip px-3 py-2 text-sm font-medium transition-colors cursor-pointer'
                    : 'border-line text-ink-secondary hover:border-line-strong rounded-chip border px-3 py-2 text-sm transition-colors cursor-pointer'
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        heading={t('partnerSettings.policyHeading')}
        body={t('partnerSettings.policyBody')}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('partnerSettings.freeCancellationLabel')}
            type="number"
            min={0}
            max={168}
            value={freeCancellationHours}
            onChange={(e) => setFreeCancellationHours(Number(e.target.value))}
            className="tabular"
            required
          />
          <Input
            label={t('partnerSettings.partialRefundLabel')}
            type="number"
            min={0}
            max={100}
            value={partialRefundPercent}
            onChange={(e) => setPartialRefundPercent(Number(e.target.value))}
            className="tabular"
            required
          />
        </div>
      </SettingsSection>

      <SettingsSection
        heading={t('partnerSettings.bookingModeHeading')}
        body={t('partnerSettings.bookingModeBody')}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="bookingMode" className="label-caps text-ink-muted mb-2 block">
              Booking mode
            </label>
            <select
              id="bookingMode"
              value={bookingMode}
              onChange={(e) => setBookingMode(e.target.value)}
              className="border-line focus-within:border-line-strong text-ink bg-surface h-11 w-full border px-3 text-sm outline-none rounded-control"
            >
              <option value="prepaid_only">{t('partnerSettings.prepaidOnly')}</option>
              <option value="pay_at_venue_allowed">{t('partnerSettings.payAtVenue')}</option>
            </select>
          </div>
          {bookingMode === 'pay_at_venue_allowed' && (
            <Input
              label={t('partnerSettings.depositLabel')}
              type="number"
              min={0}
              max={100}
              value={depositPercent}
              onChange={(e) => setDepositPercent(Number(e.target.value))}
              className="tabular"
              required
            />
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        heading={t('partnerSettings.payoutHeading')}
        body={t('partnerSettings.payoutBody')}
      >
        <SettingsRow label="Commission" value={`${arena.commissionPercent}%`} />
        <SettingsRow label="Settlement cycle" value={arena.settlementCycle ?? 'weekly'} />
      </SettingsSection>

      {error && (
        <div className="border-loss/40 bg-loss/10 rounded-control border p-4 text-sm text-loss">
          <p className="font-semibold">Could not save changes</p>
          <p className="mt-1 text-ink-secondary">{error}</p>
          {conflicts && conflicts.length > 0 && (
            <ul className="mt-3 divide-line-subtle divide-y border-t border-line-subtle pt-2">
              {conflicts.map((conflict: any) => (
                <li key={conflict.slotId} className="flex justify-between py-1 text-xs tabular font-medium">
                  <span>Slot: {new Date(conflict.startAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                  <span className="uppercase text-loss font-semibold">{conflict.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {success && (
        <div className="border-win/40 bg-win/10 rounded-control border p-4 text-sm text-win font-semibold">
          Changes saved successfully!
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? 'Saving...' : t('partnerSettings.save')}
        </Button>
      </div>
    </form>
  );
}
