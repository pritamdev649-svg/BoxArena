import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, MapPin } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { apiFetchSafe } from '@/shared/lib/api';
import { getAdminToken } from '@/shared/lib/panel-auth';
import { VerificationChecklist } from '@/features/admin';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export const dynamic = 'force-dynamic';

interface ApplicationDetail {
  publicId: string;
  status: string;
  lead: {
    ownerName: string; phoneNumber: string; venueName: string;
    areaName: string; courtCount: number; sports: string[]; source: string;
  };
  location?: { coordinates: [number, number]; pinConfirmedByOwner: boolean };
  verification: Record<string, boolean | string | undefined>;
  possibleDuplicates?: { publicId: string; name: string }[];
  rejectionReason?: string;
}

/** Task F5.1. The gate: approval is blocked until every box is ticked. */
export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const token = await getAdminToken();
  const application = await apiFetchSafe<ApplicationDetail>(
    API_ENDPOINTS.adminApplicationDetail(publicId),
    { token },
  );

  if (!application) notFound();

  const statusLabel =
    application.status === 'approved'
      ? 'Approved'
      : application.status === 'rejected'
        ? 'Rejected'
        : 'Needs review';

  const statusTone =
    application.status === 'approved'
      ? 'win'
      : application.status === 'rejected'
        ? 'loss'
        : 'warning';

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/admin/applications" className="text-ink-muted hover:text-ink text-sm">
        &larr; All applications
      </Link>

      <header className="mt-4 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-display-md uppercase">{application.lead.venueName}</h1>
          <p className="text-ink-secondary mt-2 text-sm">
            {application.lead.ownerName} · {application.lead.phoneNumber} ·{' '}
            {application.lead.areaName}
          </p>
        </div>
        <Badge tone={statusTone}>
          {statusLabel}
        </Badge>
      </header>

      <DuplicateWarning duplicates={application.possibleDuplicates ?? []} />
      <ApplicationFacts application={application} />

      <VerificationChecklist
        applicationPublicId={application.publicId}
        initial={application.verification}
        status={application.status}
        rejectionReason={application.rejectionReason}
      />

      {application.location ? (
        <p className="text-ink-muted mt-8 flex items-center gap-1.5 text-xs">
          <MapPin className="size-3" />
          Check the pin against satellite view before ticking. Google&rsquo;s pin for a turf is
          routinely 100&ndash;300m off, and a wrong pin means the venue never appears in radius
          search.
        </p>
      ) : null}
    </main>
  );
}

function Detail({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="label-caps text-ink-muted">{label}</p>
      <p className="text-ink mt-1 text-sm capitalize">{value}</p>
      {hint ? <p className="text-ink-muted mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

function DuplicateWarning({ duplicates }: { duplicates: { publicId: string; name: string }[] }) {
  if (duplicates.length === 0) return null;

  /** Two people applying for the same turf is a real case (§123). */
  return (
    <div className="border-dispute/50 bg-dispute/10 mb-8 flex gap-3 border p-4">
      <AlertTriangle className="text-dispute mt-0.5 size-4 shrink-0" />
      <div className="text-sm">
        <p className="text-dispute font-semibold">Possible duplicate venue</p>
        <p className="text-ink-secondary mt-1">
          An existing arena sits within 100m: {duplicates.map((d) => d.name).join(', ')}. Confirm
          who actually operates this venue before approving.
        </p>
      </div>
    </div>
  );
}

function ApplicationFacts({ application }: { application: ApplicationDetail }) {
  const pin = application.location;
  return (
    <section className="border-line-subtle mb-8 grid gap-6 border-b pb-8 sm:grid-cols-2">
      <Detail label="Sports" value={application.lead.sports.join(', ')} />
      <Detail label="Courts declared" value={String(application.lead.courtCount)} />
      <Detail label="Lead source" value={application.lead.source.replace('_', ' ')} />
      <Detail
        label="Map pin"
        value={pin ? `${pin.coordinates[1].toFixed(5)}, ${pin.coordinates[0].toFixed(5)}` : 'Not set'}
        hint={
          pin?.pinConfirmedByOwner
            ? 'Owner dragged and confirmed the pin'
            : 'Owner has NOT confirmed the pin — verify against satellite'
        }
      />
    </section>
  );
}
