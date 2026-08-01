import { Star } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/i18n';
import { ReviewForm } from './review-form';

/** As returned by GET /arenas/:publicId/reviews (userId is populated). */
export interface ArenaReview {
  _id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  userId?: { fullName?: string; avatarUrl?: string } | null;
}

/**
 * Ratings from players who actually booked here.
 *
 * The API only accepts a review tied to a completed booking at this venue, so
 * there is no anonymous-drive-by rating to filter out — which is why the
 * average shown at the top of the page can be trusted enough to sort the
 * landing page by it.
 */
export function ArenaReviews({
  reviews,
  rating,
  eligibility,
  arenaPublicId,
  arenaSlug,
}: {
  reviews: ArenaReview[];
  rating: { average: number; count: number };
  /** null when nobody is signed in — we then invite a sign-in, not a rating. */
  eligibility: { canReview: boolean; bookingPublicId: string | null } | null;
  arenaPublicId: string;
  arenaSlug: string;
}) {
  return (
    <section className="border-line-subtle mt-10 border-t pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-display-md uppercase">{t('arena.reviewsHeading')}</h2>
        {rating.count > 0 ? (
          <p className="text-ink-secondary flex items-center gap-1.5 text-sm">
            <Star className="text-gold size-4 fill-current" />
            <span className="tabular font-medium">{rating.average.toFixed(1)}</span>
            <span className="text-ink-muted tabular">
              {t('arena.reviewCount', { count: rating.count })}
            </span>
          </p>
        ) : null}
      </div>

      <div className="mt-5">
        <ReviewInvite
          eligibility={eligibility}
          arenaPublicId={arenaPublicId}
          arenaSlug={arenaSlug}
        />
      </div>

      {reviews.length === 0 ? (
        <p className="text-ink-muted mt-6 text-sm">{t('arena.reviewsEmpty')}</p>
      ) : (
        <ul className="divide-line-subtle mt-6 divide-y">
          {reviews.map((review) => (
            <ReviewRow key={review._id} review={review} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Either the form, or the reason you cannot use it.
 *
 * Signed out and "never played here" are different answers and get different
 * copy — telling a signed-out player they are not allowed to rate the venue
 * would be a lie they can disprove by logging in.
 */
function ReviewInvite({
  eligibility,
  arenaPublicId,
  arenaSlug,
}: {
  eligibility: { canReview: boolean; bookingPublicId: string | null } | null;
  arenaPublicId: string;
  arenaSlug: string;
}) {
  if (eligibility?.canReview && eligibility.bookingPublicId) {
    return (
      <ReviewForm
        arenaPublicId={arenaPublicId}
        arenaSlug={arenaSlug}
        bookingPublicId={eligibility.bookingPublicId}
      />
    );
  }

  return (
    <p className="text-ink-muted border-line-subtle rounded-control border border-dashed p-4 text-sm">
      {eligibility === null ? t('arena.reviewSignedOut') : t('arena.reviewNeedsBooking')}
    </p>
  );
}

function ReviewRow({ review }: { review: ArenaReview }) {
  return (
    <li className="py-4">
      <div className="flex items-center gap-3">
        <p className="text-ink text-sm font-medium">
          {review.userId?.fullName ?? t('arena.reviewAnonymous')}
        </p>
        <Stars value={review.rating} />
        <time
          dateTime={review.createdAt}
          className="text-ink-muted tabular ml-auto text-xs"
        >
          {new Date(review.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </time>
      </div>
      {review.comment ? (
        <p className="text-ink-secondary mt-2 text-sm">{review.comment}</p>
      ) : null}
    </li>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={t('arena.reviewStarLabel', { count: value })}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn('size-3.5', star <= value ? 'text-gold fill-current' : 'text-ink-muted')}
        />
      ))}
    </span>
  );
}
