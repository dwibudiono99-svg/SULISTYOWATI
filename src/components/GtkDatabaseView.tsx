import {
  AlertTriangle,
  ArrowRightLeft,
  Camera,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  Upload,
  User,
  XCircle,
} from 'lucide-react';
import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { DapodikGtk, DukcapilMatchStatus } from '../types/tu';
import {
  formatPtkDisplayName,
  padankanNikDispendukcapil,
} from '../utils/gtkDapodikValidation';
import { processPtkPhotoFile } from '../utils/ptkPhotoHelper';
import { ImportMergeMode } from './DapodikImportExportModal';
import { GtkDetailModal } from './GtkDetailModal';
import { GtkImportExportModal } from './GtkImportExportModal';

interface GtkDatabaseViewProps {
  gtkList: DapodikGtk[];
  onSaveGtk: (gtk: DapodikGtk, isNew: boolean) => void;
  onDeleteGtk: (id: string) => void;
  onImportGtk: (imported: DapodikGtk[], mode: ImportMergeMode) => Promise<boolean | void> | void;
  onBatchPadanDispendukcapil: () => Promise<void>;
  onCreateLetterFromGtk: (gtk: DapodikGtk) => void;
  onOpenTuStaffSettings?: () => void;
}

type KepegawaianFilter = 'ALL' | 'PNS' | 'PPPK' | 'PPPK Paruh Waktu' | 'NON-ASN';

function getInitials(name: string): string {
  const parts = name
    .replace(/,.*$/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'PTK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function GtkDatabaseView({
  gtkList,
  onSaveGtk,
  onDeleteGtk,
  onImportGtk,
  onBatchPadanDispendukcapil,
  onCreateLetterFromGtk,
  onOpenTuStaffSettings,
}: GtkDatabaseViewProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [kepegawaianFilter, setKepegawaianFilter] = useState<KepegawaianFilter>('ALL');
  const [matchFilter, setMatchFilter] = useState<'ALL' | DukcapilMatchStatus>('ALL');
  const [inspectedGtk, setInspectedGtk] = useState<DapodikGtk | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'import' | 'export'>('import');
  const [runningBatch, setRunningBatch] = useState(false);
  const [photoTargetGtk, setPhotoTargetGtk] = useState<DapodikGtk | null>(null);
  const [photoError, setPhotoError] = useState('');
  const quickPhotoInputRef = useRef<HTMLInputElement>(null);

  const enriched = useMemo(
    () =>
      gtkList.map((gtk) => ({
        gtk,
        displayName: formatPtkDisplayName(gtk),
        check: padankanNikDispendukcapil(gtk),
      })),
    [gtkList]
  );

  const stats = useMemo(() => {
    const total = enriched.length;
    const padan = enriched.filter((e) => e.check.status === 'Padan Dispendukcapil').length;
    const residu = enriched.filter((e) => e.check.status === 'Residu Data').length;
    const invalid = enriched.filter((e) => e.check.status === 'Tidak Padan NIK').length;
    const withPhoto = enriched.filter((e) => Boolean(e.gtk.fotoDataUrl)).length;
    return { total, padan, residu, invalid, withPhoto };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enriched.filter(({ gtk, displayName, check }) => {
      if (
        kepegawaianFilter === 'PNS' &&
        gtk.statusKepegawaian !== 'PNS' &&
        gtk.statusKepegawaian !== 'CPNS'
      ) {
        return false;
      }
      if (kepegawaianFilter === 'PPPK' && gtk.statusKepegawaian !== 'PPPK') {
        return false;
      }
      if (
        kepegawaianFilter === 'PPPK Paruh Waktu' &&
        gtk.statusKepegawaian !== 'PPPK Paruh Waktu'
      ) {
        return false;
      }
      if (
        kepegawaianFilter === 'NON-ASN' &&
        (gtk.statusKepegawaian === 'PNS' ||
          gtk.statusKepegawaian === 'CPNS' ||
          gtk.statusKepegawaian === 'PPPK' ||
          gtk.statusKepegawaian === 'PPPK Paruh Waktu')
      ) {
        return false;
      }
      if (matchFilter !== 'ALL' && check.status !== matchFilter) return false;
      if (!q) return true;
      return (
        displayName.toLowerCase().includes(q) ||
        gtk.nama.toLowerCase().includes(q) ||
        gtk.nik.toLowerCase().includes(q) ||
        gtk.nip.toLowerCase().includes(q) ||
        gtk.nuptk.toLowerCase().includes(q) ||
        (gtk.jabatanPtk || '').toLowerCase().includes(q) ||
        (gtk.mengajar || '').toLowerCase().includes(q) ||
        (gtk.tugasTambahan || '').toLowerCase().includes(q) ||
        (gtk.jurusanProdi || '').toLowerCase().includes(q) ||
        gtk.jenisPtk.toLowerCase().includes(q)
      );
    });
  }, [enriched, searchQuery, kepegawaianFilter, matchFilter]);

  const handleBatchCheck = async () => {
    setRunningBatch(true);
    await onBatchPadanDispendukcapil();
    setRunningBatch(false);
  };

  const triggerQuickPhotoUpload = (gtk: DapodikGtk) => {
    setPhotoError('');
    setPhotoTargetGtk(gtk);
    quickPhotoInputRef.current?.click();
  };

  const handleQuickPhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (quickPhotoInputRef.current) quickPhotoInputRef.current.value = '';
    const target = photoTargetGtk;
    setPhotoTargetGtk(null);
    if (!file || !target) return;

    try {
      const dataUrl = await processPtkPhotoFile(file);
      onSaveGtk({ ...target, fotoDataUrl: dataUrl }, false);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Gagal mengunggah foto PTK.');
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={quickPhotoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => void handleQuickPhotoChange(e)}
        className="hidden"
      />

      {/* KPI Profil PTK & Padan Dispendukcapil */}
      <section aria-label="Ringkasan Profil PTK dan Padan NIK Dispendukcapil">
        <div className="grid grid-cols-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Total PTK Dapodik</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
              {stats.total}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {stats.withPhoto} PTK memiliki foto profil
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Padan Dispendukcapil</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700">
              {stats.padan}
            </p>
            <p className="mt-1 text-xs text-slate-500">NIK, Wilayah, Tgl Lahir, JK & Ibu cocok</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Residu VervalPTK</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-amber-700">
              {stats.residu}
            </p>
            <p className="mt-1 text-xs text-slate-500">NIK cocok · No. KK / Nama Ibu perlu dilengkapi</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Tidak Padan NIK</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-red-700">
              {stats.invalid}
            </p>
            <p className="mt-1 text-xs text-slate-500">Selisih struktur NIK / Tgl Lahir / JK</p>
          </div>
        </div>
      </section>

      {/* Toolbar Pencarian, Upload GTK & Tampilan */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Nama PTK, Jabatan, Mata Pelajaran, NIP, NUPTK, atau NIK..."
                aria-label="Cari profil PTK Dapodik"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <select
              value={kepegawaianFilter}
              onChange={(e) => setKepegawaianFilter(e.target.value as KepegawaianFilter)}
              aria-label="Filter status kepegawaian"
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800"
            >
              <option value="ALL">Semua Kepegawaian</option>
              <option value="PNS">PNS / CPNS</option>
              <option value="PPPK">PPPK</option>
              <option value="PPPK Paruh Waktu">PPPK Paruh Waktu</option>
              <option value="NON-ASN">Honor / Non-ASN</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenTuStaffSettings && (
              <button
                type="button"
                onClick={onOpenTuStaffSettings}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                <span>Setting Petugas TU</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleBatchCheck()}
              disabled={runningBatch}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${runningBatch ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Padankan NIK Dispendukcapil</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setImportExportTab('import');
                setImportExportOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Upload Daftar PTK</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setImportExportTab('export');
                setImportExportOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ekspor</span>
            </button>
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tambah PTK</span>
            </button>
          </div>
        </div>

        {/* Segmented Filter & Mode Tampilan */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {(
              [
                { value: 'ALL', label: `Semua (${stats.total})` },
                { value: 'Padan Dispendukcapil', label: `Padan (${stats.padan})` },
                { value: 'Residu Data', label: `Residu (${stats.residu})` },
                { value: 'Tidak Padan NIK', label: `Tidak Padan NIK (${stats.invalid})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setMatchFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  matchFilter === tab.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Profil PTK</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tabel Dapodik</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setImportExportTab('export');
                setImportExportOpen(true);
              }}
              className="hidden items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700 xl:inline-flex"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Format Dapodik PTK</span>
            </button>
          </div>
        </div>

        {photoError && (
          <p role="alert" className="mt-3 text-xs font-medium text-rose-700">
            {photoError}
          </p>
        )}
      </div>

      {/* Konten Profil PTK */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-base font-semibold text-slate-900">Data PTK tidak ditemukan</p>
          <p className="mt-1 text-sm text-slate-500">
            Ubah kata kunci pencarian, unggah Excel Daftar PTK Dapodik, atau tambahkan profil PTK baru.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ gtk, displayName, check }) => (
            <article
              key={gtk.id}
              onClick={() => setInspectedGtk(gtk)}
              className="flex cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 uppercase transition-colors hover:border-slate-300"
            >
              <div>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="h-20 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {gtk.fotoDataUrl ? (
                        <img
                          src={gtk.fotoDataUrl}
                          alt={`Foto ${displayName}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center text-slate-500">
                          <User className="h-5 w-5 text-slate-400" aria-hidden="true" />
                          <span className="mt-0.5 font-mono text-[10px] font-semibold">
                            {getInitials(gtk.nama)}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerQuickPhotoUpload(gtk);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Camera className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                      <span>{gtk.fotoDataUrl ? 'Ganti' : 'Foto'}</span>
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{gtk.statusKepegawaian}</span>
                      <span aria-hidden="true">·</span>
                      <span>{gtk.jk === 'P' ? 'Perempuan' : 'Laki-laki'}</span>
                    </div>
                    <h3 className="mt-1 truncate text-sm font-semibold text-slate-900" title={displayName}>
                      {displayName}
                    </h3>
                    <p className="mt-0.5 truncate text-xs font-medium text-blue-700">
                      {gtk.jabatanPtk || gtk.jenisPtk}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-600">
                      {[gtk.jenjang, gtk.jurusanProdi].filter(Boolean).join(' ') || 'Kualifikasi belum diisi'}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">NIP / NUPTK</dt>
                    <dd className="font-mono tabular-nums text-slate-800 truncate">
                      {gtk.nip || gtk.nuptk || '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">NIK Dukcapil</dt>
                    <dd className="font-mono tabular-nums text-slate-800">{gtk.nik || '—'}</dd>
                  </div>
                  {gtk.mengajar && (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">Mengajar</dt>
                      <dd className="truncate text-right text-slate-700" title={gtk.mengajar}>
                        {gtk.mengajar}
                        {gtk.totalJjm ? ` (${gtk.totalJjm} JJM)` : ''}
                      </dd>
                    </div>
                  )}
                  {gtk.tugasTambahan && (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">Tugas Tambahan</dt>
                      <dd className="truncate text-right text-slate-700" title={gtk.tugasTambahan}>
                        {gtk.tugasTambahan}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                {check.status === 'Padan Dispendukcapil' ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Padan Dispendukcapil</span>
                  </span>
                ) : check.status === 'Residu Data' ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>NIK Valid · Residu ({check.warningFields.length})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-medium text-rose-700">
                    <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Tidak Padan NIK</span>
                  </span>
                )}
                <span className="font-medium text-slate-500">Buka Profil</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Foto & Nama PTK</th>
                <th className="px-4 py-3">NIP / NUPTK</th>
                <th className="px-4 py-3">Jabatan & Tugas Tambahan</th>
                <th className="px-4 py-3">Kualifikasi & JJM</th>
                <th className="px-4 py-3">NIK (Dispendukcapil)</th>
                <th className="px-4 py-3">Status Padan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 uppercase">
              {filtered.map(({ gtk, displayName, check }) => (
                <tr
                  key={gtk.id}
                  onClick={() => setInspectedGtk(gtk)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-9 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                        {gtk.fotoDataUrl ? (
                          <img
                            src={gtk.fotoDataUrl}
                            alt={`Foto ${displayName}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-mono text-[10px] font-semibold text-slate-500">
                            {getInitials(gtk.nama)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">
                          {displayName}{' '}
                          <span className="text-xs font-normal text-slate-500">({gtk.jk})</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                          <span>{gtk.statusKepegawaian}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerQuickPhotoUpload(gtk);
                            }}
                            className="font-medium text-blue-700 hover:underline"
                          >
                            {gtk.fotoDataUrl ? 'Ganti Foto' : 'Upload Foto'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums whitespace-nowrap">
                    <div className="text-slate-900">NIP: {gtk.nip || '—'}</div>
                    <div className="mt-0.5 text-slate-500">NUPTK: {gtk.nuptk || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[230px]">
                    <div className="font-semibold text-slate-800">
                      {gtk.jabatanPtk || gtk.jenisPtk}
                    </div>
                    <div className="mt-0.5 truncate text-slate-500">
                      {gtk.tugasTambahan || gtk.jenisPtk}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[220px]">
                    <div className="text-slate-800">
                      {[gtk.jenjang, gtk.jurusanProdi].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div className="mt-0.5 truncate text-slate-500">
                      {gtk.mengajar ? `${gtk.mengajar} (${gtk.totalJjm || '0'} JJM)` : 'Non-mengajar'}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums whitespace-nowrap">
                    <div className="text-slate-900">{gtk.nik || '—'}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{check.decodedRegion}</div>
                  </td>
                  <td className="px-4 py-3">
                    {check.status === 'Padan Dispendukcapil' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Padan</span>
                      </span>
                    ) : check.status === 'Residu Data' ? (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Residu ({check.warningFields.length})</span>
                        </span>
                        <div className="mt-0.5 max-w-[210px] truncate text-[11px] text-slate-500">
                          {check.warningFields[0]}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
                          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Tidak Padan NIK</span>
                        </span>
                        <div className="mt-0.5 max-w-[210px] truncate text-[11px] text-red-600">
                          {check.invalidFields[0]}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GtkDetailModal
        gtk={inspectedGtk}
        isCreating={creatingNew}
        onClose={() => {
          setInspectedGtk(null);
          setCreatingNew(false);
        }}
        onSave={(saved, isNew) => {
          onSaveGtk(saved, isNew);
          setInspectedGtk(null);
          setCreatingNew(false);
        }}
        onDelete={(id) => {
          onDeleteGtk(id);
          setInspectedGtk(null);
        }}
        onCreateLetterFromGtk={(gtk) => {
          setInspectedGtk(null);
          onCreateLetterFromGtk(gtk);
        }}
      />

      <GtkImportExportModal
        open={importExportOpen}
        initialTab={importExportTab}
        gtkList={gtkList}
        onClose={() => setImportExportOpen(false)}
        onConfirmImport={onImportGtk}
      />
    </div>
  );
}
