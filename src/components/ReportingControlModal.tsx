import { LockOpen, ShieldAlert, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { ReportingPortalConfig } from '../types/tu';

interface ReportingControlModalProps {
  open: boolean;
  config: ReportingPortalConfig;
  onClose: () => void;
  onSave: (isOpen: boolean, closedMessage: string) => Promise<boolean>;
}

export function ReportingControlModal({
  open,
  config,
  onClose,
  onSave,
}: ReportingControlModalProps) {
  const [isOpen, setIsOpen] = useState(config.isOpen);
  const [closedMessage, setClosedMessage] = useState(config.closedMessage);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setIsOpen(config.isOpen);
      setClosedMessage(config.closedMessage);
      setSaving(false);
    }
  }, [config, open]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave(isOpen, closedMessage);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/60" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reporting-modal-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="reporting-modal-title" className="text-base font-semibold text-slate-900">
              Sistem Buka / Tutup Pelaporan Layanan TU
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Kendalikan apakah siswa, alumni, dan pemohon dapat mengajukan permohonan baru secara daring.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup pengaturan buka tutup pelaporan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition ${
                isOpen
                  ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <LockOpen
                className={`mt-0.5 h-4 w-4 shrink-0 ${isOpen ? 'text-emerald-700' : 'text-slate-400'}`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-slate-900">Buka Pelaporan</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Formulir pengajuan permohonan publik aktif dan dapat dikirim kapan saja.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition ${
                !isOpen
                  ? 'border-rose-600 bg-rose-50/70 ring-1 ring-rose-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <ShieldAlert
                className={`mt-0.5 h-4 w-4 shrink-0 ${!isOpen ? 'text-rose-700' : 'text-slate-400'}`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-slate-900">Tutup Pelaporan</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Kunci pengajuan baru dari publik (pelacakan tiket & portal Petugas TU tetap aktif).
                </p>
              </div>
            </button>
          </div>

          <div>
            <label htmlFor="closed-msg-input" className="block text-xs font-medium text-slate-700">
              Pesan Pengumuman Saat Pelaporan Ditutup
            </label>
            <textarea
              id="closed-msg-input"
              rows={3}
              value={closedMessage}
              onChange={(e) => setClosedMessage(e.target.value)}
              placeholder="Tuliskan keterangan jam layanan atau alasan penutupan sementara..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`h-9 rounded-lg px-4 text-xs font-semibold text-white disabled:opacity-60 ${
                isOpen ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'
              }`}
            >
              {saving
                ? 'Menyimpan...'
                : isOpen
                  ? 'Aktifkan (Buka Pelaporan)'
                  : 'Kunci (Tutup Pelaporan)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
