import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  History,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  DataMovementDirection,
  DataMovementDomain,
  DataMovementLogEntry,
  DataMovementSource,
} from '../types/tu';
import { formatTanggalIndonesia } from '../utils/formatters';

interface DataMovementTrackerPanelProps {
  domain: DataMovementDomain;
  tahunPelajaran: string;
  logs: DataMovementLogEntry[];
}

const SOURCE_LABELS: Record<DataMovementSource, string> = {
  'impor-excel': 'Impor Excel / CSV',
  'input-manual': 'Input Manual',
  'perubahan-status': 'Mutasi / Status',
  'edit-data': 'Perubahan Data',
  'hapus-data': 'Hapus Data',
  'hapus-duplikat': 'Hapus Duplikat',
  'restore-backup': 'Restore Backup',
};

const DIRECTION_STYLES: Record<
  DataMovementDirection,
  { badgeClass: string; label: string }
> = {
  MASUK: {
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    label: 'DATA MASUK',
  },
  KELUAR: {
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-800',
    label: 'DATA KELUAR',
  },
  PERUBAHAN: {
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    label: 'PERUBAHAN',
  },
};

export function DataMovementTrackerPanel({
  domain,
  tahunPelajaran,
  logs,
}: DataMovementTrackerPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | DataMovementDirection>('ALL');

  const domainLogs = useMemo(
    () => logs.filter((entry) => entry.domain === domain),
    [logs, domain]
  );

  const stats = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    let perubahan = 0;
    for (const item of domainLogs) {
      if (item.direction === 'MASUK') masuk++;
      else if (item.direction === 'KELUAR') keluar++;
      else perubahan++;
    }
    return {
      total: domainLogs.length,
      masuk,
      keluar,
      perubahan,
    };
  }, [domainLogs]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return domainLogs.filter((entry) => {
      if (directionFilter !== 'ALL' && entry.direction !== directionFilter) return false;
      if (!q) return true;
      return (
        entry.nama.toLowerCase().includes(q) ||
        entry.identityNumber.toLowerCase().includes(q) ||
        entry.unitOrRole.toLowerCase().includes(q) ||
        entry.note.toLowerCase().includes(q) ||
        entry.actor.toLowerCase().includes(q) ||
        entry.tahunPelajaran.toLowerCase().includes(q)
      );
    });
  }, [domainLogs, searchQuery, directionFilter]);

  const handleExportExcel = () => {
    const rows = filtered.map((entry, idx) => ({
      No: idx + 1,
      Waktu: formatTanggalIndonesia(entry.timestamp, true),
      Arah: entry.direction,
      Sumber: SOURCE_LABELS[entry.source] || entry.source,
      'Tahun Pelajaran': entry.tahunPelajaran,
      Nama: entry.nama,
      [domain === 'siswa' ? 'NISN / NIPD' : 'NIP / NUPTK / NIK']: entry.identityNumber,
      [domain === 'siswa' ? 'Rombel' : 'Jabatan / Jenis PTK']: entry.unitOrRole,
      Status: entry.statusLabel,
      Keterangan: entry.note,
      Petugas: entry.actor,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      domain === 'siswa' ? 'Pelacakan Siswa' : 'Pelacakan GTK'
    );
    const dateSlug = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(
      wb,
      `pelacakan-keluar-masuk-${domain}-tp-${tahunPelajaran.replace('/', '-')}-${dateSlug}.xlsx`
    );
  };

  return (
    <div className="space-y-4">
      {/* KPI Ringkasan Pelacakan Keluar Masuk */}
      <div className="grid grid-cols-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <p className="text-xs font-medium text-slate-500">Total Pergerakan Data</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {stats.total}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Database TP {tahunPelajaran}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs font-medium text-slate-500">Data Masuk</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-emerald-700">
            {stats.masuk}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Impor baru, tambah manual, aktif kembali</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-medium text-slate-500">Data Keluar</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-rose-700">
            {stats.keluar}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Mutasi keluar, lulus, hapus, duplikat</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-medium text-slate-500">Perubahan Data</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-amber-700">
            {stats.perubahan}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Pembaruan rombel / jabatan / biodata</p>
        </div>
      </div>

      {/* Filter & Export Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari nama ${domain === 'siswa' ? 'peserta didik, NISN, rombel' : 'GTK, NIP, jabatan'}, keterangan, atau petugas...`}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { id: 'ALL', label: `Semua (${stats.total})` },
                  { id: 'MASUK', label: `Masuk (${stats.masuk})` },
                  { id: 'KELUAR', label: `Keluar (${stats.keluar})` },
                  { id: 'PERUBAHAN', label: `Ubah (${stats.perubahan})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDirectionFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    directionFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={filtered.length === 0}
              onClick={handleExportExcel}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ekspor Riwayat (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table of Movement Events */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <History className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-slate-900">
            Belum ada catatan keluar masuk data {domain === 'siswa' ? 'peserta didik' : 'GTK'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Setiap impor Excel, penambahan data, perubahan rombel/status, atau penghapusan akan terekam otomatis di sini.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[940px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Pergerakan</th>
                <th className="px-4 py-3">
                  {domain === 'siswa' ? 'Nama Siswa & NISN/NIPD' : 'Nama GTK & NIP/NUPTK'}
                </th>
                <th className="px-4 py-3">
                  {domain === 'siswa' ? 'Rombel & Status' : 'Jabatan & Kepegawaian'}
                </th>
                <th className="px-4 py-3">Sumber & Keterangan</th>
                <th className="px-4 py-3">TP & Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((entry) => {
                const dirStyle = DIRECTION_STYLES[entry.direction];
                return (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {formatTanggalIndonesia(entry.timestamp, true)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-bold ${dirStyle.badgeClass}`}
                      >
                        {entry.direction === 'MASUK' ? (
                          <ArrowDownLeft className="h-3 w-3" aria-hidden="true" />
                        ) : entry.direction === 'KELUAR' ? (
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span>{dirStyle.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{entry.nama}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {entry.identityNumber || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{entry.unitOrRole || '—'}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{entry.statusLabel}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[300px]">
                      <div className="font-semibold text-slate-700">
                        {SOURCE_LABELS[entry.source] || entry.source}
                      </div>
                      <div className="mt-0.5 text-slate-600">{entry.note}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-block rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-800">
                        TP {entry.tahunPelajaran}
                      </span>
                      <div className="mt-1 text-[11px] text-slate-500">{entry.actor}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
