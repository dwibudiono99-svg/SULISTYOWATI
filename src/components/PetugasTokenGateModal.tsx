import { Eye, EyeOff, KeyRound, Lock, ShieldCheck, X } from 'lucide-react';
import { FormEvent, useState } from 'react';

export interface TuAuthStatus {
  isConfigured: boolean;
  hasEnvToken: boolean;
  hasClaimedToken: boolean;
  authenticated: boolean;
  staffName: string | null;
}

interface PetugasTokenGateModalProps {
  open: boolean;
  mode: 'login' | 'claim' | 'change';
  targetLabel?: string;
  onClose: () => void;
  onAuthenticated: (sessionToken: string, staffName: string) => void;
  onTokenChanged?: () => void;
  sessionToken?: string | null;
}

export function PetugasTokenGateModal({
  open,
  mode,
  targetLabel,
  onClose,
  onAuthenticated,
  onTokenChanged,
  sessionToken,
}: PetugasTokenGateModalProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [currentTokenInput, setCurrentTokenInput] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!open) return null;

  const resetFields = () => {
    setTokenInput('');
    setConfirmInput('');
    setCurrentTokenInput('');
    setErrorMsg('');
    setShowSecret(false);
  };

  const handleClose = () => {
    resetFields();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'claim') {
      if (tokenInput.trim().length < 6) {
        setErrorMsg('Token masuk Petugas TU minimal 6 karakter.');
        return;
      }
      if (tokenInput.trim() !== confirmInput.trim()) {
        setErrorMsg('Konfirmasi token tidak cocok.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch('/api/tu-auth/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenInput.trim() }),
        });
        const data = (await res.json()) as {
          sessionToken?: string;
          staffName?: string;
          error?: string;
        };
        if (!res.ok || !data.sessionToken) {
          setErrorMsg(data.error || 'Gagal menetapkan token Petugas TU.');
          return;
        }
        resetFields();
        onAuthenticated(data.sessionToken, data.staffName || 'Sulistyowati, S.Pd.');
      } catch {
        setErrorMsg('Gagal menghubungi server verifikasi.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'change') {
      if (tokenInput.trim().length < 6) {
        setErrorMsg('Token baru minimal 6 karakter.');
        return;
      }
      if (tokenInput.trim() !== confirmInput.trim()) {
        setErrorMsg('Konfirmasi token baru tidak cocok.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch('/api/tu-auth/change-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken || ''}`,
          },
          body: JSON.stringify({
            currentToken: currentTokenInput.trim(),
            newToken: tokenInput.trim(),
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) {
          setErrorMsg(data.error || 'Gagal memperbarui token Petugas TU.');
          return;
        }
        resetFields();
        onTokenChanged?.();
      } catch {
        setErrorMsg('Gagal menghubungi server verifikasi.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Login mode
    if (!tokenInput.trim()) {
      setErrorMsg('Masukkan Token Petugas TU terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/tu-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = (await res.json()) as {
        sessionToken?: string;
        staffName?: string;
        error?: string;
      };
      if (!res.ok || !data.sessionToken) {
        setErrorMsg(data.error || 'Token masuk Petugas TU tidak valid.');
        return;
      }
      resetFields();
      onAuthenticated(data.sessionToken, data.staffName || 'Sulistyowati, S.Pd.');
    } catch {
      setErrorMsg('Gagal menghubungi server verifikasi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/65"
        onClick={handleClose}
        aria-hidden="true"
      />

      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Autentikasi Token Petugas Tata Usaha"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-blue-600/20 p-2 text-blue-300">
              {mode === 'claim' ? (
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Lock className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {mode === 'claim'
                  ? 'Aktivasi Token Petugas TU'
                  : mode === 'change'
                    ? 'Ubah Token Masuk Petugas TU'
                    : 'Portal Terproteksi Token TU'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-300">
                {mode === 'claim'
                  ? 'Tetapkan token rahasia untuk mengunci akses Database Siswa & Tata Usaha.'
                  : mode === 'change'
                    ? 'Perbarui token masuk yang digunakan staf Tata Usaha.'
                    : targetLabel
                      ? `Masukkan Token Petugas TU untuk membuka "${targetLabel}".`
                      : 'Masukkan Token Masuk Petugas Tata Usaha SMAN 9 Surabaya.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup dialog token"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {errorMsg}
            </div>
          )}

          {mode === 'claim' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs leading-relaxed text-blue-900">
              Belum ada token yang dikonfigurasi pada server. Token yang Anda buat di sini akan
              langsung dienkripsi di server dan wajib dimasukkan setiap kali pemohon ingin beralih
              ke Mode Petugas TU atau mengakses Database Dapodik.
            </div>
          )}

          {mode === 'change' && (
            <div>
              <label htmlFor="tu-current-token" className="block text-xs font-medium text-slate-700">
                Token Petugas TU Saat Ini
              </label>
              <input
                id="tu-current-token"
                type={showSecret ? 'text' : 'password'}
                required
                value={currentTokenInput}
                onChange={(e) => setCurrentTokenInput(e.target.value)}
                placeholder="Masukkan token lama"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label htmlFor="tu-token-input" className="block text-xs font-medium text-slate-700">
              {mode === 'claim'
                ? 'Buat Token Masuk Petugas TU (Min. 6 Karakter)'
                : mode === 'change'
                  ? 'Token Masuk Baru (Min. 6 Karakter)'
                  : 'Token Masuk Petugas TU'}
            </label>
            <div className="relative mt-1.5">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="tu-token-input"
                type={showSecret ? 'text' : 'password'}
                required
                autoFocus
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Masukkan token akses petugas TU..."
                className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-10 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                aria-label={showSecret ? 'Sembunyikan token' : 'Tampilkan token'}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {(mode === 'claim' || mode === 'change') && (
            <div>
              <label htmlFor="tu-token-confirm" className="block text-xs font-medium text-slate-700">
                Konfirmasi Token Masuk
              </label>
              <input
                id="tu-token-confirm"
                type={showSecret ? 'text' : 'password'}
                required
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Ketik ulang token yang sama"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {submitting
                ? 'Memverifikasi...'
                : mode === 'claim'
                  ? 'Aktifkan Token & Masuk'
                  : mode === 'change'
                    ? 'Simpan Token Baru'
                    : 'Verifikasi & Masuk Petugas TU'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
