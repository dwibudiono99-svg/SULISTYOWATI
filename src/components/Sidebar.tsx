import {
  BookOpenCheck,
  Database,
  FilePlus2,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogOut,
  Printer,
  School,
  ShieldCheck,
  ToggleLeft,
  Users,
  X,
} from 'lucide-react';
import { SCHOOL_INFO } from '../config/schoolConfig';
import { ReportingPortalConfig, UserMode, WorkspaceTab } from '../types/tu';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  userMode: UserMode;
  onRequestPetugasAccess: (targetTab?: WorkspaceTab) => void;
  onLogoutPetugas: () => void;
  onOpenChangeToken: () => void;
  onOpenReportingControl: () => void;
  reportingPortal: ReportingPortalConfig;
  canChangeToken: boolean;
  pendingCount: number;
  studentCount: number;
  gtkCount: number;
  rombelCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const PEMOHON_NAV: { id: WorkspaceTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'beranda', label: 'Beranda Loket', icon: LayoutDashboard },
  { id: 'ajukan', label: 'Ajukan Permohonan', icon: FilePlus2 },
  { id: 'antrean', label: 'Lacak & Antrean', icon: ListChecks },
  { id: 'cetak', label: 'Cetak Tanda Terima', icon: Printer },
];

const PROTECTED_SHORTCUTS: { id: WorkspaceTab; label: string; icon: typeof Database }[] = [
  { id: 'dapodik', label: 'Database Siswa Dapodik', icon: Database },
  { id: 'gtk', label: 'Database GTK Dapodik', icon: Users },
  { id: 'rombel', label: 'Setting Rombel & Wali', icon: School },
  { id: 'agenda', label: 'Agenda Surat TU', icon: BookOpenCheck },
];

const PETUGAS_NAV: { id: WorkspaceTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'beranda', label: 'Beranda Loket', icon: LayoutDashboard },
  { id: 'antrean', label: 'Kelola Antrean', icon: ListChecks },
  { id: 'dapodik', label: 'Database Siswa Dapodik', icon: Database },
  { id: 'gtk', label: 'Database GTK Dapodik', icon: Users },
  { id: 'rombel', label: 'Setting Rombel & Wali', icon: School },
  { id: 'agenda', label: 'Agenda Surat TU', icon: BookOpenCheck },
  { id: 'ajukan', label: 'Buat Permohonan', icon: FilePlus2 },
  { id: 'cetak', label: 'Cetak Dokumen', icon: Printer },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  userMode,
  onRequestPetugasAccess,
  onLogoutPetugas,
  onOpenChangeToken,
  onOpenReportingControl,
  reportingPortal,
  canChangeToken,
  pendingCount,
  studentCount,
  gtkCount,
  rombelCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const isPetugas = userMode === 'petugas';
  const primaryItems = isPetugas ? PETUGAS_NAV : PEMOHON_NAV;

  const navContent = (
    <div
      className={`flex h-full flex-col ${
        isPetugas ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'
      }`}
    >
      {/* Brand */}
      <div
        className={`flex items-center justify-between border-b px-5 py-4 ${
          isPetugas ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <svg
              viewBox="0 0 32 32"
              className={`h-7 w-7 shrink-0 ${isPetugas ? 'text-blue-400' : 'text-blue-700'}`}
              fill="none"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="26" height="24" rx="4" stroke="currentColor" strokeWidth="2" />
              <path
                d="M9 11h14M9 16h10M9 21h7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="truncate text-base font-bold tracking-tight">
              SIP TU SMAN 9
            </span>
          </div>
          <p className={`mt-1 truncate text-xs ${isPetugas ? 'text-blue-300' : 'text-slate-500'}`}>
            {isPetugas ? 'Portal Petugas Tata Usaha' : 'Portal Layanan Pemohon'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className={`rounded-lg p-2 lg:hidden ${
            isPetugas
              ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
          aria-label="Tutup menu navigasi"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Menu utama SIP TU">
        <div>
          <p
            className={`mb-2 px-3.5 text-[11px] font-semibold uppercase tracking-wider ${
              isPetugas ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {isPetugas ? 'Menu Operasional TU' : 'Layanan Siswa & Umum'}
          </p>
          <div className="space-y-1">
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-700 text-white'
                      : isPetugas
                        ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </span>
                  {item.id === 'antrean' && pendingCount > 0 && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        isActive
                          ? 'text-blue-100'
                          : isPetugas
                            ? 'text-slate-400'
                            : 'text-slate-500'
                      }`}
                    >
                      {pendingCount}
                    </span>
                  )}
                  {isPetugas && item.id === 'dapodik' && studentCount > 0 && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        isActive ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {studentCount}
                    </span>
                  )}
                  {isPetugas && item.id === 'gtk' && gtkCount > 0 && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        isActive ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {gtkCount}
                    </span>
                  )}
                  {isPetugas && item.id === 'rombel' && rombelCount > 0 && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        isActive ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {rombelCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Locked section visible in Pemohon mode */}
        {!isPetugas && (
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 px-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Terproteksi Token Petugas TU
            </p>
            <div className="space-y-1">
              {PROTECTED_SHORTCUTS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onCloseMobile();
                      onRequestPetugasAccess(item.id);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap"
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span>{item.label}</span>
                    </span>
                    <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom Auth & Role Panel */}
      <div
        className={`border-t p-4 ${
          isPetugas ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
        }`}
      >
        {isPetugas ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={SCHOOL_INFO.staffAvatar}
                alt={SCHOOL_INFO.staffName}
                referrerPolicy="no-referrer"
                className="h-9 w-9 shrink-0 rounded-lg object-cover bg-slate-800"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span className="truncate">{SCHOOL_INFO.staffName}</span>
                </div>
                <p className="truncate text-xs text-slate-400">Sesi Petugas TU Aktif</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onOpenReportingControl();
                }}
                className={`inline-flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap ${
                  reportingPortal.isOpen
                    ? 'border-emerald-700/60 bg-emerald-950/50 text-emerald-300 hover:bg-emerald-950'
                    : 'border-rose-700/60 bg-rose-950/60 text-rose-200 hover:bg-rose-950'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ToggleLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{reportingPortal.isOpen ? 'Pelaporan: Dibuka' : 'Pelaporan: Ditutup'}</span>
                </span>
                <span className="text-[10px] underline">Atur</span>
              </button>
              {canChangeToken && (
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile();
                    onOpenChangeToken();
                  }}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap"
                >
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ubah Token Masuk</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onLogoutPetugas();
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600/90 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Kunci & Keluar Mode TU</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs leading-relaxed text-slate-600">
              Staf Tata Usaha SMAN 9 Surabaya? Masuk dengan token untuk membuka Database Dapodik & pengelolaan surat.
            </p>
            <button
              type="button"
              onClick={() => {
                onCloseMobile();
                onRequestPetugasAccess();
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
            >
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Masuk Petugas TU</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`no-print hidden w-64 shrink-0 border-r lg:block ${
          isPetugas ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <div className="sticky top-0 h-screen">{navContent}</div>
      </aside>

      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw]">{navContent}</div>
        </div>
      )}
    </>
  );
}
