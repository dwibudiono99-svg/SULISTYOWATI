import {
  AlertTriangle,
  CheckCircle2,
  Download,
  LayoutGrid,
  List,
  Plus,
  Search,
  Settings2,
  Upload,
  User,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  DapodikGtk,
  DapodikRombel,
  DapodikStudent,
  ServiceCategoryId,
  UserMode,
} from '../types/tu';
import { formatPtkDisplayName } from '../utils/gtkDapodikValidation';
import { normalizeRombelKey, sortRombelsNaturally } from '../utils/rombelDapodikUtils';
import { ImportMergeMode } from './DapodikImportExportModal';
import { DapodikStudentModal } from './DapodikStudentModal';
import { RombelImportExportModal } from './RombelImportExportModal';
import { RombelModal } from './RombelModal';
import { RombelRosterContent, RombelStudentsModal } from './RombelStudentsModal';

interface RombelWaliKelasViewProps {
  rombels: DapodikRombel[];
  gtkList: DapodikGtk[];
  students: DapodikStudent[];
  userMode: UserMode;
  onSaveRombel: (rombel: DapodikRombel, isNew: boolean) => void;
  onDeleteRombel: (id: string) => void;
  onImportRombels: (imported: DapodikRombel[], mode: ImportMergeMode) => Promise<boolean | void> | void;
  onSaveStudent: (student: DapodikStudent, isNew: boolean) => void;
  onDeleteStudent: (id: string) => void;
  onCreateLetterFromStudent: (student: DapodikStudent, serviceId: ServiceCategoryId) => void;
}

type TingkatFilter = 'ALL' | '10' | '11' | '12';
type RombelViewMode = 'roster' | 'table' | 'cards';

function getInitials(name: string): string {
  const parts = name
    .replace(/,.*$/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'WK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function RombelWaliKelasView({
  rombels,
  gtkList,
  students,
  userMode,
  onSaveRombel,
  onDeleteRombel,
  onImportRombels,
  onSaveStudent,
  onDeleteStudent,
  onCreateLetterFromStudent,
}: RombelWaliKelasViewProps) {
  const [viewMode, setViewMode] = useState<RombelViewMode>('roster');
  const [searchQuery, setSearchQuery] = useState('');
  const [tingkatFilter, setTingkatFilter] = useState<TingkatFilter>('ALL');
  const [selectedRombelId, setSelectedRombelId] = useState<string>('');
  const [rosterModalRombelId, setRosterModalRombelId] = useState<string | null>(null);
  const [inspectedStudent, setInspectedStudent] = useState<DapodikStudent | null>(null);
  const [editingRombel, setEditingRombel] = useState<DapodikRombel | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'import' | 'export'>('import');

  const sortedRombels = useMemo(() => sortRombelsNaturally(rombels), [rombels]);

  const sortedGtk = useMemo(
    () =>
      [...gtkList].sort((a, b) =>
        a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
      ),
    [gtkList]
  );

  const studentsByRombel = useMemo(() => {
    const map = new Map<string, DapodikStudent[]>();
    for (const s of students) {
      const key = normalizeRombelKey(s.rombelSaatIni);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [students]);

  const enriched = useMemo(
    () =>
      sortedRombels.map((rombel) => {
        const matchedGtk =
          (rombel.waliKelasId && gtkList.find((g) => g.id === rombel.waliKelasId)) ||
          gtkList.find(
            (g) => g.nama.trim().toUpperCase() === rombel.waliKelasNama.trim().toUpperCase()
          );
        const key = normalizeRombelKey(rombel.namaRombel);
        const actualStudents = studentsByRombel.get(key) ?? [];
        const actualL = actualStudents.filter((s) => s.jk === 'L').length;
        const actualP = actualStudents.filter((s) => s.jk === 'P').length;
        const actualTotal = actualStudents.length;
        return {
          rombel,
          matchedGtk,
          actualStudents,
          actualL,
          actualP,
          actualTotal,
        };
      }),
    [sortedRombels, gtkList, studentsByRombel]
  );

  const unmatchedStudents = useMemo(() => {
    const activeKeys = new Set(sortedRombels.map((r) => normalizeRombelKey(r.namaRombel)));
    return students.filter((s) => !activeKeys.has(normalizeRombelKey(s.rombelSaatIni)));
  }, [sortedRombels, students]);

  const stats = useMemo(() => {
    const totalRombel = enriched.length;
    const hasStudentRecords = students.length > 0;
    const totalL = hasStudentRecords
      ? enriched.reduce((sum, item) => sum + item.actualL, 0)
      : enriched.reduce((sum, item) => sum + item.rombel.jumlahL, 0);
    const totalP = hasStudentRecords
      ? enriched.reduce((sum, item) => sum + item.actualP, 0)
      : enriched.reduce((sum, item) => sum + item.rombel.jumlahP, 0);
    const totalSiswa = hasStudentRecords
      ? enriched.reduce((sum, item) => sum + item.actualTotal, 0)
      : enriched.reduce((sum, item) => sum + item.rombel.jumlahTotal, 0);
    const xCount = enriched.filter(({ rombel }) => rombel.tingkatKelas === '10').length;
    const xiCount = enriched.filter(({ rombel }) => rombel.tingkatKelas === '11').length;
    const xiiCount = enriched.filter(({ rombel }) => rombel.tingkatKelas === '12').length;
    const linkedWali = enriched.filter(({ matchedGtk }) => Boolean(matchedGtk)).length;
    const populatedRombels = enriched.filter(({ actualTotal }) => actualTotal > 0).length;
    return {
      totalRombel,
      totalL,
      totalP,
      totalSiswa,
      xCount,
      xiCount,
      xiiCount,
      linkedWali,
      populatedRombels,
    };
  }, [enriched, students.length]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enriched.filter(({ rombel, matchedGtk, actualStudents }) => {
      if (tingkatFilter !== 'ALL' && rombel.tingkatKelas !== tingkatFilter) return false;
      if (!q) return true;
      return (
        rombel.namaRombel.toLowerCase().includes(q) ||
        rombel.waliKelasNama.toLowerCase().includes(q) ||
        rombel.ruangan.toLowerCase().includes(q) ||
        rombel.kurikulum.toLowerCase().includes(q) ||
        (matchedGtk ? formatPtkDisplayName(matchedGtk).toLowerCase().includes(q) : false) ||
        actualStudents.some(
          (s) =>
            s.nama.toLowerCase().includes(q) ||
            s.nisn.toLowerCase().includes(q) ||
            s.nipd.toLowerCase().includes(q)
        )
      );
    });
  }, [enriched, searchQuery, tingkatFilter]);

  useEffect(() => {
    if (filtered.length === 0) return;
    const exists = filtered.some(({ rombel }) => rombel.id === selectedRombelId);
    if (!exists) {
      setSelectedRombelId(filtered[0].rombel.id);
    }
  }, [filtered, selectedRombelId]);

  const activeRosterEntry = useMemo(
    () => filtered.find(({ rombel }) => rombel.id === selectedRombelId) ?? filtered[0] ?? null,
    [filtered, selectedRombelId]
  );

  const modalRosterEntry = useMemo(
    () =>
      rosterModalRombelId
        ? enriched.find(({ rombel }) => rombel.id === rosterModalRombelId) ?? null
        : null,
    [enriched, rosterModalRombelId]
  );

  const handleInlineWaliChange = (rombel: DapodikRombel, newGtkId: string) => {
    if (!newGtkId) return;
    const chosen = gtkList.find((g) => g.id === newGtkId);
    if (!chosen) return;
    onSaveRombel(
      {
        ...rombel,
        waliKelasId: chosen.id,
        waliKelasNama: chosen.nama.trim().toUpperCase(),
      },
      false
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Ringkasan Rombel & Siswa Sesungguhnya */}
      <section aria-label="Ringkasan Rombongan Belajar dan Data Siswa">
        <div className="grid grid-cols-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Total Rombel Aktif</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
              {stats.totalRombel}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              X: {stats.xCount} · XI: {stats.xiCount} · XII: {stats.xiiCount} kelas
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Siswa Masuk Rombel</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-blue-700">
              {stats.totalSiswa.toLocaleString('id-ID')}
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-slate-500">
              L: {stats.totalL} · P: {stats.totalP} siswa ({stats.populatedRombels}/{stats.totalRombel} rombel)
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Wali Kelas Terhubung PTK</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700">
              {stats.linkedWali}/{stats.totalRombel}
            </p>
            <p className="mt-1 text-xs text-slate-500">Terhubung ke database GTK Dapodik</p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Status Padanan Rombel</p>
            <p className="mt-2 text-lg font-semibold uppercase text-slate-900">
              {unmatchedStudents.length === 0 ? '100% SESUAI' : `${unmatchedStudents.length} LUAR ROMBEL`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {unmatchedStudents.length === 0
                ? 'Seluruh siswa masuk rombel resmi'
                : 'Ada siswa di luar daftar rombel aktif'}
            </p>
          </div>
        </div>
      </section>

      {unmatchedStudents.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              Ditemukan {unmatchedStudents.length} siswa yang rombelnya belum cocok dengan 31 rombel aktif:
            </p>
            <p className="mt-0.5 text-amber-800">
              {unmatchedStudents
                .slice(0, 5)
                .map((s) => `${s.nama} (${s.rombelSaatIni || 'Kosong'})`)
                .join(', ')}
              {unmatchedStudents.length > 5 ? ` dan ${unmatchedStudents.length - 5} lainnya` : ''}.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar Pencarian, Filter Tingkat, & Aksi */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Rombel (X-1, XI-A1), Nama Siswa, NISN, Wali Kelas, atau Ruangan..."
              aria-label="Cari rombel, siswa, dan wali kelas"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setImportExportTab('import');
                setImportExportOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Upload Rombel</span>
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
              <span>Ekspor Rombel</span>
            </button>
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tambah Rombel</span>
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {(
              [
                { value: 'ALL', label: `Semua Tingkat (${stats.totalRombel})` },
                { value: '10', label: `Kelas X / Tingkat 10 (${stats.xCount})` },
                { value: '11', label: `Kelas XI / Tingkat 11 (${stats.xiCount})` },
                { value: '12', label: `Kelas XII / Tingkat 12 (${stats.xiiCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setTingkatFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  tingkatFilter === tab.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('roster')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'roster'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Siswa per Rombel</span>
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
              <span>Tabel Setting</span>
            </button>
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
              <span>Kartu Wali Kelas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Konten Utama */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-base font-semibold text-slate-900">Data rombel tidak ditemukan</p>
          <p className="mt-1 text-sm text-slate-500">
            Ubah kata kunci pencarian atau tambah rombongan belajar baru.
          </p>
        </div>
      ) : viewMode === 'roster' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Panel Kiri: Daftar 31 Rombel */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Pilih Rombel ({filtered.length})
                </h2>
                <span className="font-mono text-[11px] font-medium text-slate-500">
                  {stats.totalSiswa} siswa
                </span>
              </div>
              <div className="max-h-[680px] divide-y divide-slate-100 overflow-y-auto">
                {filtered.map(({ rombel, matchedGtk, actualL, actualP, actualTotal }) => {
                  const isActive = activeRosterEntry?.rombel.id === rombel.id;
                  const countDisplay = actualTotal > 0 ? actualTotal : rombel.jumlahTotal;
                  const lDisplay = actualTotal > 0 ? actualL : rombel.jumlahL;
                  const pDisplay = actualTotal > 0 ? actualP : rombel.jumlahP;
                  return (
                    <button
                      key={rombel.id}
                      type="button"
                      onClick={() => setSelectedRombelId(rombel.id)}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors ${
                        isActive
                          ? 'border-l-4 border-l-blue-700 bg-blue-50/80'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-xs font-bold ${
                              isActive ? 'text-blue-900' : 'text-slate-900'
                            }`}
                          >
                            {rombel.namaRombel}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            R.{rombel.ruangan}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] font-medium uppercase text-slate-600">
                          {matchedGtk ? formatPtkDisplayName(matchedGtk) : rombel.waliKelasNama}
                        </p>
                      </div>
                      <div className="shrink-0 text-right font-mono tabular-nums">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                            isActive
                              ? 'bg-blue-700 text-white'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {countDisplay}
                        </span>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {lDisplay}L/{pDisplay}P
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Panel Kanan: Daftar Siswa Sesungguhnya untuk Rombel Terpilih */}
          <section className="min-w-0 lg:col-span-8 xl:col-span-9">
            {activeRosterEntry && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Data Siswa Masuk Rombel {activeRosterEntry.rombel.namaRombel}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Menampilkan daftar peserta didik riil sesuai Dapodik untuk kelas{' '}
                      {activeRosterEntry.rombel.namaRombel}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingRombel(activeRosterEntry.rombel)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Atur Rombel & Wali</span>
                  </button>
                </div>

                <RombelRosterContent
                  rombel={activeRosterEntry.rombel}
                  students={activeRosterEntry.actualStudents}
                  matchedGtk={activeRosterEntry.matchedGtk}
                  onInspectStudent={(student) => setInspectedStudent(student)}
                  onCreateLetterFromStudent={onCreateLetterFromStudent}
                  compactHeader
                />
              </div>
            )}
          </section>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="w-12 px-4 py-3 text-center">No</th>
                <th className="px-4 py-3">Nama Rombel</th>
                <th className="px-4 py-3 text-center">Tingkat</th>
                <th className="px-4 py-3 text-center">L</th>
                <th className="px-4 py-3 text-center">P</th>
                <th className="px-4 py-3 text-center">Siswa Riil</th>
                <th className="px-4 py-3">Setting Wali Kelas (GTK SMAN 9)</th>
                <th className="px-4 py-3">Ruangan & Kurikulum</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 uppercase">
              {filtered.map(
                ({ rombel, matchedGtk, actualL, actualP, actualTotal }, idx) => {
                  const displayL = students.length > 0 ? actualL : rombel.jumlahL;
                  const displayP = students.length > 0 ? actualP : rombel.jumlahP;
                  const displayTotal = students.length > 0 ? actualTotal : rombel.jumlahTotal;
                  return (
                    <tr key={rombel.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-center font-mono text-xs tabular-nums text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setRosterModalRombelId(rombel.id)}
                          className="inline-block rounded border border-blue-200 bg-blue-50 px-2.5 py-1 font-mono text-xs font-bold text-blue-900 hover:bg-blue-100"
                        >
                          {rombel.namaRombel}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs tabular-nums text-slate-700">
                        {rombel.tingkatKelas}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs tabular-nums text-slate-700">
                        {displayL}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs tabular-nums text-slate-700">
                        {displayP}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs font-semibold tabular-nums text-slate-900">
                        {displayTotal}
                      </td>
                      <td className="px-4 py-3 min-w-[290px]">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-7 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                            {matchedGtk?.fotoDataUrl ? (
                              <img
                                src={matchedGtk.fotoDataUrl}
                                alt={rombel.waliKelasNama}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center font-mono text-[10px] font-semibold text-slate-500">
                                {getInitials(rombel.waliKelasNama)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <select
                              value={matchedGtk?.id || ''}
                              onChange={(e) => handleInlineWaliChange(rombel, e.target.value)}
                              aria-label={`Wali kelas ${rombel.namaRombel}`}
                              className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold uppercase text-slate-900 focus:border-blue-600 focus:outline-none"
                            >
                              {!matchedGtk && (
                                <option value="">{rombel.waliKelasNama} (MANUAL)</option>
                              )}
                              {sortedGtk.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {formatPtkDisplayName(g)}
                                </option>
                              ))}
                            </select>
                            {matchedGtk && (
                              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                                <CheckCircle2
                                  className="h-3 w-3 text-emerald-600"
                                  aria-hidden="true"
                                />
                                <span className="truncate">
                                  {matchedGtk.statusKepegawaian}
                                  {matchedGtk.jabatanPtk ? ` · ${matchedGtk.jabatanPtk}` : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-mono font-semibold text-slate-800">
                          RUANG: {rombel.ruangan}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">{rombel.kurikulum}</div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRosterModalRombelId(rombel.id)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                          >
                            <Users className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Siswa ({displayTotal})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRombel(rombel)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Atur</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ rombel, matchedGtk, actualL, actualP, actualTotal }) => {
            const displayL = students.length > 0 ? actualL : rombel.jumlahL;
            const displayP = students.length > 0 ? actualP : rombel.jumlahP;
            const displayTotal = students.length > 0 ? actualTotal : rombel.jumlahTotal;
            return (
              <article
                key={rombel.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 uppercase transition-colors hover:border-slate-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-sm font-bold text-blue-800">
                          {rombel.namaRombel}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          TINGKAT {rombel.tingkatKelas}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        RUANGAN: <strong className="font-mono text-slate-800">{rombel.ruangan}</strong>
                      </p>
                    </div>

                    <div className="text-right font-mono tabular-nums">
                      <div className="text-lg font-bold text-slate-900">{displayTotal}</div>
                      <div className="text-[11px] text-slate-500">
                        L {displayL} · P {displayP}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="h-12 w-10 shrink-0 overflow-hidden rounded border border-slate-200 bg-white">
                      {matchedGtk?.fotoDataUrl ? (
                        <img
                          src={matchedGtk.fotoDataUrl}
                          alt={rombel.waliKelasNama}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                          <User className="h-4 w-4" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500">WALI KELAS</p>
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {matchedGtk ? formatPtkDisplayName(matchedGtk) : rombel.waliKelasNama}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {matchedGtk
                          ? `${matchedGtk.jabatanPtk || matchedGtk.jenisPtk} · ${matchedGtk.statusKepegawaian}`
                          : 'TIDAK TERHUBUNG KE PTK'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setRosterModalRombelId(rombel.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                  >
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>LIHAT SISWA ({displayTotal})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRombel(rombel)}
                    className="font-semibold text-slate-700 hover:text-blue-700 shrink-0"
                  >
                    ATUR ROMBEL
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <RombelStudentsModal
        rombel={modalRosterEntry?.rombel ?? null}
        students={modalRosterEntry?.actualStudents ?? []}
        matchedGtk={modalRosterEntry?.matchedGtk}
        onClose={() => setRosterModalRombelId(null)}
        onInspectStudent={(student) => setInspectedStudent(student)}
        onCreateLetterFromStudent={(student, serviceId) => {
          setRosterModalRombelId(null);
          onCreateLetterFromStudent(student, serviceId);
        }}
      />

      <DapodikStudentModal
        student={inspectedStudent}
        isCreating={false}
        userMode={userMode}
        rombels={sortedRombels}
        onClose={() => setInspectedStudent(null)}
        onSave={(saved, isNew) => {
          onSaveStudent(saved, isNew);
          setInspectedStudent(null);
        }}
        onDelete={(id) => {
          onDeleteStudent(id);
          setInspectedStudent(null);
        }}
        onCreateLetterFromStudent={(student, serviceId) => {
          setInspectedStudent(null);
          setRosterModalRombelId(null);
          onCreateLetterFromStudent(student, serviceId);
        }}
      />

      <RombelModal
        rombel={editingRombel}
        isCreating={creatingNew}
        gtkList={gtkList}
        onClose={() => {
          setEditingRombel(null);
          setCreatingNew(false);
        }}
        onSave={(saved, isNew) => {
          onSaveRombel(saved, isNew);
          setEditingRombel(null);
          setCreatingNew(false);
        }}
        onDelete={(id) => {
          onDeleteRombel(id);
          setEditingRombel(null);
        }}
      />

      <RombelImportExportModal
        open={importExportOpen}
        initialTab={importExportTab}
        rombels={rombels}
        gtkList={gtkList}
        onClose={() => setImportExportOpen(false)}
        onConfirmImport={onImportRombels}
      />
    </div>
  );
}
