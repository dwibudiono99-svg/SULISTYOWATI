import { Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SCHOOL_INFO } from '../config/schoolConfig';
import { ServiceRequest, UserMode } from '../types/tu';
import { formatTanggalIndonesia, formatTanggalSuratResmi } from '../utils/formatters';

interface DocumentPrintViewProps {
  requests: ServiceRequest[];
  userMode: UserMode;
  selectedRequestId?: string;
  initialDocMode?: 'surat' | 'tanda-terima';
}

export function DocumentPrintView({
  requests,
  userMode,
  selectedRequestId,
  initialDocMode = 'surat',
}: DocumentPrintViewProps) {
  const isPetugas = userMode === 'petugas';
  const [ticketId, setTicketId] = useState<string>(
    selectedRequestId || requests[0]?.id || ''
  );
  const [docMode, setDocMode] = useState<'surat' | 'tanda-terima'>(
    isPetugas ? initialDocMode : 'tanda-terima'
  );
  const [principalName, setPrincipalName] = useState('Kepala SMA Negeri 9 Surabaya');
  const [principalNip, setPrincipalNip] = useState('196905121995121003');

  useEffect(() => {
    if (selectedRequestId) {
      setTicketId(selectedRequestId);
    }
  }, [selectedRequestId]);

  useEffect(() => {
    setDocMode(isPetugas ? initialDocMode : 'tanda-terima');
  }, [initialDocMode, isPetugas]);

  const activeReq = requests.find((r) => r.id === ticketId) ?? requests[0];

  const handlePrint = () => {
    window.print();
  };

  if (!activeReq) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Belum ada permohonan surat yang dapat dicetak. Ajukan permohonan terlebih dahulu.
      </div>
    );
  }

  const displayLetterNo = activeReq.letterNumber || '421.3/___/101.6.1.9/2026';

  return (
    <div className="space-y-6">
      {/* Toolbar Kontrol Cetak */}
      <div className="no-print flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end sm:p-5">
        <div className={`grid flex-1 grid-cols-1 gap-3 ${isPetugas ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <div>
            <label htmlFor="print-ticket" className="block text-xs font-medium text-slate-700">
              Pilih Tiket Permohonan
            </label>
            <select
              id="print-ticket"
              value={activeReq.id}
              onChange={(e) => setTicketId(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
            >
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} — {r.applicantName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="print-mode" className="block text-xs font-medium text-slate-700">
              Jenis Dokumen Cetak
            </label>
            <select
              id="print-mode"
              value={docMode}
              onChange={(e) => setDocMode(e.target.value as 'surat' | 'tanda-terima')}
              disabled={!isPetugas}
              className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 disabled:bg-slate-50"
            >
              <option value="tanda-terima">Tanda Terima Loket TU</option>
              {isPetugas && (
                <option value="surat">Draf Surat Resmi (Kop Sekolah)</option>
              )}
            </select>
          </div>

          {isPetugas && (
            <div>
              <label htmlFor="print-principal" className="block text-xs font-medium text-slate-700">
                Penandatangan (TTD)
              </label>
              <input
                id="print-principal"
                type="text"
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Printer className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Cetak / Simpan PDF</span>
        </button>
      </div>

      {/* Lembar Pratinjau A4 */}
      <div className="print-only-sheet mx-auto max-w-[794px] rounded-xl border border-slate-200 bg-white p-8 text-slate-900 shadow-xs sm:p-12">
        {/* KOP SURAT RESMI */}
        <header className="border-b-4 border-double border-slate-900 pb-4 text-center">
          <div className="flex items-center justify-center gap-5">
            <svg
              viewBox="0 0 64 64"
              className="h-16 w-16 shrink-0 text-slate-900"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M32 6L10 14v18c0 14.5 9.4 24.4 22 28 12.6-3.6 22-13.5 22-28V14L32 6z"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <path d="M22 27h20M22 34h20M26 20h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-800">
                {SCHOOL_INFO.province}
              </p>
              <p className="text-sm font-bold tracking-wide text-slate-900">
                {SCHOOL_INFO.department}
              </p>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-slate-950">
                {SCHOOL_INFO.name}
              </h2>
              <p className="mt-1 text-xs text-slate-700">
                {SCHOOL_INFO.address}
              </p>
              <p className="text-xs text-slate-700">
                Telp. {SCHOOL_INFO.phone} · Email: {SCHOOL_INFO.email} · Laman: sman9sby.sch.id
              </p>
            </div>
          </div>
        </header>

        {docMode === 'surat' ? (
          <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-900">
            <div className="text-center">
              <h3 className="text-base font-bold uppercase underline underline-offset-4">
                {activeReq.serviceId === 'surat-tugas'
                  ? 'SURAT TUGAS'
                  : activeReq.serviceId === 'izin-kegiatan'
                    ? 'SURAT DISPENSASI KEGIATAN'
                    : activeReq.serviceId === 'rekomendasi'
                      ? 'SURAT REKOMENDASI'
                      : 'SURAT KETERANGAN'}
              </h3>
              <p className="mt-1 font-mono text-xs text-slate-700">
                Nomor : {displayLetterNo}
              </p>
            </div>

            <p>
              Yang bertanda tangan di bawah ini Kepala SMA Negeri 9 Surabaya, Kota Surabaya, Provinsi Jawa Timur menerangkan dengan sesungguhnya bahwa :
            </p>

            <table className="w-full max-w-xl text-sm">
              <tbody className="align-top">
                <tr>
                  <td className="w-44 py-1 text-slate-700">Nama Lengkap</td>
                  <td className="w-4 py-1">:</td>
                  <td className="py-1 font-semibold">{activeReq.applicantName}</td>
                </tr>
                <tr>
                  <td className="py-1 text-slate-700">
                    {activeReq.applicantRole === 'Guru / Tendik' ? 'NIP / NUPTK' : 'NISN / NIS'}
                  </td>
                  <td className="py-1">:</td>
                  <td className="py-1 font-mono tabular-nums">{activeReq.identityNumber}</td>
                </tr>
                <tr>
                  <td className="py-1 text-slate-700">Status / Kelas / Unit</td>
                  <td className="py-1">:</td>
                  <td className="py-1">
                    {activeReq.applicantRole} — {activeReq.classOrCohort}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-slate-700">Instansi / Sekolah</td>
                  <td className="py-1">:</td>
                  <td className="py-1">SMA Negeri 9 Surabaya</td>
                </tr>
              </tbody>
            </table>

            <p>
              Berdasarkan data pokok administrasi Tata Usaha SMA Negeri 9 Surabaya, yang bersangkutan tercatat secara resmi dan permohonan layanan{' '}
              <strong>{activeReq.serviceTitle}</strong> ini diterbitkan untuk keperluan:{' '}
              <strong>{activeReq.purpose}</strong>.
            </p>

            <p>
              Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.
            </p>

            <div className="flex justify-end pt-8">
              <div className="w-64 text-sm">
                <p>Surabaya, {formatTanggalSuratResmi(activeReq.updatedAt)}</p>
                <p className="mt-0.5 font-medium">Kepala Sekolah,</p>
                <div className="h-20" />
                <p className="font-bold underline underline-offset-2">{principalName}</p>
                <p className="font-mono text-xs text-slate-700">NIP. {principalNip}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6 text-sm text-slate-900">
            <div className="text-center">
              <h3 className="text-base font-bold uppercase underline underline-offset-4">
                TANDA TERIMA PELAYANAN TATA USAHA
              </h3>
              <p className="mt-1 font-mono text-xs text-slate-700">
                Kode Tiket : {activeReq.id}
              </p>
            </div>

            <div className="rounded-lg border border-slate-300 p-4">
              <dl className="grid grid-cols-1 gap-y-2.5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Nama Pemohon</dt>
                  <dd className="font-semibold">{activeReq.applicantName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">NISN / NIS / NIP</dt>
                  <dd className="font-mono tabular-nums">{activeReq.identityNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Jenis Layanan</dt>
                  <dd className="font-medium">{activeReq.serviceTitle}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Status Saat Ini</dt>
                  <dd className="font-semibold">{activeReq.status}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Tanggal Pengajuan</dt>
                  <dd className="font-mono text-xs tabular-nums">
                    {formatTanggalIndonesia(activeReq.createdAt, true)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Estimasi Selesai</dt>
                  <dd className="font-mono text-xs tabular-nums">
                    {formatTanggalIndonesia(activeReq.estimatedReadyAt)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Keperluan</dt>
                  <dd>{activeReq.purpose}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Berkas Persyaratan yang Tercatat:
              </h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
                {activeReq.submittedRequirements.length > 0 ? (
                  activeReq.submittedRequirements.map((r) => <li key={r}>{r}</li>)
                ) : (
                  <li>Verifikasi berkas fisik dilakukan langsung di Loket 1 Tata Usaha.</li>
                )}
              </ul>
            </div>

            <div className="flex items-end justify-between border-t border-slate-200 pt-6 text-xs text-slate-600">
              <div className="max-w-sm space-y-1">
                <p>
                  Tunjukkan bukti tanda terima atau sebutkan kode tiket saat mengambil dokumen di Loket Tata Usaha SMAN 9 Surabaya.
                </p>
                <p className="font-mono text-[11px] text-slate-500">
                  Lacak online: {SCHOOL_INFO.publicPortalUrl}
                </p>
              </div>
              <div className="w-52 text-center text-slate-900">
                <p>Surabaya, {formatTanggalSuratResmi(activeReq.createdAt)}</p>
                <p>Petugas Loket TU,</p>
                <div className="h-14" />
                <p className="font-semibold">{activeReq.assignedStaff}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
