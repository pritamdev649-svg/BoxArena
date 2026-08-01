import type { Metadata } from 'next';
import { ComingSoon } from '@/shared/ui/coming-soon';

export const metadata: Metadata = { title: 'Post a challenge' };

export default function NewChallengePage() {
  return (
    <ComingSoon
      title="Post a challenge"
      description="Put a slot you've booked in front of teams at your level. The escrow and matchmaking API is built and tested; this form is next."
      covers={[
        'Pick one of your upcoming bookings',
        'Choose which of your teams is playing',
        'Set an entry fee — or post a free friendly',
        'Restrict who can accept by skill level or rating band',
        'See the prize pool after commission before you confirm',
      ]}
      backHref="/challenges"
      backLabel="Back to challenges"
    />
  );
}
