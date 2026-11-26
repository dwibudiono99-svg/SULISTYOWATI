import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  Lock,
  Menu,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DapodikGtk, TuStaffConfig, UserMode, WorkspaceTab } from '../types/tu';
import { formatPtkDisplayName } from '../utils/gtkDapodikValidation';
import { buildGtkRoleLabel, isPegawaiTuCandidate } from './TuStaffSettingsModal';

interface HeaderBarProps {
  activeTab: WorkspaceTab;
  userMode: UserMode;
  reportingOpen: boolean;
  tuStaff?: TuStaffConfig;
  gtkList?: DapodikGtk[];
  onOpenMobileMenu: () => void;
  onQuickCreate: () => void;
  onRequestPetugasAccess: () => void;
  onOpenReportingControl?: () => void;
  onQuickSwitchTuStaff?: (nextConfig: Partial<TuStaffConfig>) => Promise<boolean>;
  onOpenTuStaffSettings?: () => void;
}

const PEMOHON_TAB_LABELS: Record<WorkspaceTab, string> = {
  beranda: 'Beranda Loket',
  ajukan: 'Ajukan Permohonan',
  antrean: 'Lacak & Antrean Surat',
  dapodik: 'Database Siswa (Terproteksi)',
  gtk: 'Database GTK (Terproteksi)',
  rombel: 'Setting Rombel & Wali Kelas (Terproteksi)',
  agenda: 'Buku Agenda Surat (Terproteksi)',
  cetak: 'Cetak Tanda Terima',
  backup: 'Backup & Restore (Terproteksi)',
};

const PETUGAS_TAB_LABELS: Record<WorkspaceTab, string> = {
  beranda: 'Beranda Loket',
  ajukan: 'Buat Permohonan Layanan',
  antrean: 'Kelola Antrean & Disposisi',
  dapodik: 'Database Siswa (Aturan Dapodik)',
  gtk: 'Database GTK Dapodik (Padan Dispendukcapil)',
  rombel: 'Setting Rombongan Belajar & Wali Kelas',
  agenda: 'Buku Agenda Surat Masuk & Keluar',
  cetak: 'Pratinjau & Cetak Dokumen Resmi',
  backup: 'Backup, Restore, Import/Export & Email',
};

export function HeaderBar({
  activeTab,
  userMode,
  reportingOpen,
  tuStaff,
  gtkList = [],
  onOpenMobileMenu,
  onQuickCreate,
  onRequestPetugasAccess,
  onOpenReportingControl,
  onQuickSwitchTuStaff,
  onOpenTuStaffSettings,
}: HeaderBarProps) {
  const isPetugas = userMode === 'petugas';
  const labels = isPetugas ? PETUGAS_TAB_LABELS : PEMOHON_TAB_LABELS;
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!switcherOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [switcherOpen]);

  const quickCandidates = useMemo(() => {
    const tuOnes = gtkList.filter(isPegawaiTuCandidate);
    return (tuOnes.length > 0 ? tuOnes : gtkList).slice(0, 8);
  }, [gtkList]);

  const handleSelectGtkQuick = async (gtk: DapodikGtk) => {
    if (!onQuickSwitchTuStaff || switching) return;
    setSwitching(true);
    const displayName = formatPtkDisplayName(gtk);
    const nip = (gtk.nip || gtk.nuptk || '').trim();
    const role = buildGtkRoleLabel(gtk);
    const existingOps = tuStaff?.operators || [];
    const nextOps = existingOps.some((o) => o.gtkId === gtk.id)
      ? existingOps.map((o) => (o.gtkId === gtk.id ? { ...o, isActive: true } : o))
      : [
          {
            gtkId: gtk.id,
            nama: displayName,
            nip,
            jabatan: role,
            fotoDataUrl: gtk.fotoDataUrl || '',
            isActive: true,
            updatedAt: new Date().toISOString(),
          },
          ...existingOps,
        ];
    await onQuickSwitchTuStaff({
      isEnabled: true,
      activeGtkId: gtk.id,
      activeStaffName: displayName,
      activeStaffNip: nip,
      activeStaffRole: role,
      activeStaffPhoto: gtk.fotoDataUrl || '',
      deactivatedReason: '',
      operators: nextOps,
    });
    setSwitching(false);
    setSwitcherOpen(false);
  };

  const handleToggleQuick = async (nextEnabled: boolean) => {
    if (!onQuickSwitchTuStaff || switching) return;
    setSwitching(true);
    await onQuickSwitchTuStaff({
      isEnabled: nextEnabled,
      deactivatedReason: nextEnabled ? '' : tuStaff?.deactivatedReason || '',
    });
    setSwitching(false);
    setSwitcherOpen(false);
  };

  return (
    <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
          aria-label="Buka menu navigasi"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden truncate font-medium text-slate-500 sm:inline">
            SIP TU SMAN 9 Surabaya
          </span>
          <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="truncate font-semibold text-slate-900">
            {labels[activeTab]}
          </h1>
          <span className="hidden text-slate-300 md:inline" aria-hidden="true">
            ·
          </span>
          {isPetugas ? (
            <span className="hidden items-center gap-1 text-xs font-medium text-emerald-700 md:inline-flex whitespace-nowrap">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Portal Petugas TU</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onRequestPetugasAccess}
              className="hidden items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-700 md:inline-flex whitespace-nowrap"
            >
              <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Portal Pemohon</span>
            </button>
          )}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isPetugas && tuStaff && onOpenTuStaffSettings && (
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setSwitcherOpen((v) => !v)}
              aria-expanded={switcherOpen}
              aria-haspopup="menu"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                tuStaff.isEnabled
                  ? 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100'
                  : 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="max-w-[130px] truncate sm:max-w-[180px]">
                {tuStaff.isEnabled ? tuStaff.activeStaffName : 'Petugas TU: Nonaktif'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
            </button>

            {switcherOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Pindah / Atur Petugas TU Cepat
                  </p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-900">
                    {tuStaff.isEnabled ? tuStaff.activeStaffName : 'Petugas TU Dinonaktifkan'}
                  </p>
                </div>

                {quickCandidates.length > 0 && (
                  <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto py-1">
                    {quickCandidates.map((gtk) => {
                      const displayName = formatPtkDisplayName(gtk);
                      const isCurrent = tuStaff.isEnabled && tuStaff.activeGtkId === gtk.id;
                      return (
                        <button
                          key={gtk.id}
                          type="button"
                          disabled={switching}
                          onClick={() => void handleSelectGtkQuick(gtk)}
                          className={`flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-xs hover:bg-slate-50 disabled:opacity-60 ${
                            isCurrent ? 'bg-blue-50/60 font-semibold text-blue-900' : 'text-slate-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate">{displayName}</p>
                            <p className="truncate text-[10px] text-slate-500">
                              {buildGtkRoleLabel(gtk)}
                            </p>
                          </div>
                          {isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-blue-700" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="border-t border-slate-200 bg-slate-50/70 p-2 space-y-1">
                  {onQuickSwitchTuStaff && (
                    <button
                      type="button"
                      disabled={switching}
                      onClick={() => void handleToggleQuick(!tuStaff.isEnabled)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${
                        tuStaff.isEnabled
                          ? 'text-rose-700 hover:bg-rose-50'
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {tuStaff.isEnabled
                          ? 'Nonaktifkan Petugas TU'
                          : 'Aktifkan Kembali Petugas TU'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSwitcherOpen(false);
                      onOpenTuStaffSettings();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    <UserCog className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Ganti / Input Petugas TU Lainnya...</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isPetugas && onOpenReportingControl && (
          <button
            type="button"
            onClick={onOpenReportingControl}
            className={`hidden md:inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              reportingOpen
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <span>{reportingOpen ? 'Pelaporan Dibuka' : 'Pelaporan Ditutup'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onQuickCreate}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 ${
            !reportingOpen && !isPetugas
              ? 'bg-slate-500 hover:bg-slate-600 focus-visible:outline-slate-600'
              : 'bg-blue-700 hover:bg-blue-800 focus-visible:outline-blue-700'
          }`}
        >
          {!reportingOpen && !isPetugas ? (
            <>
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Loket Ditutup</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Ajukan Surat</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
