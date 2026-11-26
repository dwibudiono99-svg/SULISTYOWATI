import {
  AlertTriangle,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Printer,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SCHOOL_INFO } from '../config/schoolConfig';
import { AgendaEntry, KopSuratConfig, ServiceRequest, UserMode } from '../types/tu';
import { formatTanggalIndonesia, formatTanggalSuratResmi } from '../utils/formatters';
import {
  downloadOfficialLetterPdf,
  downloadReceiptPdf,
  downloadRekapLaporanPdf,
} from '../utils/pdfExport';
import { KopSuratSettingsModal } from './KopSuratSettingsModal';

export type PrintDocumentMode = 'surat' | 'tanda-terima' | 'laporan';

interface DocumentPrintViewProps {
  requests: ServiceRequest[];
  agendaEntries: AgendaEntry[];
  userMode: UserMode;
  kopSurat: KopSuratConfig;
  onSaveKopSurat: (nextConfig: KopSuratConfig) => Promise<boolean>;
  selectedRequestId?: string;
  initialDocMode?: PrintDocumentMode;
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function formatMonthKeyLabel(key: string): string {
  if (key === 'ALL') return 'Semua Periode';
  const [year, monthStr] = key.split('-');
  const monthIdx = Number(monthStr) - 1;
  if (!year || Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return key;
  return `${MONTH_NAMES[monthIdx]} ${year}`;
}

function getMonthKey(dateStr: string): string | null {
  if (!dateStr) return null;
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) {
    const match = /^(\d{4})-(\d{2})/.exec(dateStr.trim());
    return match ? `${match[1]}-${match[2]}` : null;
  }
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function DocumentPrintView({
  requests,
  agendaEntries,
  userMode,
  kopSurat,
  onSaveKopSurat,
  selectedRequestId,
  initialDocMode = 'tanda-terima',
}: DocumentPrintViewProps) {
  const isPetugas = userMode === 'petugas';
  const [ticketId, setTicketId] = useState<string>(
    selectedRequestId || requests[0]?.id || ''
  );
  const [docMode, setDocMode] = useState<PrintDocumentMode>(
    isPetugas ? initialDocMode : 'tanda-terima'
  );
  const [reportPeriod, setReportPeriod] = useState<string>('ALL');
  const [principalName, setPrincipalName] = useState(kopSurat.principalName);
  const [principalNip, setPrincipalNip] = useState(kopSurat.principalNip);
  const [kopModalOpen, setKopModalOpen] = useState(false);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [printBlockedNotice, setPrintBlockedNotice] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [failedLogoSrcs, setFailedLogoSrcs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setPrincipalName(kopSurat.principalName);
    setPrincipalNip(kopSurat.principalNip);
    setFailedLogoSrcs({});
  }, [kopSurat]);

  useEffect(() => {
    if (selectedRequestId) {
      setTicketId(selectedRequestId);
    }
  }, [selectedRequestId]);

  useEffect(() => {
    if (requests.length > 0 && !requests.some((r) => r.id === ticketId)) {
      setTicketId(requests[0].id);
    }
  }, [requests, ticketId]);

  useEffect(() => {
    setDocMode(isPetugas ? initialDocMode : 'tanda-terima');
  }, [initialDocMode, isPetugas]);

  const activeReq = requests.find((r) => r.id === ticketId) ?? requests[0];

  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    for (const r of requests) {
      const k = getMonthKey(r.createdAt);
      if (k) set.add(k);
    }
    for (const a of agendaEntries) {
      const k = getMonthKey(a.letterDate || a.recordedDate);
      if (k) set.add(k);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [agendaEntries, requests]);

  const filteredReportRequests = useMemo(() => {
    if (reportPeriod === 'ALL') return requests;
    return requests.filter((r) => getMonthKey(r.createdAt) === reportPeriod);
  }, [reportPeriod, requests]);

  const filteredReportAgenda = useMemo(() => {
    if (reportPeriod === 'ALL') return agendaEntries;
    return agendaEntries.filter(
      (a) => getMonthKey(a.letterDate || a.recordedDate) === reportPeriod
    );
  }, [agendaEntries, reportPeriod]);

  const handlePrint = () => {
    setPrintBlockedNotice(false);
    setPdfError(null);

    let printDialogOpened = false;
    const onBeforePrint = () => {
      printDialogOpened = true;
    };

    window.addEventListener('beforeprint', onBeforePrint, { once: true });

    try {
      window.print();
    } catch {
      setPrintBlockedNotice(true);
    }

    window.setTimeout(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      if (!printDialogOpened) {
        setPrintBlockedNotice(true);
      }
    }, 450);
  };

  const handleDownloadPdf = async () => {
    setPdfError(null);
    setPrintBlockedNotice(false);
    setIsExportingPdf(true);
    try {
      if (docMode === 'laporan' && isPetugas) {
        await downloadRekapLaporanPdf({
          requests: filteredReportRequests,
          agendaEntries: filteredReportAgenda,
          kopSurat,
          periodLabel: formatMonthKeyLabel(reportPeriod),
          principalName,
          principalNip,
        });
      } else if (docMode === 'surat' && isPetugas && activeReq) {
        await downloadOfficialLetterPdf({
          request: activeReq,
          kopSurat,
          principalName,
          principalNip,
        });
      } else if (activeReq) {
        await downloadReceiptPdf({
          request: activeReq,
          kopSurat,
        });
      }
    } catch {
      setPdfError(
        'Gagal membuat berkas PDF. Periksa kembali gambar Kop Surat atau muat ulang halaman.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const canRenderSheet = docMode === 'laporan' ? isPetugas : Boolean(activeReq);
  const displayLetterNo = activeReq?.letterNumber || '421.3/___/101.6.1.9/2026';
  const dividerClass =
    kopSurat.dividerStyle === 'double'
      ? 'border-b-4 border-double border-slate-900'
      : kopSurat.dividerStyle === 'thick-thin'
        ? 'border-b-[3px] border-slate-900'
        : 'border-b border-slate-900';

  const submittedRequirements = Array.isArray(activeReq?.submittedRequirements)
    ? activeReq.submittedRequirements
    : [];

  const reportSummary = useMemo(() => {
    const total = filteredReportRequests.length;
    const proses = filteredReportRequests.filter(
      (r) =>
        r.status === 'Diajukan' ||
        r.status === 'Verifikasi Berkas' ||
        r.status === 'Proses Pengetikan' ||
        r.status === 'Menunggu TTD Kepala Sekolah'
    ).length;
    const selesai = filteredReportRequests.filter(
      (r) => r.status === 'Siap Diambil' || r.status === 'Selesai'
    ).length;
    const revisi = filteredReportRequests.filter(
      (r) => r.status === 'Perlu Perbaikan'
    ).length;
    return { total, proses, selesai, revisi };
  }, [filteredReportRequests]);

  return (
    <div className="space-y-6">
      {/* Toolbar Kontrol Cetak */}
      <div className="no-print space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div
            className={`grid flex-1 grid-cols-1 gap-3 ${
              isPetugas ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            }`}
          >
            <div>
              <label htmlFor="print-mode" className="block text-xs font-medium text-slate-700">
                Jenis Dokumen Cetak
              </label>
              <select
                id="print-mode"
                value={docMode}
                onChange={(e) => {
                  setPrintBlockedNotice(false);
                  setPdfError(null);
                  setDocMode(e.target.value as PrintDocumentMode);
                }}
                disabled={!isPetugas}
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 disabled:bg-slate-50"
              >
                <option value="tanda-terima">Tanda Terima Loket TU</option>
                {isPetugas && (
                  <>
                    <option value="surat">Draf Surat Resmi (Kop Sekolah)</option>
                    <option value="laporan">Laporan Rekapitulasi Pelayanan & Agenda TU</option>
                  </>
                )}
              </select>
            </div>

            {docMode === 'laporan' && isPetugas ? (
              <div>
                <label htmlFor="print-period" className="block text-xs font-medium text-slate-700">
                  Periode Laporan
                </label>
                <select
                  id="print-period"
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                >
                  <option value="ALL">Semua Periode</option>
                  {availablePeriods.map((period) => (
                    <option key={period} value={period}>
                      {formatMonthKeyLabel(period)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label htmlFor="print-ticket" className="block text-xs font-medium text-slate-700">
                  Pilih Tiket Permohonan
                </label>
                <select
                  id="print-ticket"
                  value={activeReq?.id || ''}
                  onChange={(e) => setTicketId(e.target.value)}
                  disabled={requests.length === 0}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 disabled:bg-slate-50"
                >
                  {requests.length === 0 ? (
                    <option value="">Belum ada tiket permohonan</option>
                  ) : (
                    requests.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} — {r.applicantName}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isPetugas && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void onSaveKopSurat({ ...kopSurat, showKopSurat: !kopSurat.showKopSurat })
                  }
                  className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    kopSurat.showKopSurat
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  {kopSurat.showKopSurat ? (
                    <>
                      <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Kop Ditampilkan</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Kop Disembunyikan</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setKopModalOpen(true)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Atur Kop Surat</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={!canRenderSheet || isExportingPdf}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-700 px-3.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {isExportingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{isExportingPdf ? 'Menyiapkan PDF...' : 'Unduh PDF (A4)'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={!canRenderSheet}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Cetak Printer</span>
            </button>
          </div>
        </div>

        {printBlockedNotice && (
          <div
            role="status"
            className="flex flex-col justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  Dialog cetak langsung diblokir oleh jendela pratinjau browser (iframe).
                </p>
                <p className="mt-0.5 text-amber-900">
                  Klik <strong>Unduh PDF (A4)</strong> untuk menyimpan berkas siap cetak, atau buka portal publik di tab baru untuk mencetak langsung ke printer.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={isExportingPdf}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Unduh PDF Sekarang</span>
              </button>
              <a
                href={SCHOOL_INFO.publicPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-white px-2.5 py-1.5 font-semibold text-amber-950 hover:bg-amber-100 whitespace-nowrap"
              >
                <span>Buka Tab Baru</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        )}

        {pdfError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
          >
            {pdfError}
          </div>
        )}
      </div>

      {/* Lembar Pratinjau A4 */}
      {!canRenderSheet ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Belum ada permohonan surat yang dapat dicetak. Ajukan permohonan terlebih dahulu atau pilih mode <strong>Laporan Rekapitulasi</strong> pada Portal Petugas TU.
        </div>
      ) : (
        <div className="print-only-sheet mx-auto max-w-[794px] rounded-xl border border-slate-200 bg-white p-8 text-slate-900 shadow-xs sm:p-12">
          {/* KOP SURAT RESMI */}
          {!kopSurat.showKopSurat ? (
            <>
              <div className="no-print mb-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-xs text-slate-600">
                Kop Surat disembunyikan. Lembar siap dicetak di atas kertas ber-kop fisik SMA Negeri 9 Surabaya (ruang atas otomatis disiapkan saat cetak/PDF).
              </div>
              <div className="hidden print:block h-28" aria-hidden="true" />
            </>
          ) : kopSurat.mode === 'upload-banner' &&
            kopSurat.bannerImageDataUrl &&
            !failedLogoSrcs[kopSurat.bannerImageDataUrl] ? (
            <header className="pb-3 text-center">
              <img
                src={kopSurat.bannerImageDataUrl}
                alt={`Kop Surat ${kopSurat.schoolNameLine || SCHOOL_INFO.name}`}
                onError={() =>
                  setFailedLogoSrcs((prev) => ({
                    ...prev,
                    [kopSurat.bannerImageDataUrl]: true,
                  }))
                }
                className="mx-auto max-h-40 w-full object-contain"
              />
            </header>
          ) : (
            <header className={`${dividerClass} pb-4 text-center`}>
              <div className="flex items-center justify-center gap-5">
                {kopSurat.leftLogoDataUrl && !failedLogoSrcs[kopSurat.leftLogoDataUrl] ? (
                  <img
                    src={kopSurat.leftLogoDataUrl}
                    alt="Logo instansi kiri"
                    onError={() =>
                      setFailedLogoSrcs((prev) => ({
                        ...prev,
                        [kopSurat.leftLogoDataUrl]: true,
                      }))
                    }
                    className="h-16 w-16 shrink-0 object-contain"
                  />
                ) : (
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
                    <path
                      d="M22 27h20M22 34h20M26 20h12"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}

                <div className="min-w-0 flex-1">
                  {kopSurat.provinceLine && (
                    <p className="text-sm font-medium tracking-wide text-slate-900">
                      {kopSurat.provinceLine}
                    </p>
                  )}
                  {kopSurat.departmentLine && (
                    <p className="text-sm font-semibold tracking-wide text-slate-900">
                      {kopSurat.departmentLine}
                    </p>
                  )}
                  <h2 className="mt-0.5 text-xl font-bold tracking-wide text-slate-950">
                    {kopSurat.schoolNameLine || SCHOOL_INFO.name}
                  </h2>
                  {kopSurat.addressLine && (
                    <p className="mt-0.5 text-xs text-slate-800">{kopSurat.addressLine}</p>
                  )}
                  {kopSurat.contactLine && (
                    <p className="text-xs text-slate-800">{kopSurat.contactLine}</p>
                  )}
                  {kopSurat.websiteLine && (
                    <p className="text-xs text-slate-800">{kopSurat.websiteLine}</p>
                  )}
                </div>

                {kopSurat.rightLogoDataUrl && !failedLogoSrcs[kopSurat.rightLogoDataUrl] ? (
                  <img
                    src={kopSurat.rightLogoDataUrl}
                    alt="Logo instansi kanan"
                    onError={() =>
                      setFailedLogoSrcs((prev) => ({
                        ...prev,
                        [kopSurat.rightLogoDataUrl]: true,
                      }))
                    }
                    className="h-16 w-16 shrink-0 object-contain"
                  />
                ) : null}
              </div>
            </header>
          )}

          {docMode === 'laporan' && isPetugas ? (
            <div className="mt-7 space-y-6 text-xs text-slate-900">
              <div className="text-center">
                <h3 className="text-base font-bold uppercase underline underline-offset-4">
                  LAPORAN REKAPITULASI PELAYANAN & AGENDA TATA USAHA
                </h3>
                <p className="mt-1 text-xs text-slate-700">
                  Periode: <strong>{formatMonthKeyLabel(reportPeriod)}</strong> · Dicetak:{' '}
                  {formatTanggalSuratResmi(new Date().toISOString())}
                </p>
              </div>

              <div className="grid grid-cols-2 divide-y divide-slate-300 border border-slate-300 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
                <div className="p-2.5 text-center">
                  <p className="text-[11px] text-slate-600">Total Permohonan</p>
                  <p className="mt-0.5 font-mono text-base font-bold tabular-nums">
                    {reportSummary.total}
                  </p>
                </div>
                <div className="p-2.5 text-center">
                  <p className="text-[11px] text-slate-600">Proses / TTD</p>
                  <p className="mt-0.5 font-mono text-base font-bold tabular-nums">
                    {reportSummary.proses}
                  </p>
                </div>
                <div className="p-2.5 text-center">
                  <p className="text-[11px] text-slate-600">Siap / Selesai</p>
                  <p className="mt-0.5 font-mono text-base font-bold tabular-nums">
                    {reportSummary.selesai}
                  </p>
                </div>
                <div className="p-2.5 text-center">
                  <p className="text-[11px] text-slate-600">Perlu Perbaikan</p>
                  <p className="mt-0.5 font-mono text-base font-bold tabular-nums">
                    {reportSummary.revisi}
                  </p>
                </div>
                <div className="p-2.5 text-center">
                  <p className="text-[11px] text-slate-600">Agenda Surat</p>
                  <p className="mt-0.5 font-mono text-base font-bold tabular-nums">
                    {filteredReportAgenda.length}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                  A. Rekapitulasi Permohonan Layanan Administrasi
                </h4>
                <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 font-semibold text-slate-800">
                      <th className="border border-slate-300 px-2 py-1.5">Tiket</th>
                      <th className="border border-slate-300 px-2 py-1.5">Pemohon</th>
                      <th className="border border-slate-300 px-2 py-1.5">Jenis Layanan</th>
                      <th className="border border-slate-300 px-2 py-1.5">No. Surat</th>
                      <th className="border border-slate-300 px-2 py-1.5">Status</th>
                      <th className="border border-slate-300 px-2 py-1.5">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReportRequests.length > 0 ? (
                      filteredReportRequests.map((item) => (
                        <tr key={item.id}>
                          <td className="border border-slate-300 px-2 py-1.5 font-mono tabular-nums whitespace-nowrap">
                            {item.id}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5">
                            <span className="font-medium">
                              {item.applicantName}
                              {Array.isArray(item.participants) && item.participants.length > 1
                                ? ` dkk (${item.participants.length} peserta)`
                                : ''}
                            </span>
                            <span className="block text-[10px] text-slate-600">
                              {item.classOrCohort || item.applicantRole}
                            </span>
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5">{item.serviceTitle}</td>
                          <td className="border border-slate-300 px-2 py-1.5 font-mono text-[10px]">
                            {item.letterNumber || '-'}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5">{item.status}</td>
                          <td className="border border-slate-300 px-2 py-1.5 font-mono tabular-nums whitespace-nowrap">
                            {formatTanggalIndonesia(item.createdAt)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="border border-slate-300 px-3 py-4 text-center text-slate-500"
                        >
                          Belum ada permohonan tercatat pada periode ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                  B. Rekapitulasi Buku Agenda Surat Masuk & Keluar
                </h4>
                <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 font-semibold text-slate-800">
                      <th className="border border-slate-300 px-2 py-1.5">No. Agenda</th>
                      <th className="border border-slate-300 px-2 py-1.5">Jenis</th>
                      <th className="border border-slate-300 px-2 py-1.5">Nomor Surat</th>
                      <th className="border border-slate-300 px-2 py-1.5">Instansi</th>
                      <th className="border border-slate-300 px-2 py-1.5">Perihal</th>
                      <th className="border border-slate-300 px-2 py-1.5">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReportAgenda.length > 0 ? (
                      filteredReportAgenda.map((ag) => (
                        <tr key={ag.id}>
                          <td className="border border-slate-300 px-2 py-1.5 font-mono tabular-nums whitespace-nowrap">
                            {ag.agendaNumber}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 whitespace-nowrap">
                            {ag.type}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 font-mono text-[10px]">
                            {ag.letterNumber}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5">{ag.counterparty}</td>
                          <td className="border border-slate-300 px-2 py-1.5">{ag.subject}</td>
                          <td className="border border-slate-300 px-2 py-1.5 font-mono tabular-nums whitespace-nowrap">
                            {formatTanggalIndonesia(ag.letterDate)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="border border-slate-300 px-3 py-4 text-center text-slate-500"
                        >
                          Belum ada entri buku agenda pada periode ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-6 pt-6 text-xs">
                <div className="w-56">
                  <p>Mengetahui,</p>
                  <p className="mt-0.5 font-medium">Koordinator Tata Usaha,</p>
                  <div className="h-16" />
                  <p className="font-bold underline underline-offset-2">
                    {SCHOOL_INFO.staffName}
                  </p>
                </div>
                <div className="w-64">
                  <p>
                    {kopSurat.cityName || 'Surabaya'},{' '}
                    {formatTanggalSuratResmi(new Date().toISOString())}
                  </p>
                  <p className="mt-0.5 font-medium">
                    {kopSurat.principalTitle || 'Kepala Sekolah,'}
                  </p>
                  <div className="h-16" />
                  <p className="font-bold underline underline-offset-2">{principalName}</p>
                  <p className="font-mono text-[11px] text-slate-700">NIP. {principalNip}</p>
                </div>
              </div>
            </div>
          ) : docMode === 'surat' && activeReq ? (
            (() => {
              const groupParticipants =
                Array.isArray(activeReq.participants) && activeReq.participants.length > 1
                  ? activeReq.participants
                  : null;
              const isGroupAssignment = Boolean(groupParticipants);
              const introSentence = isGroupAssignment
                ? activeReq.serviceId === 'surat-tugas'
                  ? 'Yang bertanda tangan di bawah ini Kepala SMA Negeri 9 Surabaya, Kota Surabaya, Provinsi Jawa Timur menugaskan kepada nama-nama tersebut di bawah ini :'
                  : activeReq.serviceId === 'izin-kegiatan'
                    ? 'Yang bertanda tangan di bawah ini Kepala SMA Negeri 9 Surabaya, Kota Surabaya, Provinsi Jawa Timur memberikan izin / dispensasi kegiatan kepada peserta didik dan/atau pembina berikut :'
                    : activeReq.serviceId === 'rekomendasi'
                      ? 'Yang bertanda tangan di bawah ini Kepala SMA Negeri 9 Surabaya, Kota Surabaya, Provinsi Jawa Timur memberikan rekomendasi untuk mengikuti kegiatan kepada nama-nama berikut :'
                      : 'Yang bertanda tangan di bawah ini Kepala SMA Negeri 9 Surabaya, Kota Surabaya, Provinsi Jawa Timur menerangkan dengan sesungguhnya bahwa nama-nama berikut :'
                : 'Yang bertanda tangan di bawah ini Kepala SMA Negeri 9 Surabaya, Kota Surabaya, Provinsi Jawa Timur menerangkan dengan sesungguhnya bahwa :';

              return (
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

                  <p>{introSentence}</p>

                  {groupParticipants ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-slate-800 text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 font-bold text-slate-900">
                            <th className="w-10 border border-slate-800 px-2.5 py-2 text-center">No</th>
                            <th className="border border-slate-800 px-2.5 py-2">Nama Lengkap</th>
                            <th className="border border-slate-800 px-2.5 py-2">NISN / NIS / NIP</th>
                            <th className="border border-slate-800 px-2.5 py-2">Kelas / Jabatan</th>
                            <th className="border border-slate-800 px-2.5 py-2">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupParticipants.map((p, idx) => (
                            <tr key={p.id}>
                              <td className="border border-slate-800 px-2.5 py-1.5 text-center font-mono tabular-nums">
                                {idx + 1}
                              </td>
                              <td className="border border-slate-800 px-2.5 py-1.5 font-semibold">
                                {p.nama}
                              </td>
                              <td className="border border-slate-800 px-2.5 py-1.5 font-mono tabular-nums">
                                {p.identityNumber || '-'}
                              </td>
                              <td className="border border-slate-800 px-2.5 py-1.5">
                                {p.classOrCohort || '-'}
                              </td>
                              <td className="border border-slate-800 px-2.5 py-1.5">
                                {p.roleLabel || 'Peserta'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
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
                  )}

                  <p>
                    {isGroupAssignment ? (
                      <>
                        Berdasarkan data administrasi Tata Usaha SMA Negeri 9 Surabaya, nama-nama tersebut di atas ({groupParticipants!.length} orang) secara resmi tercatat dan diterbitkan surat{' '}
                        <strong>{activeReq.serviceTitle}</strong> untuk keperluan/kegiatan:{' '}
                        <strong>{activeReq.purpose}</strong>.
                      </>
                    ) : (
                      <>
                        Berdasarkan data pokok administrasi Tata Usaha SMA Negeri 9 Surabaya, yang bersangkutan tercatat secara resmi dan permohonan layanan{' '}
                        <strong>{activeReq.serviceTitle}</strong> ini diterbitkan untuk keperluan:{' '}
                        <strong>{activeReq.purpose}</strong>.
                      </>
                    )}
                  </p>

                  <p>
                    {isGroupAssignment
                      ? 'Demikian surat ini dibuat dengan sebenarnya agar dapat dilaksanakan penuh tanggung jawab dan dipergunakan sebagaimana mestinya.'
                      : 'Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.'}
                  </p>

                  <div className="flex justify-end pt-8">
                    <div className="w-64 text-sm">
                      <p>
                        {kopSurat.cityName || 'Surabaya'},{' '}
                        {formatTanggalSuratResmi(activeReq.updatedAt || new Date().toISOString())}
                      </p>
                      <p className="mt-0.5 font-medium">{kopSurat.principalTitle || 'Kepala Sekolah,'}</p>
                      <div className="h-20" />
                      <p className="font-bold underline underline-offset-2">{principalName}</p>
                      <p className="font-mono text-xs text-slate-700">NIP. {principalNip}</p>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : activeReq ? (
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
                    <dt className="text-xs text-slate-500">Nama Pemohon / Penanggung Jawab</dt>
                    <dd className="font-semibold">
                      {activeReq.applicantName}
                      {Array.isArray(activeReq.participants) && activeReq.participants.length > 1
                        ? ` dkk (${activeReq.participants.length} peserta)`
                        : ''}
                    </dd>
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

              {Array.isArray(activeReq.participants) && activeReq.participants.length > 1 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Daftar Peserta Tercatat ({activeReq.participants.length} Orang):
                  </h4>
                  <table className="w-full border-collapse border border-slate-300 text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 font-semibold text-slate-800">
                        <th className="w-9 border border-slate-300 px-2 py-1.5 text-center">No</th>
                        <th className="border border-slate-300 px-2 py-1.5">Nama Lengkap</th>
                        <th className="border border-slate-300 px-2 py-1.5">NISN / NIP</th>
                        <th className="border border-slate-300 px-2 py-1.5">Kelas / Jabatan</th>
                        <th className="border border-slate-300 px-2 py-1.5">Peran</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeReq.participants.map((p, idx) => (
                        <tr key={p.id}>
                          <td className="border border-slate-300 px-2 py-1.5 text-center font-mono tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 font-medium">{p.nama}</td>
                          <td className="border border-slate-300 px-2 py-1.5 font-mono tabular-nums">
                            {p.identityNumber || '-'}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5">{p.classOrCohort || '-'}</td>
                          <td className="border border-slate-300 px-2 py-1.5">{p.roleLabel || 'Peserta'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Berkas Persyaratan yang Tercatat:
                </h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
                  {submittedRequirements.length > 0 ? (
                    submittedRequirements.map((r) => <li key={r}>{r}</li>)
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
                  <p>
                    {kopSurat.cityName || 'Surabaya'},{' '}
                    {formatTanggalSuratResmi(activeReq.createdAt || new Date().toISOString())}
                  </p>
                  <p>Petugas Loket TU,</p>
                  <div className="h-14" />
                  <p className="font-semibold">{activeReq.assignedStaff}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <KopSuratSettingsModal
        open={kopModalOpen}
        config={kopSurat}
        onClose={() => setKopModalOpen(false)}
        onSave={onSaveKopSurat}
      />
    </div>
  );
}
