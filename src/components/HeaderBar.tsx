import { Lock, Menu, Plus, ShieldCheck } from 'lucide-react';
import { UserMode, WorkspaceTab } from '../types/tu';

interface HeaderBarProps {
  activeTab: WorkspaceTab;
  userMode: UserMode;
  onOpenMobileMenu: () => void;
  onQuickCreate: () => void;
  onRequestPetugasAccess: () => void;
}

const PEMOHON_TAB_LABELS: Record<WorkspaceTab, string> = {
  beranda: 'Beranda Loket',
  ajukan: 'Ajukan Permohonan',
  antrean: 'Lacak & Antrean Surat',
  dapodik: 'Database Siswa (Terproteksi)',
  agenda: 'Buku Agenda Surat (Terproteksi)',
  cetak: 'Cetak Tanda Terima',
};

const PETUGAS_TAB_LABELS: Record<WorkspaceTab, string> = {
  beranda: 'Beranda Loket',
  ajukan: 'Buat Permohonan Layanan',
  antrean: 'Kelola Antrean & Disposisi',
  dapodik: 'Database Siswa (Aturan Dapodik)',
  agenda: 'Buku Agenda Surat Masuk & Keluar',
  cetak: 'Pratinjau & Cetak Dokumen Resmi',
};

export function HeaderBar({
  activeTab,
  userMode,
  onOpenMobileMenu,
  onQuickCreate,
  onRequestPetugasAccess,
}: HeaderBarProps) {
  const isPetugas = userMode === 'petugas';
  const labels = isPetugas ? PETUGAS_TAB_LABELS : PEMOHON_TAB_LABELS;

  return (
    <header
      className={`no-print sticky top-0 z-30 flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6 lg:px-8 ${
        isPetugas
          ? 'border-slate-200 bg-white'
          : 'border-slate-200 bg-white'
      }`}
    >
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

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onQuickCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Ajukan Surat</span>
        </button>
      </div>
    </header>
  );
}
