import {
  ArrowRightLeft,
  CheckCircle2,
  Database,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserCog,
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

export function isPegawaiTuCandidate(gtk: DapodikGtk): boolean {
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

export function buildGtkRoleLabel(gtk: DapodikGtk): string {
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
  const [deactivatedReason, setDeactivatedReason] = useState(config.deactivatedReason || '');
  const [manualName, setManualName] = useState('');
  const [manualNip, setManualNip] = useState('');
  const [manualRole, setManualRole] = useState('Petugas Pelayanan Tata Usaha');
  const [showManualForm, setShowManualForm] = useState(false);

  const [scopeFilter, setScopeFilter] = useState<'tu-only' | 'all-gtk'>('tu-only');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [inlineNotice, setInlineNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (open) {
      setDeactivatedReason(config.deactivatedReason || '');
      setManualName(config.activeGtkId ? '' : config.activeStaffName || '');
      setManualNip(config.activeGtkId ? '' : config.activeStaffNip || '');
      setManualRole(config.activeGtkId ? 'Petugas Pelayanan Tata Usaha' : config.activeStaffRole || 'Petugas Pelayanan Tata Usaha');
      setShowManualForm(gtkList.length === 0);
      setSearchQuery('');
      setSavingKey(null);
      setInlineNotice(null);

      const hasTuCandidate = gtkList.some(isPegawaiTuCandidate);
      setScopeFilter(hasTuCandidate || gtkList.length === 0 ? 'tu-only' : 'all-gtk');
    }
  }, [config, gtkList, open]);

  const operatorStatusMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const op of config.operators || []) {
      map.set(op.gtkId, op.isActive);
    }
    return map;
  }, [config.operators]);

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
      jabatan: buildGtkRoleLabel(gtk),
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

  const commitChange = async (
    key: string,
    payload: Partial<TuStaffConfig>,
    successMsg: string
  ) => {
    if (savingKey) return;
    setSavingKey(key);
    setInlineNotice(null);
    const ok = await onSave(payload);
    setSavingKey(null);
    if (ok) {
      setInlineNotice({ type: 'ok', text: successMsg });
    } else {
      setInlineNotice({
        type: 'err',
        text: 'Gagal menyimpan perubahan Petugas TU ke server. Coba lagi.',
      });
    }
  };

  const handleToggleGlobal = (nextEnabled: boolean) => {
    void commitChange(
      'global-toggle',
      {
        isEnabled: nextEnabled,
        deactivatedReason: nextEnabled ? '' : deactivatedReason.trim(),
      },
      nextEnabled
        ? `Petugas TU diaktifkan (${config.activeStaffName}).`
        : 'Penugasan Petugas TU dinonaktifkan.'
    );
  };

  const handleSaveDeactivatedReason = (e: FormEvent) => {
    e.preventDefault();
    void commitChange(
      'reason',
      {
        isEnabled: false,
        deactivatedReason: deactivatedReason.trim(),
      },
      'Catatan penonaktifan Petugas TU diperbarui.'
    );
  };

  const handleAssignGtk = (gtk: DapodikGtk) => {
    const displayName = formatPtkDisplayName(gtk);
    const nip = (gtk.nip || gtk.nuptk || '').trim();
    const role = buildGtkRoleLabel(gtk);
    const nextOperators = upsertOperatorState(gtk, true, config.operators || []);
    void commitChange(
      `assign-${gtk.id}`,
      {
        isEnabled: true,
        activeGtkId: gtk.id,
        activeStaffName: displayName,
        activeStaffNip: nip,
        activeStaffRole: role,
        activeStaffPhoto: gtk.fotoDataUrl || '',
        deactivatedReason: '',
        operators: nextOperators,
      },
      `Petugas TU berhasil dialihkan ke ${displayName}.`
    );
  };

  const handleToggleGtkActive = (gtk: DapodikGtk) => {
    const currentlyActive = operatorStatusMap.get(gtk.id) ?? true;
    const nextActive = !currentlyActive;
    const nextOperators = upsertOperatorState(gtk, nextActive, config.operators || []);
    const displayName = formatPtkDisplayName(gtk);

    if (!nextActive && config.activeGtkId === gtk.id) {
      const otherActive = nextOperators.find((o) => o.gtkId !== gtk.id && o.isActive);
      if (otherActive) {
        void commitChange(
          `toggle-${gtk.id}`,
          {
            isEnabled: true,
            activeGtkId: otherActive.gtkId,
            activeStaffName: otherActive.nama,
            activeStaffNip: otherActive.nip,
            activeStaffRole: otherActive.jabatan,
            activeStaffPhoto: otherActive.fotoDataUrl || '',
            operators: nextOperators,
          },
          `${displayName} dinonaktifkan. Petugas TU dialihkan ke ${otherActive.nama}.`
        );
      } else {
        const reason = `${displayName} dinonaktifkan dari penugasan Petugas TU.`;
        setDeactivatedReason(reason);
        void commitChange(
          `toggle-${gtk.id}`,
          {
            isEnabled: false,
            deactivatedReason: reason,
            operators: nextOperators,
          },
          `${displayName} dan penugasan Petugas TU dinonaktifkan.`
        );
      }
      return;
    }

    void commitChange(
      `toggle-${gtk.id}`,
      { operators: nextOperators },
      nextActive ? `${displayName} diaktifkan kembali.` : `${displayName} dinonaktifkan.`
    );
  };

  const handleAssignManual = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = manualName.trim();
    if (!trimmedName) {
      setInlineNotice({ type: 'err', text: 'Nama Petugas TU wajib diisi.' });
      return;
    }
    void commitChange(
      'manual-assign',
      {
        isEnabled: true,
        activeGtkId: null,
        activeStaffName: trimmedName,
        activeStaffNip: manualNip.trim(),
        activeStaffRole: manualRole.trim() || 'Petugas Pelayanan Tata Usaha',
        activeStaffPhoto: '',
        deactivatedReason: '',
      },
      `Petugas TU berhasil dialihkan ke ${trimmedName}.`
    );
  };

  const handleResetDefault = () => {
    void commitChange(
      'reset-default',
      {
        isEnabled: true,
        activeGtkId: null,
        activeStaffName: SCHOOL_INFO.staffName,
        activeStaffNip: '',
        activeStaffRole: SCHOOL_INFO.staffRole,
        activeStaffPhoto: SCHOOL_INFO.staffAvatar,
        deactivatedReason: '',
      },
      `Petugas TU dikembalikan ke koordinator default (${SCHOOL_INFO.staffName}).`
    );
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
                Pengalihan &amp; Pengaturan Petugas TU
              </h2>
              <p className="mt-0.5 text-xs text-slate-300">
                Klik pegawai untuk langsung berpindah tugas (tersimpan otomatis), atau nonaktifkan penugasan petugas.
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

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {inlineNotice && (
            <div
              role="status"
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                inlineNotice.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{inlineNotice.text}</span>
            </div>
          )}

          {/* Ringkasan Petugas TU Terpilih Saat Ini */}
          <div
            className={`flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
              config.isEnabled
                ? 'border-blue-200 bg-blue-50/60'
                : 'border-rose-200 bg-rose-50/60'
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              {config.activeStaffPhoto && config.isEnabled ? (
                <img
                  src={config.activeStaffPhoto}
                  alt={config.activeStaffName}
                  referrerPolicy="no-referrer"
                  className="h-11 w-11 shrink-0 rounded-lg object-cover bg-slate-200"
                />
              ) : (
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    config.isEnabled ? 'bg-blue-700 text-white' : 'bg-rose-700 text-white'
                  }`}
                >
                  {config.isEnabled ? getInitials(config.activeStaffName) : 'OFF'}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {config.isEnabled ? config.activeStaffName : 'Petugas TU Dinonaktifkan'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      config.isEnabled
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {config.isEnabled ? 'Aktif Bertugas' : 'Nonaktif'}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-600">
                  {config.isEnabled
                    ? `${config.activeStaffRole}${config.activeStaffNip ? ` · NIP/NUPTK: ${config.activeStaffNip}` : ''}`
                    : config.deactivatedReason || 'Penugasan petugas loket sedang dinonaktifkan.'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowManualForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100"
              >
                <UserCog className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                <span>{showManualForm ? 'Tutup Input Manual' : 'Input / Ganti Manual'}</span>
              </button>
              {config.activeStaffName !== SCHOOL_INFO.staffName && (
                <button
                  type="button"
                  disabled={Boolean(savingKey)}
                  onClick={handleResetDefault}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Reset Koordinator
                </button>
              )}
            </div>
          </div>

          {/* 1-Klik Toggle Status Aktif / Nonaktif */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status Penugasan Petugas TU (Langsung Tersimpan)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={Boolean(savingKey)}
                onClick={() => handleToggleGlobal(true)}
                className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition disabled:opacity-60 ${
                  config.isEnabled
                    ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <ShieldCheck
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    config.isEnabled ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-900">Aktifkan Petugas TU</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    Nama petugas aktif langsung tampil di loket, tiket baru, dan cetak tanda terima.
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={Boolean(savingKey)}
                onClick={() => handleToggleGlobal(false)}
                className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition disabled:opacity-60 ${
                  !config.isEnabled
                    ? 'border-rose-600 bg-rose-50/70 ring-1 ring-rose-600'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <ShieldAlert
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    !config.isEnabled ? 'text-rose-700' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Nonaktifkan Petugas TU
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    Hentikan penugasan petugas saat ini (akses token admin tetap aman).
                  </p>
                </div>
              </button>
            </div>

            {!config.isEnabled && (
              <form onSubmit={handleSaveDeactivatedReason} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={deactivatedReason}
                  onChange={(e) => setDeactivatedReason(e.target.value)}
                  placeholder="Catatan penonaktifan (contoh: Petugas piket sedang berganti shift)..."
                  aria-label="Catatan penonaktifan"
                  className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={Boolean(savingKey)}
                  className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Simpan Catatan
                </button>
              </form>
            )}
          </div>

          {/* Form Ganti / Alihkan Petugas TU Secara Langsung (Manual) */}
          {showManualForm && (
            <form
              onSubmit={handleAssignManual}
              className="space-y-3 rounded-xl border border-blue-200 bg-slate-50 p-4"
            >
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-800">
                  Alihkan Petugas TU Langsung (Tanpa Menunggu Impor GTK)
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Masukkan nama petugas pengganti untuk langsung mengalihkan sesi Petugas TU saat ini.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div>
                  <label htmlFor="manual-staff-name" className="block text-[11px] font-medium text-slate-700">
                    Nama Petugas TU *
                  </label>
                  <input
                    id="manual-staff-name"
                    type="text"
                    required
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Contoh: Drs. Ahmad Fauzi"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="manual-staff-nip" className="block text-[11px] font-medium text-slate-700">
                    NIP / NUPTK
                  </label>
                  <input
                    id="manual-staff-nip"
                    type="text"
                    value={manualNip}
                    onChange={(e) => setManualNip(e.target.value)}
                    placeholder="Opsional"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="manual-staff-role" className="block text-[11px] font-medium text-slate-700">
                    Jabatan / Peran Loket
                  </label>
                  <input
                    id="manual-staff-role"
                    type="text"
                    value={manualRole}
                    onChange={(e) => setManualRole(e.target.value)}
                    placeholder="Staf Tata Usaha"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={Boolean(savingKey)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {savingKey === 'manual-assign' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Terapkan &amp; Alihkan Petugas</span>
                </button>
              </div>
            </form>
          )}

          {/* Daftar Pegawai TU dari Database GTK Dapodik */}
          <div className="space-y-3">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Pilih Pegawai dari Database Pegawai TU / GTK Dapodik
                </h3>
                <p className="text-[11px] text-slate-500">
                  Klik &ldquo;Alihkan ke Pegawai Ini&rdquo; untuk berpindah tugas secara langsung.
                </p>
              </div>

              <div className="inline-flex self-start rounded-lg border border-slate-200 bg-slate-100 p-0.5">
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
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                <Database className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-slate-800">
                  Database GTK Dapodik masih kosong
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Anda tetap bisa mengalihkan petugas lewat form &ldquo;Input / Ganti Manual&rdquo; di atas, atau unggah daftar PTK di Database GTK.
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
                  const isSelectedActive = config.isEnabled && config.activeGtkId === gtk.id;
                  const isOpActive = operatorStatusMap.get(gtk.id) ?? true;
                  const roleText = buildGtkRoleLabel(gtk);
                  const isRowSaving =
                    savingKey === `assign-${gtk.id}` || savingKey === `toggle-${gtk.id}`;

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
                            {gtk.nip || gtk.nuptk ? ` · ${gtk.nip || gtk.nuptk}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          disabled={Boolean(savingKey)}
                          onClick={() => handleToggleGtkActive(gtk)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap disabled:opacity-50 ${
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
                            disabled={Boolean(savingKey)}
                            onClick={() => handleAssignGtk(gtk)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 whitespace-nowrap disabled:opacity-50"
                          >
                            {isRowSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : (
                              <ArrowRightLeft className="h-3 w-3" aria-hidden="true" />
                            )}
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

        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
