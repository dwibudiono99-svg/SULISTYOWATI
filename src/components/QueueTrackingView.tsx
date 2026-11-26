import { FilePlus2, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TU_SERVICE_CATALOG } from '../config/schoolConfig';
import { RequestStatus, ServiceRequest } from '../types/tu';
import { formatTanggalIndonesia } from '../utils/formatters';
import { StatusIndicator } from './StatusIndicator';

interface QueueTrackingViewProps {
  requests: ServiceRequest[];
  initialSearch?: string;
  onSelectRequest: (request: ServiceRequest) => void;
  onNavigateCreate: () => void;
  onTrackExact?: (query: string) => Promise<ServiceRequest | null>;
  onRefresh?: () => Promise<void> | void;
}

const STATUS_FILTERS: { label: string; value: 'ALL' | RequestStatus }[] = [
  { label: 'Semua', value: 'ALL' },
  { label: 'Diajukan', value: 'Diajukan' },
  { label: 'Verifikasi Berkas', value: 'Verifikasi Berkas' },
  { label: 'Proses Pengetikan', value: 'Proses Pengetikan' },
  { label: 'Menunggu TTD Kepala Sekolah', value: 'Menunggu TTD Kepala Sekolah' },
  { label: 'Siap Diambil', value: 'Siap Diambil' },
  { label: 'Selesai', value: 'Selesai' },
  { label: 'Perlu Perbaikan', value: 'Perlu Perbaikan' },
];

export function QueueTrackingView({
  requests,
  initialSearch = '',
  onSelectRequest,
  onNavigateCreate,
  onTrackExact,
  onRefresh,
}: QueueTrackingViewProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<'ALL' | RequestStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!onTrackExact || trimmed.length < 4) return;
    const timer = window.setTimeout(() => {
      void onTrackExact(trimmed);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery, onTrackExact]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...requests]
      .filter((req) => {
        if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
        if (categoryFilter !== 'ALL' && req.serviceId !== categoryFilter) return false;
        if (!q) return true;
        return (
          req.id.toLowerCase().includes(q) ||
          req.applicantName.toLowerCase().includes(q) ||
          req.identityNumber.toLowerCase().includes(q) ||
          req.purpose.toLowerCase().includes(q) ||
          (req.letterNumber?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [requests, searchQuery, statusFilter, categoryFilter]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode tiket, nama pemohon, NISN/NIP, atau nomor surat..."
              aria-label="Cari antrean permohonan"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter jenis layanan"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="ALL">Semua Jenis Layanan</option>
            {TU_SERVICE_CATALOG.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.code} — {cat.shortTitle}
              </option>
            ))}
          </select>

          {onRefresh && (
            <button
              type="button"
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await onRefresh();
                } finally {
                  setIsRefreshing(false);
                }
              }}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Muat Ulang</span>
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-slate-900">
            Tidak ada permohonan yang cocok dengan filter
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Ubah kata kunci pencarian atau ajukan permohonan layanan Tata Usaha baru.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            {(searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset Filter
              </button>
            )}
            <button
              type="button"
              onClick={onNavigateCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              <FilePlus2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Ajukan Permohonan</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Kode Tiket</th>
                <th className="px-4 py-3">Pemohon & Identitas</th>
                <th className="px-4 py-3">Layanan & Keperluan</th>
                <th className="px-4 py-3">Nomor Surat</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Tanggal Masuk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => onSelectRequest(req)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums text-blue-700 whitespace-nowrap">
                    {req.id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{req.applicantName}</div>
                    <div className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                      {req.applicantRole} · {req.identityNumber} · {req.classOrCohort}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{req.serviceTitle}</div>
                    <div className="mt-0.5 line-clamp-1 max-w-xs text-xs text-slate-500">
                      {req.purpose}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                    {req.letterNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusIndicator status={req.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
                    {formatTanggalIndonesia(req.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
