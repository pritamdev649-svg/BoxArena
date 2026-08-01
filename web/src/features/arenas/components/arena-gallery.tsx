'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { SportCourt, type SportKey } from '@/shared/ui/court-graphics';
import { t } from '@/shared/i18n';

/**
 * Venue photo gallery.
 *
 * Photos are whatever the OWNER uploaded — there is no stock imagery and no
 * placeholder photography anywhere in this product. A venue that has not
 * uploaded anything gets the court diagram it always had, which is honest
 * about the gap instead of showing someone else's turf (design_system.md §8.1).
 *
 * Interaction is deliberately plain: arrows, thumbnails, arrow keys. A
 * lightbox would be a second surface to get right on a 4G phone at 9pm, and
 * the photos are decoration around the thing you came to do — book a slot.
 */
export function ArenaGallery({
  images,
  arenaName,
  sport,
}: {
  images: string[];
  arenaName: string;
  sport: SportKey;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) return <GalleryFallback sport={sport} />;

  /** Wraps, so the arrows never dead-end on a two-photo venue. */
  const step = (delta: number) =>
    setActive((current) => (current + delta + images.length) % images.length);

  return (
    <section aria-label={t('arena.galleryLabel')}>
      <GalleryStage images={images} arenaName={arenaName} active={active} onStep={step} />
      {images.length > 1 ? (
        <GalleryThumbs images={images} active={active} onSelect={setActive} />
      ) : null}
    </section>
  );
}

function GalleryStage({
  images,
  arenaName,
  active,
  onStep,
}: {
  images: string[];
  arenaName: string;
  active: number;
  onStep: (delta: number) => void;
}) {
  return (
    <div
      className="bg-inset border-line-subtle relative aspect-[16/9] w-full overflow-hidden border"
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') onStep(-1);
        if (event.key === 'ArrowRight') onStep(1);
      }}
      /** Focusable so the arrow keys have somewhere to land. */
      tabIndex={0}
      role="group"
    >
      {images.map((url, index) => (
        <Image
          key={url}
          src={url}
          /** The venue name is data, not copy — it needs no translation. */
          alt={arenaName}
          fill
          /** Only the first photo is above the fold; the rest can wait. */
          priority={index === 0}
          sizes="(min-width: 1024px) 640px, 100vw"
          className={cn(
            'object-cover transition-opacity duration-200',
            index === active ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}

      {images.length > 1 ? (
        <>
          <GalleryArrow direction="prev" onClick={() => onStep(-1)} />
          <GalleryArrow direction="next" onClick={() => onStep(1)} />
          <p className="tabular bg-ink/70 text-surface absolute right-3 bottom-3 px-2 py-1 text-xs">
            {active + 1} / {images.length}
          </p>
        </>
      ) : null}
    </div>
  );
}

function GalleryThumbs({
  images,
  active,
  onSelect,
}: {
  images: string[];
  active: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
      {images.map((url, index) => (
        <button
          key={url}
          type="button"
          onClick={() => onSelect(index)}
          aria-label={t('arena.showPhoto', { count: index + 1 })}
          aria-current={index === active}
          className={cn(
            'relative h-14 w-20 shrink-0 overflow-hidden border transition-opacity duration-150',
            index === active
              ? 'border-volt opacity-100'
              : 'border-line-subtle opacity-60 hover:opacity-100',
          )}
        >
          <Image src={url} alt="" fill sizes="80px" className="object-cover" />
        </button>
      ))}
    </div>
  );
}

function GalleryArrow({
  direction,
  onClick,
}: {
  direction: 'prev' | 'next';
  onClick: () => void;
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(direction === 'prev' ? 'arena.prevPhoto' : 'arena.nextPhoto')}
      className={cn(
        'bg-ink/60 text-surface hover:bg-ink/80 absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center transition-colors duration-150',
        direction === 'prev' ? 'left-2' : 'right-2',
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

/** No photos yet — say so, rather than implying the venue looks like nothing. */
function GalleryFallback({ sport }: { sport: SportKey }) {
  return (
    <div className="bg-inset border-line-subtle flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 border">
      <SportCourt sport={sport} strokeWidth={1} className="w-20 opacity-40" />
      <p className="text-ink-muted flex items-center gap-1.5 text-xs">
        <ImageOff className="size-3.5" />
        {t('arena.noPhotos')}
      </p>
    </div>
  );
}
