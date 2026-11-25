import { ArrowRight, Check, Clock, Copy, ExternalLink, FileText, Globe, MapPin, Phone, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { SCHOOL_INFO, TU_SERVICE_CATALOG } from '../config/schoolConfig';
import { ServiceCategoryId, ServiceRequest } from '../types/tu';
import { formatTanggalIndonesia } from '../utils/formatters';
import { StatusIndicator } from './StatusIndicator';

interface OverviewViewProps {
  requests: ServiceRequest[];
  onStartRequest: (serviceId: ServiceCategoryId) => void;
  onSelectRequest: (req: ServiceRequest) => void;
  onNavigateQueue: (initialQuery?: string) => void;
  onTrackExact?: (query: string) => Promise<ServiceRequest | null>;
}

export function OverviewView({
  requests,
  onStartRequest,
  onSelectRequest,
  onNavigateQueue,
  onTrackExact,
}: OverviewViewProps) {
  const [trackingQuery, setTrackingQuery] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [copiedMode, setCopiedMode] = useState<'url' | 'wa' | null>(null);

  const handleCopyPublicUrl = async (mode: 'url' | 'wa') => {
    const text =
      mode === 'url'
        ? SCHOOL_INFO.publicPortalUrl
        : `Layanan Online Tata Usaha SMA Negeri 9 Surabaya (SIP TU) dapat diakses publik melalui alamat berikut:\n${SCHOOL_INFO.publicPortalUrl}\n\nJam layanan loket: ${SCHOOL_INFO.serviceHours}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMode(mode);
      window.setTimeout(() => setCopiedMode(null), 2500);
    } catch {
      // Clipboard API fallback ignored if restricted
    }
  };

  const totalCount = requests.length;
  const inProgressCount = requests.filter(
    (r) =>
      r.status === 'Diajukan' ||
      r.status === 'Verifikasi Berkas' ||
      r.status === 'Proses Pengetikan'
  ).length;
  const awaitingSignCount = requests.filter(
    (r) => r.status === 'Menunggu TTD Kepala Sekolah'
  ).length;
  const readyOrDoneCount = requests.filter(
    (r) => r.status === 'Siap Diambil' || r.status === 'Selesai'
  ).length;

  const handleQuickLookup = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = trackingQuery.trim().toLowerCase();
    if (!cleaned) {
      setLookupError('Masukkan kode tiket (mis. TU-2026-0148) atau NISN/NIP pemohon.');
      return;
    }
    const exact = requests.find(
      (r) =>
        r.id.toLowerCase() === cleaned ||
        r.identityNumber.toLowerCase() === cleaned
    );
    if (exact) {
      setLookupError('');
      onSelectRequest(exact);
      return;
    }
    if (onTrackExact) {
      const remoteExact = await onTrackExact(trackingQuery.trim());
      if (remoteExact) {
        setLookupError('');
        onSelectRequest(remoteExact);
        return;
      }
    }
    const partial = requests.filter(
      (r) =>
        r.id.toLowerCase().includes(cleaned) ||
        r.applicantName.toLowerCase().includes(cleaned) ||
        r.identityNumber.toLowerCase().includes(cleaned)
    );
    if (partial.length > 0) {
      setLookupError('');
      onNavigateQueue(trackingQuery.trim());
    } else {
      setLookupError(`Tidak ditemukan permohonan dengan kata kunci "${trackingQuery.trim()}".`);
    }
  };

  const recentRequests = [...requests]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Banner Identitas Sekolah & Lacak Tiket */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-12">
          <div className="relative min-h-[220px] bg-slate-900 lg:col-span-5">
            {!imageFailed ? (
              <img
                src={SCHOOL_INFO.campusImage}
                alt="Gedung SMA Negeri 9 Surabaya"
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-slate-300">
                <span className="text-sm font-medium">SMA Negeri 9 Surabaya</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <p className="text-xs font-medium text-blue-200">
                Sistem Informasi Pelayanan Tata Usaha
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-balance">
                SMA Negeri 9 Surabaya
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-200">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Jl. Wijaya Kusuma No. 48, Genteng</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="font-mono tabular-nums">{SCHOOL_INFO.phone}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between p-6 lg:col-span-7">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 text-balance">
                Lacak Status Permohonan & Layanan Administrasi Sekolah
              </h3>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                Ajukan surat keterangan siswa aktif, legalisir ijazah, mutasi, rekomendasi lomba,
                maupun perbaikan data Dapodik secara terstruktur tanpa antre berulang di loket.
              </p>

              <form onSubmit={handleQuickLookup} className="mt-5">
                <label htmlFor="quick-track-input" className="block text-xs font-medium text-slate-700">
                  Cek Progres Permohonan (Kode Tiket atau NISN / NIP)
                </label>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="quick-track-input"
                      type="text"
                      value={trackingQuery}
                      onChange={(e) => {
                        setTrackingQuery(e.target.value);
                        if (lookupError) setLookupError('');
                      }}
                      placeholder="Contoh: TU-2026-0148 atau 0094821735"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    <span>Lacak Tiket</span>
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </button>
                </div>
                {lookupError && (
                  <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                    {lookupError}
                  </p>
                )}
              </form>
            </div>

            <div className="mt-5 space-y-3 border-t border-slate-100 pt-3.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>Jam Layanan Loket TU:</span>
                </span>
                <span>{SCHOOL_INFO.serviceHours}</span>
              </div>

              <div className="flex flex-col justify-between gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden="true" />
                    <span>Alamat Browsing Publik Portal SIP TU:</span>
                  </div>
                  <a
                    href={SCHOOL_INFO.publicPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-blue-700 hover:underline"
                  >
                    <span className="truncate">{SCHOOL_INFO.publicPortalUrl}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                  </a>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleCopyPublicUrl('url')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                  >
                    {copiedMode === 'url' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        <span>Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Salin Link</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyPublicUrl('wa')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                  >
                    {copiedMode === 'wa' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        <span>Pesan Tersalin</span>
                      </>
                    ) : (
                      <span>Salin Info WA</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ringkasan KPI Loket */}
      <section aria-label="Ringkasan Antrean Layanan">
        <div className="grid grid-cols-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Total Permohonan</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
              {totalCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">Tercatat di sistem</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Verifikasi & Proses</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-blue-700">
              {inProgressCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">Sedang dikerjakan staf</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Menunggu TTD</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-amber-700">
              {awaitingSignCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">Meja Kepala Sekolah</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Siap Diambil / Selesai</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700">
              {readyOrDoneCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">Dokumen terverifikasi</p>
          </div>
        </div>
      </section>

      {/* Katalog Layanan Tata Usaha */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Katalog Layanan Tata Usaha
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">
              Pilih jenis administrasi yang dibutuhkan untuk mengisi formulir permohonan.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TU_SERVICE_CATALOG.map((service) => (
            <article
              key={service.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-medium text-slate-700">{service.code}</span>
                  <span aria-hidden="true">·</span>
                  <span>{service.targetAudience}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Estimasi {service.slaDays} hari kerja</span>
                </div>
                <h4 className="mt-2 text-base font-semibold text-slate-900">
                  {service.title}
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {service.description}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Syarat utama: {service.requirements[0]}
                </p>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-3.5">
                <button
                  type="button"
                  onClick={() => onStartRequest(service.id)}
                  className="inline-flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap"
                >
                  <span>Ajukan {service.shortTitle}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Antrean Terbaru */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-slate-900">
            Pembaruan Antrean Terkini
          </h3>
          <button
            type="button"
            onClick={() => onNavigateQueue()}
            className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap shrink-0"
          >
            Lihat semua antrean
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Kode Tiket</th>
                <th className="px-4 py-3">Pemohon</th>
                <th className="px-4 py-3">Jenis Layanan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Diperbarui</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRequests.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => onSelectRequest(req)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums text-blue-700">
                    {req.id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{req.applicantName}</div>
                    <div className="text-xs text-slate-500">
                      {req.applicantRole} · {req.classOrCohort}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="truncate max-w-[240px]">{req.serviceTitle}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusIndicator status={req.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-500">
                    {formatTanggalIndonesia(req.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
