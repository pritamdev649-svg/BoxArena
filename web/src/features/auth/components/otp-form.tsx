'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { t } from '@/shared/i18n';
import { loginAction, requestOtpAction } from '../actions';

/**
 * Phone + OTP, the only auth path in the product (api_contract.md §1).
 *
 * Two steps in one component because they are one decision to the user. The
 * resend countdown starts at 30s — M2's done-when is that a fallback appears
 * once the SMS has plausibly failed, since a stuck OTP with no way forward is
 * the most common reason a first-time user gives up entirely.
 */

const RESEND_SECONDS = 30;
const PHONE_DIGITS = 10;
const CODE_DIGITS = 6;

export interface OtpFormProps {
  /** Where a verified session lands. */
  action: string;
}

export function OtpForm({ action }: OtpFormProps) {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [devCode, setDevCode] = useState<string>();

  if (step === 'phone') {
    return (
      <PhoneStep
        phone={phone}
        onPhone={setPhone}
        onSent={(code) => {
          setDevCode(code);
          setStep('code');
        }}
      />
    );
  }

  return (
    <CodeStep
      action={action}
      phone={phone}
      devCode={devCode}
      onBack={() => setStep('phone')}
    />
  );
}

function PhoneStep({
  phone,
  onPhone,
  onSent,
}: {
  phone: string;
  onPhone: (value: string) => void;
  onSent: (devCode?: string) => void;
}) {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  /**
   * Actually requests the code. Without this call no OTP row exists, so
   * verification could only ever fail with "that code has expired".
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (phone.length !== PHONE_DIGITS) {
      setError(t('auth.invalidPhone'));
      return;
    }

    setError(undefined);
    setLoading(true);
    const result = await requestOtpAction(`+91${phone}`);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? t('auth.invalidPhone'));
      return;
    }
    onSent(result.devCode);
  };

  return (
    <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
      <Input
        label={t('auth.phoneLabel')}
        name="phoneNumber"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={PHONE_DIGITS}
        placeholder={t('auth.phonePlaceholder')}
        prefix={t('auth.dialCode')}
        className="tabular"
        value={phone}
        onChange={(event) => onPhone(event.target.value.replace(/\D/gu, ''))}
        {...(error ? { error } : {})}
        required
      />

      <Button type="submit" size="lg" fullWidth disabled={loading}>
        {loading ? t('auth.sending') : t('auth.sendCode')}
      </Button>
    </form>
  );
}

/**
 * Only rendered when the API returned a code, which it does exclusively under
 * OTP_DEV_MODE. Styled as a warning so nobody mistakes it for a real feature.
 */
export function DevCodeNotice({ code }: { code: string }) {
  return (
    <p className="border-dispute/50 bg-dispute/10 text-dispute border px-3 py-2 text-xs">
      {t('auth.devCodeNotice')} <span className="tabular font-semibold">{code}</span>
    </p>
  );
}

// eslint-disable-next-line max-lines-per-function
function CodeStep({
  action,
  phone,
  devCode,
  onBack,
}: {
  action: string;
  phone: string;
  devCode?: string | undefined;
  onBack: () => void;
}) {
  /** Prefilled in dev so signing in locally is one click. */
  const [code, setCode] = useState(devCode ?? '');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setLoading(true);

    try {
      const result = await loginAction(`+91${phone}`, code, action);
      if (result.success) {
        router.push(action);
        router.refresh();
      } else {
        setError(result.error ?? t('auth.invalidCode'));
      }
    } catch {
      setError(t('auth.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
      <p className="text-ink-secondary text-sm">
        {t('auth.codeSentTo')} <span className="text-ink tabular">+91 {phone}</span>
      </p>

      {devCode ? <DevCodeNotice code={devCode} /> : null}

      <Input
        label={t('auth.codeLabel')}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_DIGITS}
        placeholder={t('auth.codePlaceholder')}
        className="tabular tracking-[0.4em]"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/gu, ''))}
        {...(error ? { error } : {})}
        required
      />

      <Button type="submit" size="lg" fullWidth disabled={code.length !== CODE_DIGITS || loading}>
        {loading ? t('auth.verifying') : t('auth.verify')}
      </Button>

      <ResendControl phone={phone} />

      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        className="text-ink-secondary hover:text-ink block w-full text-center text-xs disabled:pointer-events-none"
      >
        {t('auth.changeNumber')}
      </button>
    </form>
  );
}

/** The fallback appears once the SMS has plausibly failed, not before. */
function ResendControl({ phone }: { phone: string }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  if (secondsLeft > 0) {
    return (
      <p className="text-ink-muted text-center text-xs">
        {t('auth.resendIn')} <span className="tabular">{secondsLeft}s</span>
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        /** Actually send another code — resetting the timer alone taught the
            user the button was broken. */
        void requestOtpAction(`+91${phone}`);
        setSecondsLeft(RESEND_SECONDS);
      }}
      className="text-volt-ink block w-full text-center text-xs font-medium"
    >
      {t('auth.resend')}
    </button>
  );
}
