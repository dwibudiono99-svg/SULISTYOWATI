import { CheckCircle2, Printer, Save, Sparkles, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { SCHOOL_INFO } from '../config/schoolConfig';
import { RequestStatus, ServiceRequest, UserMode } from '../types/tu';
import { formatTanggalIndonesia, generateOfficialLetterNumber } from '../utils/formatters';
import { StatusIndicator } from './StatusIndicator';

interface RequestDetailDrawerProps {
  request: ServiceRequest | null;
  userMode: UserMode;
  totalLettersCount: number;
  onClose: () => void;
  onUpdateStatus: (
    requestId: string,
    newStatus: RequestStatus,
    letterNumber: string,
    staffNote: string,
    addToAgenda: boolean
  ) => void;
  onOpenPrintForRequest: (request: ServiceRequest, docType: 'surat' | 'tanda-terima') => void;
}

const ALL_STATUSES: RequestStatus[] = [
  'Diajukan',
  'Verifikasi Berkas',
  'Proses Pengetikan',
  'Menunggu TTD Kepala Sekolah',
  'Siap Diambil',
  'Selesai',
  'Perlu Perbaikan',
];

export function RequestDetailDrawer({
  request,
  userMode,
  totalLettersCount,
  onClose,
  onUpdateStatus,
  onOpenPrintForRequest,
}: RequestDetailDrawerProps) {
  const [nextStatus, setNextStatus] = useState<RequestStatus>('Verifikasi Berkas');
  const [letterNumber, setLetterNumber] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [addToAgenda, setAddToAgenda] = useState(false);

  useEffect(() => {
    if (request) {
      setNextStatus(request.status);
      setLetterNumber(request.letterNumber ?? '');
      setStaffNote('');
      setAddToAgenda(false);
    }
  }, [request]);

  if (!request) return null;

  const handleStaffUpdate = (e: FormEvent) => {
    e.preventDefault();
    onUpdateStatus(request.id, nextStatus, letterNumber.trim(), staffNote.trim(), addToAgenda);
    setStaffNote('');
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-950/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detail permohonan ${request.id}`}
        className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-xl"
      >
        {/* Header Drawer */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-blue-700">{request.id}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Masuk {formatTanggalIndonesia(request.createdAt)}</span>
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">
              {request.serviceTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup detail permohonan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Drawer */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Status Saat Ini & Catatan Revisi */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">Status Terkini</span>
              <StatusIndicator status={request.status} />
            </div>
            {request.letterNumber && (
              <div className="mt-2.5 flex items-center justify-between gap-4 border-t border-slate-200 pt-2.5 text-xs">
                <span className="text-slate-500">Nomor Surat Resmi</span>
                <span className="font-mono font-semibold text-slate-900">{request.letterNumber}</span>
              </div>
            )}
            {request.status === 'Perlu Perbaikan' && request.revisionNote && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800">
                <strong className="block font-semibold">Catatan Revisi Petugas:</strong>
                {request.revisionNote}
              </div>
            )}
          </div>

          {/* Data Pemohon */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Informasi Pemohon
            </h3>
            <dl className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-2.5 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Nama Lengkap</dt>
                <dd className="font-medium text-slate-900">{request.applicantName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Peran & Kelas/Unit</dt>
                <dd className="text-slate-800">
                  {request.applicantRole} · {request.classOrCohort}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">NISN / NIS / NIP</dt>
                <dd className="font-mono text-slate-900 tabular-nums">{request.identityNumber}</dd>
              </div>
              {request.phone && (
                <div>
                  <dt className="text-xs text-slate-500">WhatsApp</dt>
                  <dd className="font-mono text-slate-900 tabular-nums">{request.phone}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Keperluan Surat</dt>
                <dd className="mt-0.5 text-slate-900">{request.purpose}</dd>
              </div>
              {request.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Catatan Pemohon</dt>
                  <dd className="mt-0.5 text-slate-700">{request.notes}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Berkas Checklist */}
          {userMode === 'petugas' && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Kelengkapan Berkas Dikonfirmasi
              </h3>
              {request.submittedRequirements.length > 0 ? (
                <ul className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-3">
                  {request.submittedRequirements.map((req) => (
                    <li key={req} className="flex items-start gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  Belum ada berkas yang ditandai siap oleh pemohon.
                </p>
              )}
            </section>
          )}

          {/* Riwayat Proses */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Riwayat Proses Pelayanan
            </h3>
            <ol className="mt-3 space-y-4 border-t border-slate-100 pt-3">
              {[...request.timeline].reverse().map((event) => (
                <li key={event.id} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">{event.status}</span>
                      <span className="font-mono text-xs tabular-nums text-slate-400">
                        {formatTanggalIndonesia(event.timestamp, true)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{event.note}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Oleh: {event.actor}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Panel Petugas TU */}
          {userMode === 'petugas' && (
            <form
              onSubmit={handleStaffUpdate}
              className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Tindak Lanjut Petugas TU ({SCHOOL_INFO.staffName})
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="staff-status" className="block text-xs font-medium text-slate-700">
                    Ubah Status Layanan
                  </label>
                  <select
                    id="staff-status"
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as RequestStatus)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {ALL_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="staff-letter-no" className="block text-xs font-medium text-slate-700">
                    Nomor Surat Keluar
                  </label>
                  <div className="mt-1 flex gap-1.5">
                    <input
                      id="staff-letter-no"
                      type="text"
                      value={letterNumber}
                      onChange={(e) => setLetterNumber(e.target.value)}
                      placeholder="421.3/..."
                      className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setLetterNumber(generateOfficialLetterNumber(totalLettersCount))}
                      title="Buat nomor surat otomatis"
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      <span>Isi</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="staff-note" className="block text-xs font-medium text-slate-700">
                  Catatan Proses / Keterangan Revisi
                </label>
                <textarea
                  id="staff-note"
                  rows={2}
                  value={staffNote}
                  onChange={(e) => setStaffNote(e.target.value)}
                  placeholder="Contoh: Berkas lengkap, surat sudah ditandatangani Kepala Sekolah dan siap diambil di Loket 1."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={addToAgenda}
                  onChange={(e) => setAddToAgenda(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700"
                />
                <span>Catat otomatis ke Buku Agenda Surat Keluar TU</span>
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                <Save className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Simpan Perubahan Status</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            onClick={() => onOpenPrintForRequest(request, 'tanda-terima')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Cetak Tanda Terima</span>
          </button>

          {userMode === 'petugas' && (
            <button
              type="button"
              onClick={() => onOpenPrintForRequest(request, 'surat')}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Pratinjau Draf Surat Resmi</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
