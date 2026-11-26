import {
  AlertTriangle,
  CheckCircle2,
  CopyCheck,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  AgendaEntry,
  DapodikGtk,
  DapodikRombel,
  DapodikStudent,
  ServiceRequest,
} from '../types/tu';
import {
  DeduplicateMatchMode,
  DeduplicateTarget,
  DuplicateGroup,
  findDuplicateAgenda,
  findDuplicateGtk,
  findDuplicateRequests,
  findDuplicateRombels,
  findDuplicateStudents,
} from '../utils/deduplicationUtils';

interface DeduplicateModalProps {
  open: boolean;
  initialTarget: DeduplicateTarget;
  allowSwitchTarget?: boolean;
  students: DapodikStudent[];
  gtkList: DapodikGtk[];
  rombels: DapodikRombel[];
  requests: ServiceRequest[];
  agendaEntries: AgendaEntry[];
  onClose: () => void;
  onConfirmDelete: (target: DeduplicateTarget, deleteIds: string[]) => Promise<boolean>;
}

const TARGET_META: Record<
  DeduplicateTarget,
  { label: string; shortLabel: string; criteriaHint: string }
> = {
  students: {
    label: 'Database Siswa Dapodik',
    shortLabel: 'Siswa',
    criteriaHint: 'Kesamaan Nama, NISN, NIK, atau NIPD',
  },
  gtk: {
    label: 'Database GTK Dapodik',
    shortLabel: 'GTK / PTK',
    criteriaHint: 'Kesamaan Nama, Nama+Gelar, NIK, NIP, atau NUPTK',
  },
  rombels: {
    label: 'Rombongan Belajar & Wali Kelas',
    shortLabel: 'Rombel',
    criteriaHint: 'Kesamaan Nama Rombel',
  },
  requests: {
    label: 'Permohonan Surat Layanan TU',
    shortLabel: 'Permohonan',
    criteriaHint: 'Kesamaan Nama Pemohon, NISN/NIP, Layanan & Keperluan',
  },
  agenda: {
    label: 'Buku Agenda Surat Masuk & Keluar',
    shortLabel: 'Agenda Surat',
    criteriaHint: 'Kesamaan Nomor Surat, Nomor Agenda, atau Perihal & Tanggal',
  },
};

export function DeduplicateModal({
  open,
  initialTarget,
  allowSwitchTarget = false,
  students,
  gtkList,
  rombels,
  requests,
  agendaEntries,
  onClose,
  onConfirmDelete,
}: DeduplicateModalProps) {
  const [target, setTarget] = useState<DeduplicateTarget>(initialTarget);
  const [matchMode, setMatchMode] = useState<DeduplicateMatchMode>('all');
  const [keepMap, setKeepMap] = useState<Record<string, string>>({});
  const [checkedDeleteIds, setCheckedDeleteIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (open) {
      setTarget(initialTarget);
      setConfirmOpen(false);
      setErrorMsg('');
    }
  }, [open, initialTarget]);

  const groups: DuplicateGroup<unknown>[] = useMemo(() => {
    if (target === 'students') {
      return findDuplicateStudents(students, matchMode) as DuplicateGroup<unknown>[];
    }
    if (target === 'gtk') {
      return findDuplicateGtk(gtkList, matchMode) as DuplicateGroup<unknown>[];
    }
    if (target === 'rombels') {
      return findDuplicateRombels(rombels) as DuplicateGroup<unknown>[];
    }
    if (target === 'requests') {
      return findDuplicateRequests(requests, matchMode) as DuplicateGroup<unknown>[];
    }
    return findDuplicateAgenda(agendaEntries, matchMode) as DuplicateGroup<unknown>[];
  }, [target, matchMode, students, gtkList, rombels, requests, agendaEntries]);

  // Auto-select kept record and safe duplicate deletions whenever groups change
  useEffect(() => {
    const nextKeep: Record<string, string> = {};
    const nextDelete = new Set<string>();
    for (const g of groups) {
      nextKeep[g.groupId] = g.recommendedKeepId;
      if (!g.hasIdentityConflict) {
        for (const item of g.items) {
          if (item.id !== g.recommendedKeepId) {
            nextDelete.add(item.id);
          }
        }
      }
    }
    setKeepMap(nextKeep);
    setCheckedDeleteIds(nextDelete);
    setConfirmOpen(false);
    setErrorMsg('');
  }, [groups]);

  const selectedToDeleteList = useMemo(() => {
    const list: Array<{ id: string; title: string; subtitle: string }> = [];
    for (const g of groups) {
      for (const item of g.items) {
        if (checkedDeleteIds.has(item.id)) {
          list.push({ id: item.id, title: item.title, subtitle: item.subtitle });
        }
      }
    }
    return list;
  }, [groups, checkedDeleteIds]);

  if (!open) return null;

  const handleChangeKeep = (groupId: string, newKeepId: string) => {
    setKeepMap((prev) => ({ ...prev, [groupId]: newKeepId }));
    const group = groups.find((g) => g.groupId === groupId);
    if (!group) return;
    setCheckedDeleteIds((prev) => {
      const next = new Set(prev);
      next.delete(newKeepId);
      if (!group.hasIdentityConflict) {
        for (const item of group.items) {
          if (item.id !== newKeepId) next.add(item.id);
        }
      }
      return next;
    });
  };

  const handleToggleDeleteItem = (groupId: string, itemId: string) => {
    const keptId = keepMap[groupId];
    if (keptId === itemId) return; // Cannot mark the kept primary record for deletion
    setCheckedDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleSelectAllDuplicates = (includeConflicted: boolean) => {
    const next = new Set<string>();
    for (const g of groups) {
      if (!includeConflicted && g.hasIdentityConflict) continue;
      const keptId = keepMap[g.groupId] ?? g.recommendedKeepId;
      for (const item of g.items) {
        if (item.id !== keptId) next.add(item.id);
      }
    }
    setCheckedDeleteIds(next);
  };

  const handleExecuteDelete = async () => {
    const deleteIds = Array.from(checkedDeleteIds);
    if (deleteIds.length === 0) return;
    setDeleting(true);
    setErrorMsg('');
    try {
      const ok = await onConfirmDelete(target, deleteIds);
      if (ok) {
        setConfirmOpen(false);
        onClose();
      } else {
        setConfirmOpen(false);
        setErrorMsg('Gagal menghapus data duplikat dari server.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const meta = TARGET_META[target];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Deteksi & Hapus Duplikasi Data"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pembersihan & Hapus Duplikasi Data
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {meta.label} · Deteksi otomatis berdasarkan {meta.criteriaHint}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Tutup modal duplikasi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Target switcher & criteria bar */}
        <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-6 py-3">
          {allowSwitchTarget && (
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TARGET_META) as DeduplicateTarget[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTarget(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    target === key
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {TARGET_META[key].shortLabel}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">Kriteria Pencocokan:</label>
              <select
                value={matchMode}
                onChange={(e) => setMatchMode(e.target.value as DeduplicateMatchMode)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
              >
                <option value="all">Semua Kemiripan (Nama & Identitas/Nomor)</option>
                <option value="name-only">Hanya Kesamaan Nama / Perihal</option>
                <option value="identity-only">Hanya Kesamaan NISN / NIK / NIP / No. Surat</option>
              </select>
            </div>

            {groups.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAllDuplicates(false)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Pilih Duplikat Aman
                </button>
                <button
                  type="button"
                  onClick={() => setCheckedDeleteIds(new Set())}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                >
                  Kosongkan Pilihan
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {errorMsg && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-6 py-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-bold text-slate-900">
                Tidak Ditemukan Duplikasi Data
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-600">
                Seluruh data pada {meta.label} sudah bersih dan tidak memiliki kesamaan nama maupun identitas sesuai kriteria yang dipilih.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-900">
                <span>
                  Ditemukan <strong>{groups.length}</strong> kelompok data mirip/duplikat. Data paling lengkap otomatis dipilih sebagai <strong>Dipertahankan</strong>.
                </span>
                <span className="font-mono font-bold text-rose-700">
                  {checkedDeleteIds.size} siap dihapus
                </span>
              </div>

              {groups.map((group, gIdx) => {
                const keptId = keepMap[group.groupId] ?? group.recommendedKeepId;
                return (
                  <div
                    key={group.groupId}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-700">
                          Grup #{gIdx + 1}
                        </span>
                        {group.reasons.map((reason) => (
                          <span
                            key={reason}
                            className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800"
                          >
                            {reason}
                          </span>
                        ))}
                        {group.hasIdentityConflict && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            <span>Beda NISN/NIK/Tgl Lahir — Cek Manual</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {group.items.length} entri ditemukan
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {group.items.map((item) => {
                        const isKept = keptId === item.id;
                        const isMarkedDelete = checkedDeleteIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                              isKept
                                ? 'bg-emerald-50/40'
                                : isMarkedDelete
                                  ? 'bg-rose-50/40'
                                  : 'bg-white'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">
                                  {item.title}
                                </span>
                                {isKept && (
                                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                                    Dipertahankan
                                  </span>
                                )}
                                {isMarkedDelete && (
                                  <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-800">
                                    Akan Dihapus
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-slate-600">{item.subtitle}</p>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {item.detailBadges.map((badge) => (
                                  <span
                                    key={badge}
                                    className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-600"
                                  >
                                    {badge}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-3">
                              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                                <input
                                  type="radio"
                                  name={`keep-${group.groupId}`}
                                  checked={isKept}
                                  onChange={() => handleChangeKeep(group.groupId, item.id)}
                                  className="h-3.5 w-3.5 text-emerald-600"
                                />
                                <span>Pertahankan</span>
                              </label>

                              <label
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                                  isKept
                                    ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                                    : isMarkedDelete
                                      ? 'cursor-pointer border-rose-300 bg-rose-50 text-rose-800'
                                      : 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isKept}
                                  checked={isMarkedDelete}
                                  onChange={() => handleToggleDeleteItem(group.groupId, item.id)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600"
                                />
                                <span>Hapus</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CopyCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>
              {checkedDeleteIds.size > 0
                ? `${checkedDeleteIds.size} data duplikat ditandai untuk dihapus.`
                : 'Belum ada data duplikat yang ditandai untuk dihapus.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={checkedDeleteIds.size === 0}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hapus Duplikat Terpilih ({checkedDeleteIds.size})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Explicit Confirmation Modal Before Deleting Duplicates */}
      {confirmOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Konfirmasi Hapus Data Duplikat
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Anda akan menghapus permanen{' '}
                  <strong className="text-rose-700">{selectedToDeleteList.length} data</strong>{' '}
                  duplikat dari <strong>{meta.label}</strong>. Data utama yang dipertahankan tetap tersimpan aman.
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <p className="font-semibold text-slate-800">Daftar data yang akan dihapus:</p>
              <ul className="mt-2 space-y-1.5 text-slate-700">
                {selectedToDeleteList.map((item) => (
                  <li key={item.id} className="rounded bg-white px-2.5 py-1.5 border border-slate-200">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-[11px] text-slate-500">{item.subtitle}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleExecuteDelete()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {deleting ? 'Menghapus...' : `Ya, Hapus ${selectedToDeleteList.length} Data`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
