import { formatPaiseCompact } from '@/shared/lib/money';
import { istHourLabel } from '@/shared/lib/datetime';
import { t } from '@/shared/i18n';

/**
 * What the next seven days will actually cost, per court.
 *
 * Priced by the SAME resolver the slots are stamped with
 * (pricing.service.ts resolvePricePaise), so this is not an approximation of
 * the bands — it is the bands. An owner who sets a 6pm–10pm weekend band and
 * cannot see its effect until Saturday will discover the mistake from a player
 * complaining about the price.
 */
export interface PreviewCell {
  dayOfWeek: number;
  hour: number;
  pricePaise: number;
}

export interface CourtPreview {
  courtId: string;
  courtName: string;
  grid: PreviewCell[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function PricingPreview({ previews }: { previews: CourtPreview[] }) {
  if (previews.length === 0) {
    return <p className="text-ink-muted text-sm">{t('partnerCourts.noPreview')}</p>;
  }

  return (
    <div className="space-y-8">
      {previews.map((preview) => (
        <CourtGrid key={preview.courtId} preview={preview} />
      ))}
    </div>
  );
}

function CourtGrid({ preview }: { preview: CourtPreview }) {
  const hours = [...new Set(preview.grid.map((cell) => cell.hour))].sort((a, b) => a - b);
  const days = [...new Set(preview.grid.map((cell) => cell.dayOfWeek))].sort((a, b) => a - b);

  /** Lookup by "day:hour" so the table body is a plain map, not a search. */
  const byCell = new Map(
    preview.grid.map((cell) => [`${cell.dayOfWeek}:${cell.hour}`, cell.pricePaise]),
  );

  /** Highlights the bands: anything above the cheapest hour is a peak rate. */
  const cheapest = Math.min(...preview.grid.map((cell) => cell.pricePaise));

  return (
    <div>
      <h3 className="font-display mb-3 text-sm uppercase">{preview.courtName}</h3>

      {/* Wide table on a phone — scroll it rather than squash the numbers. */}
      <div className="border-line-subtle overflow-x-auto border">
        <table className="w-full min-w-[32rem] border-collapse text-xs">
          <thead>
            <tr className="border-line-subtle border-b">
              <th className="label-caps text-ink-muted p-2 text-left">
                {t('partnerCourts.hour')}
              </th>
              {days.map((day) => (
                <th key={day} className="label-caps text-ink-muted p-2 text-right">
                  {DAY_LABELS[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour} className="border-line-subtle border-b last:border-b-0">
                <td className="text-ink-secondary tabular p-2 whitespace-nowrap">
                  {istHourLabel(hour)}
                </td>
                {days.map((day) => (
                  <PriceCell key={day} paise={byCell.get(`${day}:${hour}`)} cheapest={cheapest} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-ink-muted mt-2 text-xs">{t('partnerCourts.previewLegend')}</p>
    </div>
  );
}

/** Undefined means the venue is shut that hour, which is not a price of zero. */
function PriceCell({ paise, cheapest }: { paise: number | undefined; cheapest: number }) {
  if (paise === undefined) return <td className="text-ink-muted p-2 text-right">—</td>;

  const isPeak = paise > cheapest;
  return (
    <td
      className={
        isPeak
          ? 'text-volt-ink tabular p-2 text-right font-medium'
          : 'text-ink-secondary tabular p-2 text-right'
      }
    >
      {formatPaiseCompact(paise)}
    </td>
  );
}
