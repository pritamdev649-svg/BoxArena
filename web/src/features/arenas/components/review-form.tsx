'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { t } from '@/shared/i18n';
import { submitArenaReviewAction } from '../actions';

/**
 * Rating form, shown only to players the API says may review.
 *
 * Rating is required, the comment is not. Forcing written feedback is how you
 * get one review a month; a player leaving the turf will tap five stars and
 * nothing else, and that rating is still worth having.
 */
const STARS = [1, 2, 3, 4, 5] as const;

interface ReviewTarget {
  arenaPublicId: string;
  arenaSlug: string;
  bookingPublicId: string;
}

/** Owns the request state so the form itself stays markup. */
function useReviewSubmit(target: ReviewTarget) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  const submit = async (rating: number, comment: string) => {
    if (rating === 0) {
      setError(t('arena.reviewPickRating'));
      return;
    }

    setPending(true);
    setError(undefined);

    const result = await submitArenaReviewAction({
      ...target,
      rating,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });

    setPending(false);
    if (result.success) setDone(true);
    else setError(result.error ?? t('arena.reviewFailed'));
  };

  return { pending, error, done, submit };
}

export function ReviewForm(target: ReviewTarget) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const { pending, error, done, submit } = useReviewSubmit(target);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void submit(rating, comment);
  };

  if (done) {
    return (
      <p className="border-win/40 bg-win/10 text-win rounded-control border p-4 text-sm font-medium">
        {t('arena.reviewThanks')}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border-line-subtle bg-surface border p-4">
      <p className="text-ink text-sm font-medium">{t('arena.reviewPrompt')}</p>

      <StarPicker value={rating} onChange={setRating} />
      <CommentField value={comment} onChange={setComment} />

      {error ? <p className="text-loss mt-3 text-sm">{error}</p> : null}

      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t('arena.reviewSaving') : t('arena.reviewSubmit')}
        </Button>
      </div>
    </form>
  );
}

/** Optional — a five-star tap with no words is still a useful rating. */
function CommentField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <>
      <label htmlFor="review-comment" className="label-caps text-ink-muted mt-4 mb-2 block">
        {t('arena.reviewCommentLabel')}
      </label>
      <textarea
        id="review-comment"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={1000}
        rows={3}
        placeholder={t('arena.reviewCommentPlaceholder')}
        className="border-line focus-within:border-line-strong text-ink bg-surface w-full border p-3 text-sm outline-none"
      />
    </>
  );
}

/** Hover previews the rating, so the stars respond before you commit. */
function StarPicker({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div className="mt-3 flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          aria-label={t('arena.reviewStarLabel', { count: star })}
          aria-pressed={value === star}
          /** 44px floor — tapped one-handed, outdoors (design_system.md §2). */
          className="flex size-11 items-center justify-center"
        >
          <Star
            className={cn(
              'size-6 transition-colors duration-150',
              star <= shown ? 'text-gold fill-current' : 'text-ink-muted',
            )}
          />
        </button>
      ))}
    </div>
  );
}
