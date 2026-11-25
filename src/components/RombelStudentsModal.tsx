import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FilePlus2,
  Search,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  DapodikGtk,
  DapodikRombel,
  DapodikStudent,
  ServiceCategoryId,
} from '../types/tu';
import { validateDapodikStudent } from '../utils/dapodikValidation';
import { formatPtkDisplayName } from '../utils/gtkDapodikValidation';
import { exportRombelRosterWorkbook } from '../utils/rombelDapodikUtils';

interface RombelRosterContentProps {
  rombel: DapodikRombel;
  students: DapodikStudent[];
  matchedGtk?: DapodikGtk;
  onInspectStudent: (student: DapodikStudent) => void;
  onCreateLetterFromStudent: (student: DapodikStudent, serviceId: ServiceCategoryId) => void;
  compactHeader?: boolean;
}

export function RombelRosterContent({
  rombel,
  students,
  matchedGtk,
  onInspectStudent,
  onCreateLetterFromStudent,
  compactHeader = false,
}: RombelRosterContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'L' | 'P'>('ALL');

  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) =>
        a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
      ),
    [students]
  );

  const counts = useMemo(() => {
    const l = sortedStudents.filter((s) => s.jk === 'L').length;
    const p = sortedStudents.filter((s) => s.jk === 'P').length;
    return { l, p, total: sortedStudents.length };
  }, [sortedStudents]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedStudents
      .filter((s) => {
        if (genderFilter !== 'ALL' && s.jk !== genderFilter) return false;
        if (!q) return true;
        return (
          s.nama.toLowerCase().includes(q) ||
          s.nipd.toLowerCase().includes(q) ||
          s.nisn.toLowerCase().includes(q) ||
          s.nik.toLowerCase().includes(q) ||
          s.asalSmp.toLowerCase().includes(q)
        );
      })
      .map((s) => ({
        student: s,
        validation: validateDapodikStudent(s),
      }));
  }, [sortedStudents, searchQuery, genderFilter]);

  const waliName = matchedGtk ? formatPtkDisplayName(matchedGtk) : rombel.waliKelasNama;

  return (
    <div className="flex flex-col gap-4">
      {/* Banner Info Rombel & Wali Kelas */}
      <div
        className={`flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 ${
          compactHeader ? 'p-4' : 'p-4 sm:flex-row sm:items-center'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-12 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {matchedGtk?.fotoDataUrl ? (
              <img
                src={matchedGtk.fotoDataUrl}
                alt={waliName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <User className="h-4 w-4" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-blue-200 bg-blue-100/80 px-2 py-0.5 font-mono text-xs font-bold text-blue-900">
                {rombel.namaRombel}
              </span>
              <span className="text-xs font-medium text-slate-600">
                Tingkat {rombel.tingkatKelas} · Ruang {rombel.ruangan}
              </span>
            </div>
            <p className="mt-1 truncate text-xs font-semibold uppercase text-slate-900">
              Wali Kelas: {waliName || 'BELUM DITETAPKAN'}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {rombel.kurikulum}
              {matchedGtk?.nip ? ` · NIP ${matchedGtk.nip}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right font-mono tabular-nums">
            <div className="text-sm font-bold text-slate-900">{counts.total} Siswa</div>
            <div className="text-[11px] text-slate-500">
              L: {counts.l} · P: {counts.p}
            </div>
          </div>
          <button
            type="button"
            onClick={() => exportRombelRosterWorkbook(rombel, sortedStudents, waliName)}
            disabled={sortedStudents.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ekspor Siswa (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Filter Pencarian & Gender */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Cari nama, NIPD, NISN, atau asal SMP di ${rombel.namaRombel}...`}
            aria-label={`Cari siswa di rombel ${rombel.namaRombel}`}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { value: 'ALL', label: `Semua (${counts.total})` },
              { value: 'L', label: `Laki-laki (${counts.l})` },
              { value: 'P', label: `Perempuan (${counts.p})` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGenderFilter(opt.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                genderFilter === opt.value
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel Siswa Rombel */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {sortedStudents.length === 0
              ? `Belum ada siswa Dapodik terdaftar pada rombel ${rombel.namaRombel}`
              : 'Tidak ada siswa yang cocok dengan filter pencarian'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {sortedStudents.length === 0
              ? 'Pastikan kolom Rombel Saat Ini pada data siswa Dapodik sesuai dengan nama rombel ini.'
              : 'Coba ubah kata kunci pencarian atau filter jenis kelamin.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="w-10 px-3 py-2.5 text-center">No</th>
                <th className="px-3 py-2.5">NIPD</th>
                <th className="px-3 py-2.5">Nama Peserta Didik</th>
                <th className="w-12 px-3 py-2.5 text-center">L/P</th>
                <th className="px-3 py-2.5">NISN / NIK</th>
                <th className="px-3 py-2.5">Tempat, Tgl Lahir</th>
                <th className="px-3 py-2.5">Asal SMP / HP</th>
                <th className="px-3 py-2.5">Validasi</th>
                <th className="px-3 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(({ student, validation }, idx) => (
                <tr
                  key={student.id}
                  onClick={() => onInspectStudent(student)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-medium tabular-nums text-slate-700 whitespace-nowrap">
                    {student.nipd || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-slate-900">{student.nama}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {student.agama} · {student.statusSiswa}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono font-semibold text-slate-700">
                    {student.jk}
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">
                    <div className="text-slate-900">{student.nisn || '—'}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{student.nik || '—'}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    <div>{student.tempatLahir || '—'}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {student.tanggalLahir || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="max-w-[170px] truncate text-slate-800">
                      {student.asalSmp || '—'}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {student.hp || student.telepon || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {validation.level === 'Valid' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Valid</span>
                      </span>
                    ) : validation.level === 'Residu' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Residu ({validation.warningFields.length})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-red-700">
                        <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Invalid ({validation.invalidFields.length})</span>
                      </span>
                    )}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onInspectStudent(student)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => onCreateLetterFromStudent(student, 'surat-aktif')}
                        title="Buat Surat Keterangan Aktif untuk siswa ini"
                        className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                      >
                        <FilePlus2 className="h-3 w-3" aria-hidden="true" />
                        <span>Surat</span>
                      </button>
                    </div>
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

interface RombelStudentsModalProps {
  rombel: DapodikRombel | null;
  students: DapodikStudent[];
  matchedGtk?: DapodikGtk;
  onClose: () => void;
  onInspectStudent: (student: DapodikStudent) => void;
  onCreateLetterFromStudent: (student: DapodikStudent, serviceId: ServiceCategoryId) => void;
}

export function RombelStudentsModal({
  rombel,
  students,
  matchedGtk,
  onClose,
  onInspectStudent,
  onCreateLetterFromStudent,
}: RombelStudentsModalProps) {
  if (!rombel) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/60" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Daftar Siswa Rombel ${rombel.namaRombel}`}
        className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Daftar Peserta Didik Rombel {rombel.namaRombel}
              </h2>
              <p className="text-xs text-slate-500">
                Data siswa sesungguhnya dari Database Dapodik yang terdaftar pada rombongan belajar ini.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup daftar siswa rombel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <RombelRosterContent
            rombel={rombel}
            students={students}
            matchedGtk={matchedGtk}
            onInspectStudent={onInspectStudent}
            onCreateLetterFromStudent={onCreateLetterFromStudent}
          />
        </div>
      </div>
    </div>
  );
}
