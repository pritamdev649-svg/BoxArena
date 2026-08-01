'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, Star, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/i18n';
import { getArenaUploadSignatureAction } from '../actions';

/**
 * Venue photo manager.
 *
 * Files go browser → Cloudinary directly using a short-lived signature minted
 * by the server (upload.service.ts) — the bytes never touch our API, which is
 * what keeps a 5MB photo off a Node request thread on a 4G connection.
 *
 * The list is ORDERED and the first photo is the cover: it is what players see
 * on the arena card and the landing page strip. That is the only ordering rule
 * owners care about, so it is the only one exposed — "make this the cover"
 * rather than a drag handle that is miserable on a phone.
 *
 * Nothing here saves on its own. Uploads mutate local state and the parent
 * form persists them, so an owner who uploads a photo and then leaves without
 * saving has not silently changed their public page.
 */
const MAX_PHOTOS = 12;

export function PhotoManager({
  images,
  onChange,
}: {
  images: string[];
  onChange: (next: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(undefined);
    setUploading(true);
    try {
      const room = MAX_PHOTOS - images.length;
      onChange([...images, ...(await uploadAll(Array.from(files).slice(0, room)))]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('partnerPhotos.uploadFailed'));
    } finally {
      setUploading(false);
      /** Reset, so re-picking the same file still fires a change event. */
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((url, index) => (
          <PhotoTile
            key={url}
            url={url}
            isCover={index === 0}
            onRemove={() => onChange(images.filter((image) => image !== url))}
            onMakeCover={() => onChange([url, ...images.filter((image) => image !== url)])}
          />
        ))}

        {images.length < MAX_PHOTOS ? (
          <AddPhotoButton uploading={uploading} onClick={() => inputRef.current?.click()} />
        ) : null}
      </div>

      <FilePicker inputRef={inputRef} onPick={handleFiles} />

      {error ? <p className="text-loss mt-3 text-sm">{error}</p> : null}

      <p className="text-ink-muted mt-3 text-xs">{t('partnerPhotos.hint', { count: MAX_PHOTOS })}</p>
    </div>
  );
}

/** Hidden — the visible affordance is the dashed "add photos" tile. */
function FilePicker({
  inputRef,
  onPick,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (files: FileList | null) => Promise<void>;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      hidden
      onChange={(event) => void onPick(event.target.files)}
    />
  );
}

function PhotoTile({
  url,
  isCover,
  onRemove,
  onMakeCover,
}: {
  url: string;
  isCover: boolean;
  onRemove: () => void;
  onMakeCover: () => void;
}) {
  return (
    <figure className="border-line-subtle bg-inset relative aspect-[4/3] overflow-hidden border">
      <Image src={url} alt="" fill sizes="200px" className="object-cover" />

      {isCover ? (
        <figcaption className="bg-volt text-ink-inverse label-caps absolute top-0 left-0 px-1.5 py-0.5">
          {t('partnerPhotos.cover')}
        </figcaption>
      ) : (
        <button
          type="button"
          onClick={onMakeCover}
          title={t('partnerPhotos.makeCover')}
          aria-label={t('partnerPhotos.makeCover')}
          className="bg-ink/60 text-surface hover:bg-ink/80 absolute bottom-1 left-1 flex size-8 items-center justify-center transition-colors duration-150"
        >
          <Star className="size-4" />
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={t('partnerPhotos.remove')}
        className="bg-ink/60 text-surface hover:bg-loss absolute top-1 right-1 flex size-8 items-center justify-center transition-colors duration-150"
      >
        <X className="size-4" />
      </button>
    </figure>
  );
}

function AddPhotoButton({ uploading, onClick }: { uploading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={uploading}
      className={cn(
        'border-line text-ink-secondary hover:border-line-strong hover:text-ink flex aspect-[4/3] flex-col items-center justify-center gap-2 border border-dashed text-xs transition-colors duration-150',
        uploading && 'opacity-60',
      )}
    >
      {uploading ? (
        <>
          <Loader2 className="size-5 animate-spin" />
          {t('partnerPhotos.uploading')}
        </>
      ) : (
        <>
          <ImagePlus className="size-5" />
          {t('partnerPhotos.add')}
        </>
      )}
    </button>
  );
}

interface Signature {
  signature: string;
  timestamp: number;
  apiKey: string;
  folder: string;
  uploadUrl: string;
  maxBytes: number;
}

/** One signature per file — each is valid for a single upload. */
async function uploadAll(files: File[]): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    const signed = await getArenaUploadSignatureAction();
    if (!signed.success) throw new Error(signed.error);

    if (file.size > signed.data.maxBytes) {
      throw new Error(
        t('partnerPhotos.tooLarge', {
          count: Math.floor(signed.data.maxBytes / (1024 * 1024)),
        }),
      );
    }

    urls.push(await uploadToCloudinary(file, signed.data));
  }

  return urls;
}

/**
 * The signed params are exactly what the server signed — adding anything else
 * (a different folder, a transformation) invalidates the signature, which is
 * the point.
 */
async function uploadToCloudinary(file: File, signed: Signature): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('folder', signed.folder);
  form.append('signature', signed.signature);

  const response = await fetch(signed.uploadUrl, { method: 'POST', body: form });
  const result = (await response.json()) as { secure_url?: string; error?: { message: string } };

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message ?? t('partnerPhotos.uploadFailed'));
  }
  return result.secure_url;
}
