import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Upload,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  DapodikRombel,
  DapodikStudent,
  DapodikValidationLevel,
  ServiceCategoryId,
  UserMode,
} from '../types/tu';
import { validateDapodikStudent } from '../utils/dapodikValidation';
import { normalizeRombelKey, sortRombelsNaturally } from '../utils/rombelDapodikUtils';
import {
  DapodikImportExportModal,
  ImportMergeMode,
} from './DapodikImportExportModal';
import { DapodikStudentModal } from './DapodikStudentModal';

interface DapodikDatabaseViewProps {
  students: DapodikStudent[];
  rombels: DapodikRombel[];
  userMode: UserMode;
  onSaveStudent: (student: DapodikStudent, isNew: boolean) => void;
  onDeleteStudent: (id: string) => void;
  onImportStudents: (imported: DapodikStudent[], mode: ImportMergeMode) => Promise<boolean | void> | void;
  onCreateLetterFromStudent: (student: DapodikStudent, serviceId: ServiceCategoryId) => void;
}

export function DapodikDatabaseView({
  students,
  rombels,
  userMode,
  onSaveStudent,
  onDeleteStudent,
  onImportStudents,
  onCreateLetterFromStudent,
}: DapodikDatabaseViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'X' | 'XI' | 'XII' | 'Alumni'>('ALL');
  const [rombelFilter, setRombelFilter] = useState<string>('ALL');
  const [validationFilter, setValidationFilter] = useState<'ALL' | DapodikValidationLevel>('ALL');
  const [inspectedStudent, setInspectedStudent] = useState<DapodikStudent | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'import' | 'export'>('import');

  const enrichedStudents = useMemo(
    () =>
      students.map((s) => ({
        student: s,
        validation: validateDapodikStudent(s),
      })),
    [students]
  );

  const stats = useMemo(() => {
    const total = enrichedStudents.length;
    const valid = enrichedStudents.filter((e) => e.validation.level === 'Valid').length;
    const residu = enrichedStudents.filter((e) => e.validation.level === 'Residu').length;
    const invalid = enrichedStudents.filter((e) => e.validation.level === 'Invalid').length;
    return { total, valid, residu, invalid };
  }, [enrichedStudents]);

  const sortedRombels = useMemo(() => sortRombelsNaturally(rombels), [rombels]);

  const rombelOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students) {
      const k = normalizeRombelKey(s.rombelSaatIni);
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return sortedRombels
      .filter((r) => {
        if (gradeFilter === 'X') return r.tingkatKelas === '10';
        if (gradeFilter === 'XI') return r.tingkatKelas === '11';
        if (gradeFilter === 'XII') return r.tingkatKelas === '12';
        return true;
      })
      .map((r) => ({
        namaRombel: r.namaRombel,
        key: normalizeRombelKey(r.namaRombel),
        count: counts.get(normalizeRombelKey(r.namaRombel)) ?? 0,
      }));
  }, [sortedRombels, students, gradeFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedStudents.filter(({ student, validation }) => {
      if (gradeFilter !== 'ALL' && student.tingkatKelas !== gradeFilter) return false;
      if (
        rombelFilter !== 'ALL' &&
        normalizeRombelKey(student.rombelSaatIni) !== rombelFilter
      ) {
        return false;
      }
      if (validationFilter !== 'ALL' && validation.level !== validationFilter) return false;
      if (!q) return true;
      return (
        student.nama.toLowerCase().includes(q) ||
        student.nisn.toLowerCase().includes(q) ||
        student.nik.toLowerCase().includes(q) ||
        student.nipd.toLowerCase().includes(q) ||
        student.rombelSaatIni.toLowerCase().includes(q) ||
        student.namaIbu.toLowerCase().includes(q)
      );
    });
  }, [enrichedStudents, searchQuery, gradeFilter, rombelFilter, validationFilter]);

  return (
    <div className="space-y-6">
      {/* KPI Validasi Dapodik */}
      <section aria-label="Ringkasan Validasi Dapodik">
        <div className="grid grid-cols-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Total Peserta Didik</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
              {stats.total}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Tercatat di {sortedRombels.length} Rombel aktif
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Valid & Padan Dukcapil</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700">
              {stats.valid}
            </p>
            <p className="mt-1 text-xs text-slate-500">NIK, KK, NISN, Ibu lengkap</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Residu / Perlu VervalPD</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-amber-700">
              {stats.residu}
            </p>
            <p className="mt-1 text-xs text-slate-500">Data sekunder belum lengkap</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Invalid Aturan Dapodik</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-red-700">
              {stats.invalid}
            </p>
            <p className="mt-1 text-xs text-slate-500">Wajib segera diperbaiki</p>
          </div>
        </div>
      </section>

      {/* Toolbar Pencarian, Filter & Form Upload/Ekspor/Impor */}
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
                placeholder="Cari Nama, NISN (10 digit), NIK (16 digit), NIPD, atau Nama Ibu..."
                aria-label="Cari peserta didik Dapodik"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <select
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value as 'ALL' | 'X' | 'XI' | 'XII' | 'Alumni');
                setRombelFilter('ALL');
              }}
              aria-label="Filter tingkat kelas"
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800"
            >
              <option value="ALL">Semua Tingkat</option>
              <option value="X">Kelas X</option>
              <option value="XI">Kelas XI</option>
              <option value="XII">Kelas XII</option>
              <option value="Alumni">Alumni / Lulus</option>
            </select>

            <select
              value={rombelFilter}
              onChange={(e) => setRombelFilter(e.target.value)}
              aria-label="Filter rombongan belajar"
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800"
            >
              <option value="ALL">Semua Rombel ({sortedRombels.length})</option>
              {rombelOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.namaRombel} ({opt.count} siswa)
                </option>
              ))}
            </select>
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
              <span>Upload / Impor Excel & CSV</span>
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
              <span>Ekspor & Template</span>
            </button>
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tambah Siswa</span>
            </button>
          </div>
        </div>

        {/* Segmented Validation Filter + Info Skema 66 Kolom */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {(
              [
                { value: 'ALL', label: `Semua (${stats.total})` },
                { value: 'Valid', label: `Valid Padan (${stats.valid})` },
                { value: 'Residu', label: `Residu VervalPD (${stats.residu})` },
                { value: 'Invalid', label: `Invalid (${stats.invalid})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setValidationFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  validationFilter === tab.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setImportExportTab('export');
              setImportExportOpen(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Standar Unduhan 66 Kolom Dapodik</span>
          </button>
        </div>
      </div>

      {/* Tabel Data Pokok Siswa */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-base font-semibold text-slate-900">
            Data peserta didik tidak ditemukan
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Ubah kata kunci pencarian, unggah file Excel/CSV Dapodik, atau tambahkan peserta didik baru.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">NIPD</th>
                <th className="px-4 py-3">Nama Peserta Didik & Ibu Kandung</th>
                <th className="px-4 py-3">NISN / NIK</th>
                <th className="px-4 py-3">Rombel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Validasi Dapodik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(({ student, validation }) => (
                <tr
                  key={student.id}
                  onClick={() => setInspectedStudent(student)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium tabular-nums text-slate-700 whitespace-nowrap">
                    {student.nipd || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {student.nama}{' '}
                      <span className="text-xs font-normal text-slate-500">({student.jk})</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Ibu Kandung: {student.namaIbu || 'Belum diisi'} · {student.asalSmp || 'Asal SMP kosong'}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">
                    <div className="text-slate-900">NISN: {student.nisn || '—'}</div>
                    <div className="mt-0.5 text-slate-500">NIK: {student.nik || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-800 whitespace-nowrap">
                    {student.rombelSaatIni}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                    {student.statusSiswa}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {validation.level === 'Valid' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Valid Padan</span>
                      </span>
                    ) : validation.level === 'Residu' ? (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Residu ({validation.warningFields.length})</span>
                        </span>
                        <div className="mt-0.5 max-w-[210px] truncate text-[11px] text-slate-500">
                          {validation.warningFields[0]}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Invalid ({validation.invalidFields.length})</span>
                        </span>
                        <div className="mt-0.5 max-w-[210px] truncate text-[11px] text-red-600">
                          {validation.invalidFields[0]}
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

      <DapodikStudentModal
        student={inspectedStudent}
        isCreating={creatingNew}
        userMode={userMode}
        rombels={sortedRombels}
        onClose={() => {
          setInspectedStudent(null);
          setCreatingNew(false);
        }}
        onSave={(saved, isNew) => {
          onSaveStudent(saved, isNew);
          setInspectedStudent(null);
          setCreatingNew(false);
        }}
        onDelete={(id) => {
          onDeleteStudent(id);
          setInspectedStudent(null);
        }}
        onCreateLetterFromStudent={(student, serviceId) => {
          setInspectedStudent(null);
          onCreateLetterFromStudent(student, serviceId);
        }}
      />

      <DapodikImportExportModal
        open={importExportOpen}
        initialTab={importExportTab}
        students={students}
        onClose={() => setImportExportOpen(false)}
        onConfirmImport={onImportStudents}
      />
    </div>
  );
}
