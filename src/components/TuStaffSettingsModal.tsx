import {
  ArrowRightLeft,
  CheckCircle2,
  Database,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { SCHOOL_INFO } from '../config/schoolConfig';
import { DapodikGtk, TuStaffConfig, TuStaffOperator } from '../types/tu';
import { formatPtkDisplayName } from '../utils/gtkDapodikValidation';

interface TuStaffSettingsModalProps {
  open: boolean;
  config: TuStaffConfig;
  gtkList: DapodikGtk[];
  onClose: () => void;
  onSave: (nextConfig: Partial<TuStaffConfig>) => Promise<boolean>;
  onOpenGtkDatabase?: () => void;
}

function isPegawaiTuCandidate(gtk: DapodikGtk): boolean {
  const jenis = (gtk.jenisPtk ?? '').toLowerCase();
  const jabatan = (gtk.jabatanPtk ?? '').toLowerCase();
  const tugas = (gtk.tugasTambahan ?? '').toLowerCase();
  if (
    jenis === 'tenaga administrasi sekolah' ||
    jenis === 'tenaga kependidikan' ||
    jenis === 'pustakawan' ||
    jenis === 'laboran' ||
    jenis === 'penjaga sekolah'
  ) {
    return true;
  }
  const combined = `${jabatan} ${tugas}`;
  return (
    combined.includes('tata usaha') ||
    combined.includes('administrasi') ||
    combined.includes('bendahara') ||
    combined.includes('operator') ||
    combined.includes('pustakawan') ||
    combined.includes('laboran') ||
    /\btu\b/.test(combined)
  );
}

function buildRoleLabel(gtk: DapodikGtk): string {
  const parts = [gtk.jabatanPtk, gtk.jenisPtk, gtk.tugasTambahan]
    .map((p) => (p ?? '').trim())
    .filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.some((u) => u.toLowerCase() === part.toLowerCase())) {
      unique.push(part);
    }
  }
  return unique.join(' · ') || 'Pegawai Tata Usaha';
}

function getInitials(name: string): string {
  const parts = name
    .replace(/,.*$/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'TU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function TuStaffSettingsModal({
  open,
  config,
  gtkList,
  onClose,
  onSave,
  onOpenGtkDatabase,
}: TuStaffSettingsModalProps) {
  const [isEnabled, setIsEnabled] = useState(config.isEnabled);
  const [activeGtkId, setActiveGtkId] = useState<string | null>(config.activeGtkId);
  const [activeStaffName, setActiveStaffName] = useState(config.activeStaffName);
  const [activeStaffNip, setActiveStaffNip] = useState(config.activeStaffNip);
  const [activeStaffRole, setActiveStaffRole] = useState(config.activeStaffRole);
  const [activeStaffPhoto, setActiveStaffPhoto] = useState(config.activeStaffPhoto);
  const [deactivatedReason, setDeactivatedReason] = useState(config.deactivatedReason);
  const [operators, setOperators] = useState<TuStaffOperator[]>(config.operators);

  const [scopeFilter, setScopeFilter] = useState<'tu-only' | 'all-gtk'>('tu-only');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setIsEnabled(config.isEnabled);
      setActiveGtkId(config.activeGtkId);
      setActiveStaffName(config.activeStaffName);
      setActiveStaffNip(config.activeStaffNip);
      setActiveStaffRole(config.activeStaffRole);
      setActiveStaffPhoto(config.activeStaffPhoto);
      setDeactivatedReason(config.deactivatedReason || '');
      setOperators(config.operators || []);
      setSearchQuery('');
      setSaving(false);

      const hasTuCandidate = gtkList.some(isPegawaiTuCandidate);
      setScopeFilter(hasTuCandidate || gtkList.length === 0 ? 'tu-only' : 'all-gtk');
    }
  }, [config, gtkList, open]);

  const operatorStatusMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const op of operators) {
      map.set(op.gtkId, op.isActive);
    }
    return map;
  }, [operators]);

  const tuCandidateCount = useMemo(
    () => gtkList.filter(isPegawaiTuCandidate).length,
    [gtkList]
  );

  const filteredGtk = useMemo(() => {
    const base = scopeFilter === 'tu-only' ? gtkList.filter(isPegawaiTuCandidate) : gtkList;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((g) => {
      const display = formatPtkDisplayName(g).toLowerCase();
      return (
        display.includes(q) ||
        g.nama.toLowerCase().includes(q) ||
        (g.nip || '').toLowerCase().includes(q) ||
        (g.nuptk || '').toLowerCase().includes(q) ||
        (g.jenisPtk || '').toLowerCase().includes(q) ||
        (g.jabatanPtk || '').toLowerCase().includes(q) ||
        (g.tugasTambahan || '').toLowerCase().includes(q)
      );
    });
  }, [gtkList, scopeFilter, searchQuery]);

  if (!open) return null;

  const upsertOperatorState = (gtk: DapodikGtk, nextActive: boolean, list: TuStaffOperator[]) => {
    const nowIso = new Date().toISOString();
    const nextOp: TuStaffOperator = {
      gtkId: gtk.id,
      nama: formatPtkDisplayName(gtk),
      nip: (gtk.nip || gtk.nuptk || '').trim(),
      jabatan: buildRoleLabel(gtk),
      fotoDataUrl: gtk.fotoDataUrl || '',
      isActive: nextActive,
      updatedAt: nowIso,
    };
    const exists = list.some((o) => o.gtkId === gtk.id);
    if (exists) {
      return list.map((o) => (o.gtkId === gtk.id ? nextOp : o));
    }
    return [nextOp, ...list];
  };

  const handleAssignGtk = (gtk: DapodikGtk) => {
    const displayName = formatPtkDisplayName(gtk);
    const nip = (gtk.nip || gtk.nuptk || '').trim();
    const role = buildRoleLabel(gtk);
    setIsEnabled(true);
    setDeactivatedReason('');
    setActiveGtkId(gtk.id);
    setActiveStaffName(displayName);
    setActiveStaffNip(nip);
    setActiveStaffRole(role);
    setActiveStaffPhoto(gtk.fotoDataUrl || '');
    setOperators((prev) => upsertOperatorState(gtk, true, prev));
  };

  const handleToggleGtkActive = (gtk: DapodikGtk) => {
    const currentlyActive = operatorStatusMap.get(gtk.id) ?? true;
    const nextActive = !currentlyActive;
    const nextOperators = upsertOperatorState(gtk, nextActive, operators);
    setOperators(nextOperators);

    if (!nextActive && activeGtkId === gtk.id) {
      const otherActive = nextOperators.find((o) => o.gtkId !== gtk.id && o.isActive);
      if (otherActive) {
        setActiveGtkId(otherActive.gtkId);
        setActiveStaffName(otherActive.nama);
        setActiveStaffNip(otherActive.nip);
        setActiveStaffRole(otherActive.jabatan);
        setActiveStaffPhoto(otherActive.fotoDataUrl || '');
      } else {
        setIsEnabled(false);
        setDeactivatedReason(
          `${formatPtkDisplayName(gtk)} dinonaktifkan dari penugasan Petugas TU.`
        );
      }
    }
  };

  const handleResetDefault = () => {
    setIsEnabled(true);
    setActiveGtkId(null);
    setActiveStaffName(SCHOOL_INFO.staffName);
    setActiveStaffNip('');
    setActiveStaffRole(SCHOOL_INFO.staffRole);
    setActiveStaffPhoto(SCHOOL_INFO.staffAvatar);
    setDeactivatedReason('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave({
      isEnabled,
      activeGtkId,
      activeStaffName,
      activeStaffNip,
      activeStaffRole,
      activeStaffPhoto,
      deactivatedReason,
      operators,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/60" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tu-staff-modal-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-blue-600/20 p-2 text-blue-300">
              <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="tu-staff-modal-title" className="text-base font-semibold">
                Pengaturan &amp; Pengalihan Petugas TU
              </h2>
              <p className="mt-0.5 text-xs text-slate-300">
                Alihkan penugasan Petugas TU sesuai Database Pegawai TU (GTK Dapodik) atau nonaktifkan penugasan petugas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup pengaturan Petugas TU"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {/* Status Global Penugasan Petugas TU */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status Penugasan Petugas TU
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsEnabled(true)}
                  className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition ${
                    isEnabled
                      ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <ShieldCheck
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      isEnabled ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Petugas TU Aktif</p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      Identitas petugas aktif digunakan pada loket pelayanan, penanggung jawab tiket, dan cetak tanda terima.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEnabled(false)}
                  className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition ${
                    !isEnabled
                      ? 'border-rose-600 bg-rose-50/70 ring-1 ring-rose-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <ShieldAlert
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      !isEnabled ? 'text-rose-700' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      Nonaktifkan Petugas TU
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      Penugasan petugas dinonaktifkan sementara (akses token tetap aktif agar dapat dialihkan kembali kapan saja).
                    </p>
                  </div>
                </button>
              </div>

              {!isEnabled && (
                <div className="mt-3">
                  <label
                    htmlFor="tu-deactivated-reason"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Catatan Penonaktifan (Opsional)
                  </label>
                  <input
                    id="tu-deactivated-reason"
                    type="text"
                    value={deactivatedReason}
                    onChange={(e) => setDeactivatedReason(e.target.value)}
                    placeholder="Contoh: Petugas TU sedang cuti / menunggu serah terima piket loket."
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Ringkasan Petugas TU Terpilih */}
            <div
              className={`flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
                isEnabled
                  ? 'border-blue-200 bg-blue-50/60'
                  : 'border-rose-200 bg-rose-50/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {activeStaffPhoto && isEnabled ? (
                  <img
                    src={activeStaffPhoto}
                    alt={activeStaffName}
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 shrink-0 rounded-lg object-cover bg-slate-200"
                  />
                ) : (
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      isEnabled
                        ? 'bg-blue-700 text-white'
                        : 'bg-rose-700 text-white'
                    }`}
                  >
                    {isEnabled ? getInitials(activeStaffName) : 'OFF'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {isEnabled ? activeStaffName : 'Petugas TU Dinonaktifkan'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        isEnabled
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isEnabled ? 'Aktif Bertugas' : 'Nonaktif'}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-600">
                    {isEnabled
                      ? `${activeStaffRole}${activeStaffNip ? ` · NIP/NUPTK: ${activeStaffNip}` : ''}`
                      : deactivatedReason || 'Penugasan petugas loket sedang dinonaktifkan.'}
                  </p>
                </div>
              </div>

              {activeGtkId && (
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  Reset Default Koordinator
                </button>
              )}
            </div>

            {/* Daftar Pegawai TU dari Database GTK Dapodik */}
            <div className="space-y-3">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Alihkan dari Database Pegawai TU / GTK Dapodik
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pilih pegawai dari repositori GTK untuk mengalihkan tugas atau menonaktifkan pegawai tertentu.
                  </p>
                </div>

                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 self-start">
                  <button
                    type="button"
                    onClick={() => setScopeFilter('tu-only')}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition ${
                      scopeFilter === 'tu-only'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pegawai TU ({tuCandidateCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopeFilter('all-gtk')}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition ${
                      scopeFilter === 'all-gtk'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua GTK ({gtkList.length})
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama pegawai TU, NIP, NUPTK, atau jabatan..."
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {gtkList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                  <Database className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                  <p className="mt-2 text-xs font-semibold text-slate-800">
                    Database GTK Dapodik belum memiliki data pegawai
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Impor atau tambahkan data Pegawai TU / Tendik di Database GTK terlebih dahulu untuk mengalihkan Petugas TU.
                  </p>
                  {onOpenGtkDatabase && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenGtkDatabase();
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      <Database className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Buka Database GTK Dapodik</span>
                    </button>
                  )}
                </div>
              ) : filteredGtk.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                  <p className="text-xs font-medium text-slate-700">
                    {scopeFilter === 'tu-only' && gtkList.length > 0
                      ? 'Belum ada GTK dengan kategori Tenaga Administrasi / TU. Coba tab "Semua GTK".'
                      : 'Tidak ada pegawai yang cocok dengan pencarian Anda.'}
                  </p>
                  {scopeFilter === 'tu-only' && gtkList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setScopeFilter('all-gtk')}
                      className="mt-2 text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Tampilkan Semua GTK ({gtkList.length})
                    </button>
                  )}
                </div>
              ) : (
                <div className="max-h-64 divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200">
                  {filteredGtk.map((gtk) => {
                    const displayName = formatPtkDisplayName(gtk);
                    const isSelectedActive = isEnabled && activeGtkId === gtk.id;
                    const isOpActive = operatorStatusMap.get(gtk.id) ?? true;
                    const roleText = buildRoleLabel(gtk);

                    return (
                      <div
                        key={gtk.id}
                        className={`flex flex-col justify-between gap-2.5 p-3 sm:flex-row sm:items-center ${
                          isSelectedActive
                            ? 'bg-blue-50/60'
                            : !isOpActive
                              ? 'bg-slate-50 opacity-80'
                              : 'bg-white'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {gtk.fotoDataUrl ? (
                            <img
                              src={gtk.fotoDataUrl}
                              alt={displayName}
                              className="h-9 w-9 shrink-0 rounded-lg object-cover bg-slate-100"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700">
                              {getInitials(displayName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-xs font-semibold text-slate-900">
                                {displayName}
                              </p>
                              {!isOpActive && (
                                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                  Dinonaktifkan
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[11px] text-slate-500">
                              {roleText}
                              {(gtk.nip || gtk.nuptk) ? ` · ${gtk.nip || gtk.nuptk}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleToggleGtkActive(gtk)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap ${
                              isOpActive
                                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            {isOpActive ? (
                              <>
                                <UserX className="h-3 w-3" aria-hidden="true" />
                                <span>Nonaktifkan</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3 w-3" aria-hidden="true" />
                                <span>Aktifkan</span>
                              </>
                            )}
                          </button>

                          {isSelectedActive ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-2.5 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              <span>Petugas Aktif</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAssignGtk(gtk)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                            >
                              <ArrowRightLeft className="h-3 w-3" aria-hidden="true" />
                              <span>Alihkan ke Pegawai Ini</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan Petugas TU'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
