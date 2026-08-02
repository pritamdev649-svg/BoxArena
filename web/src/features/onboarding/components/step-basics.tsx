'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { ApplicationSnapshot } from '../actions';

export interface StepProps {
  application: ApplicationSnapshot;
  pending: boolean;
  onSave: (data: unknown) => void;
}

/**
 * Step 1 — venue basics.
 *
 * Three photos minimum, enforced here and again server-side. Photos are the
 * single biggest driver of booking conversion, and a listing with none reads
 * as abandoned no matter how good the venue is.
 */
function useVenueForm(application: ApplicationSnapshot) {
  const [name, setName] = useState(application.venue?.name ?? application.lead.venueName);
  const [description, setDescription] = useState(application.venue?.description ?? '');
  const [contactPhone, setContactPhone] = useState(application.venue?.contactPhone ?? '');
  const [images, setImages] = useState<string[]>(application.venue?.images ?? []);
  const [draft, setDraft] = useState('');

  return {
    name,
    setName,
    description,
    setDescription,
    contactPhone,
    setContactPhone,
    images,
    setImages,
    draft,
    setDraft,
  };
}

export function StepVenue({ application, pending, onSave }: StepProps) {
  const form = useVenueForm(application);
  const ready =
    form.images.length >= 3 && form.name.trim().length > 0 && form.contactPhone.trim().length > 0;

  return (
    <div>
      <h2 className="font-display text-lg uppercase">Venue basics</h2>

      <VenueFields form={form} />

      <PhotoList
        images={form.images}
        draft={form.draft}
        onDraft={form.setDraft}
        onAdd={() => {
          if (form.draft.trim()) form.setImages([...form.images, form.draft.trim()]);
          form.setDraft('');
        }}
        onRemove={(index) => form.setImages(form.images.filter((_, i) => i !== index))}
      />

      <Button
        className="mt-6"
        disabled={pending || !ready}
        onClick={() =>
          onSave({
            name: form.name,
            description: form.description,
            contactPhone: form.contactPhone,
            images: form.images,
          })
        }
      >
        {pending ? 'Saving…' : 'Save and continue'}
      </Button>
    </div>
  );
}

function VenueFields({ form }: { form: ReturnType<typeof useVenueForm> }) {
  return (
    <div className="mt-5 grid gap-4">
      <Input
        label="Venue name"
        value={form.name}
        onChange={(e) => form.setName(e.target.value)}
        required
      />
      <Input
        label="Description"
        value={form.description}
        onChange={(e) => form.setDescription(e.target.value)}
        placeholder="Two nets, wooden flooring, parking for 15"
      />
      <Input
        label="Contact number players will see"
        value={form.contactPhone}
        onChange={(e) => form.setContactPhone(e.target.value)}
        inputMode="numeric"
        maxLength={10}
        required
      />
    </div>
  );
}

function PhotoList({
  images,
  draft,
  onDraft,
  onAdd,
  onRemove,
}: {
  images: string[];
  draft: string;
  onDraft: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="mt-6">
      <p className="label-caps text-ink-muted mb-2">Photos ({images.length} of 3 minimum)</p>

      <ul className="divide-line-subtle border-line-subtle divide-y border-y">
        {images.map((url, index) => (
          <li key={url} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-ink-secondary truncate">{url}</span>
            <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <Input
          label="Photo URL"
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          placeholder="https://…"
          className="flex-1"
        />
        <Button variant="secondary" onClick={onAdd} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      <p className="text-ink-muted mt-2 text-xs">
        Wide shots of the court, the entrance, and the parking. Players decide from these.
      </p>
    </div>
  );
}

/**
 * Step 2 — location.
 *
 * The pin is the whole point of this step. Google places a turf on the main
 * road rather than at the gate often enough that a listing with an unconfirmed
 * pin simply never appears in "arenas near me" &mdash; and the owner blames us.
 * So the confirmation is an explicit, mandatory checkbox, and ops re-checks it
 * against satellite view during verification.
 */
const BLANK_LOCATION = {
  address: {} as Record<string, string>,
  coordinates: [] as number[],
};

/** Resume values, or blanks on a first visit. */
function savedLocation(application: ApplicationSnapshot) {
  const { address, coordinates } = application.location ?? BLANK_LOCATION;
  const coord = (value: number | undefined) => (value === undefined ? '' : String(value));

  return {
    formattedAddress: address.formattedAddress ?? '',
    areaName: address.areaName || application.lead.areaName,
    pincode: address.pincode ?? '',
    lat: coord(coordinates[1]),
    lng: coord(coordinates[0]),
  };
}

function useLocationForm(application: ApplicationSnapshot) {
  const initial = savedLocation(application);
  const [formattedAddress, setAddress] = useState(initial.formattedAddress);
  const [areaName, setAreaName] = useState(initial.areaName);
  const [pincode, setPincode] = useState(initial.pincode);
  const [lat, setLat] = useState(initial.lat);
  const [lng, setLng] = useState(initial.lng);
  const [confirmed, setConfirmed] = useState(false);

  const filled = [formattedAddress.trim(), areaName.trim(), lat, lng].every(Boolean);
  const ready = filled && confirmed;

  return {
    formattedAddress,
    setAddress,
    areaName,
    setAreaName,
    pincode,
    setPincode,
    lat,
    setLat,
    lng,
    setLng,
    confirmed,
    setConfirmed,
    ready,
  };
}

type LocationForm = ReturnType<typeof useLocationForm>;

export function StepLocation({ application, pending, onSave }: StepProps) {
  const form = useLocationForm(application);

  return (
    <div>
      <h2 className="font-display text-lg uppercase">Where exactly</h2>
      <p className="text-ink-secondary mt-2 text-sm">
        Use the coordinates of your <strong>gate</strong>, not the building centre. Open Google
        Maps, long-press the entrance, and copy the two numbers it shows.
      </p>

      <AddressFields form={form} />
      <PinConfirmation form={form} />

      <Button
        className="mt-6"
        disabled={pending || !form.ready}
        onClick={() =>
          onSave({
            address: {
              formattedAddress: form.formattedAddress,
              areaName: form.areaName,
              city: 'Lucknow',
              ...(form.pincode ? { pincode: form.pincode } : {}),
            },
            coordinates: [Number(form.lng), Number(form.lat)],
            pinConfirmedByOwner: true,
          })
        }
      >
        {pending ? 'Saving…' : 'Save and continue'}
      </Button>
    </div>
  );
}

function AddressFields({ form }: { form: LocationForm }) {
  return (
    <div className="mt-5 grid gap-4">
      <Input
        label="Full address"
        value={form.formattedAddress}
        onChange={(e) => form.setAddress(e.target.value)}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Area"
          value={form.areaName}
          onChange={(e) => form.setAreaName(e.target.value)}
          required
        />
        <Input
          label="PIN code"
          value={form.pincode}
          onChange={(e) => form.setPincode(e.target.value)}
          inputMode="numeric"
          maxLength={6}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Latitude"
          value={form.lat}
          onChange={(e) => form.setLat(e.target.value)}
          className="tabular"
          placeholder="26.8467"
          required
        />
        <Input
          label="Longitude"
          value={form.lng}
          onChange={(e) => form.setLng(e.target.value)}
          className="tabular"
          placeholder="80.9462"
          required
        />
      </div>
    </div>
  );
}

/** Mandatory: an unconfirmed pin is the single most common reason a real venue
    never shows up in "arenas near me". */
function PinConfirmation({ form }: { form: LocationForm }) {
  return (
    <label className="mt-5 flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={form.confirmed}
        onChange={(e) => form.setConfirmed(e.target.checked)}
        className="mt-0.5 size-4"
      />
      <span className="text-ink-secondary">
        These coordinates are my venue&rsquo;s entrance, and a player following them will arrive at
        the right gate.
      </span>
    </label>
  );
}
