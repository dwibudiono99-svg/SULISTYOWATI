import { CheckCircle2, Lock, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AgendaSuratView } from './components/AgendaSuratView';
import { DapodikDatabaseView } from './components/DapodikDatabaseView';
import { ImportMergeMode } from './components/DapodikImportExportModal';
import { DocumentPrintView } from './components/DocumentPrintView';
import { HeaderBar } from './components/HeaderBar';
import { OverviewView } from './components/OverviewView';
import { PetugasTokenGateModal, TuAuthStatus } from './components/PetugasTokenGateModal';
import { QueueTrackingView } from './components/QueueTrackingView';
import { RequestDetailDrawer } from './components/RequestDetailDrawer';
import { Sidebar } from './components/Sidebar';
import { SubmitRequestView } from './components/SubmitRequestView';
import { DEFAULT_KOP_SURAT_CONFIG, SCHOOL_INFO } from './config/schoolConfig';
import {
  AgendaEntry,
  DapodikStudent,
  KopSuratConfig,
  RequestStatus,
  ServiceCategoryId,
  ServiceRequest,
  UserMode,
  WorkspaceTab,
} from './types/tu';

const PROTECTED_TABS = new Set<WorkspaceTab>(['dapodik', 'agenda']);

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('beranda');
  const [userMode, setUserMode] = useState<UserMode>('pemohon');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<TuAuthStatus>({
    isConfigured: true,
    hasEnvToken: false,
    hasClaimedToken: false,
    authenticated: false,
    staffName: null,
  });

  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenModalMode, setTokenModalMode] = useState<'login' | 'claim' | 'change'>('login');
  const [pendingTargetTab, setPendingTargetTab] = useState<WorkspaceTab | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [agendaEntries, setAgendaEntries] = useState<AgendaEntry[]>([]);
  const [students, setStudents] = useState<DapodikStudent[]>([]);
  const [kopSuratConfig, setKopSuratConfig] = useState<KopSuratConfig>(DEFAULT_KOP_SURAT_CONFIG);

  const [selectedServiceId, setSelectedServiceId] = useState<ServiceCategoryId>('surat-aktif');
  const [prefillStudent, setPrefillStudent] = useState<DapodikStudent | null>(null);
  const [queueSearchInitial, setQueueSearchInitial] = useState('');
  const [inspectedRequestId, setInspectedRequestId] = useState<string | null>(null);
  const [printTargetId, setPrintTargetId] = useState<string | undefined>(undefined);
  const [printDocMode, setPrintDocMode] = useState<'surat' | 'tanda-terima'>('tanda-terima');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const refreshAuthStatus = useCallback(async (token: string | null) => {
    try {
      const res = await fetch('/api/tu-auth/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const data = (await res.json()) as TuAuthStatus;
        setAuthStatus(data);
        return data;
      }
    } catch {
      // Network error fallback
    }
    return null;
  }, []);

  const loadPublicRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/requests/public');
      if (res.ok) {
        const data = (await res.json()) as ServiceRequest[];
        setRequests(data);
      }
    } catch {
      // Ignore transient network failure
    }
  }, []);

  const loadKopSurat = useCallback(async () => {
    try {
      const res = await fetch('/api/kop-surat');
      if (res.ok) {
        const data = (await res.json()) as KopSuratConfig;
        setKopSuratConfig(data);
      }
    } catch {
      // Fallback to default config
    }
  }, []);

  const handleLockToPemohon = useCallback(
    (message?: string) => {
      setSessionToken(null);
      setUserMode('pemohon');
      setStudents([]);
      setAgendaEntries([]);
      setPrefillStudent(null);
      setActiveTab((curr) => (PROTECTED_TABS.has(curr) ? 'beranda' : curr));
      setPrintDocMode('tanda-terima');
      void refreshAuthStatus(null);
      void loadPublicRequests();
      if (message) setToastMessage(message);
    },
    [loadPublicRequests, refreshAuthStatus]
  );

  const loadProtectedData = useCallback(
    async (token: string) => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [reqRes, stuRes, agRes] = await Promise.all([
          fetch('/api/requests', { headers }),
          fetch('/api/students', { headers }),
          fetch('/api/agenda', { headers }),
        ]);

        if (reqRes.status === 401 || stuRes.status === 401 || agRes.status === 401) {
          handleLockToPemohon('Sesi Petugas TU berakhir. Silakan verifikasi token kembali.');
          return;
        }

        if (reqRes.ok) setRequests((await reqRes.json()) as ServiceRequest[]);
        if (stuRes.ok) setStudents((await stuRes.json()) as DapodikStudent[]);
        if (agRes.ok) setAgendaEntries((await agRes.json()) as AgendaEntry[]);
      } catch {
        setToastMessage('Gagal memuat data Petugas TU dari server.');
      }
    },
    [handleLockToPemohon]
  );

  useEffect(() => {
    void refreshAuthStatus(null);
    void loadPublicRequests();
    void loadKopSurat();
  }, [loadKopSurat, loadPublicRequests, refreshAuthStatus]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const requestPetugasAccess = async (targetTab?: WorkspaceTab) => {
    if (userMode === 'petugas' && sessionToken) {
      if (targetTab) setActiveTab(targetTab);
      return;
    }
    const status = await refreshAuthStatus(sessionToken);
    setPendingTargetTab(targetTab ?? null);
    setTokenModalMode(status && !status.isConfigured ? 'claim' : 'login');
    setTokenModalOpen(true);
  };

  const handleSelectTab = (tab: WorkspaceTab) => {
    if (PROTECTED_TABS.has(tab) && (userMode !== 'petugas' || !sessionToken)) {
      void requestPetugasAccess(tab);
      return;
    }
    setActiveTab(tab);
  };

  const handleAuthenticated = async (token: string, staffName: string) => {
    setSessionToken(token);
    setUserMode('petugas');
    setTokenModalOpen(false);
    await refreshAuthStatus(token);
    await loadProtectedData(token);
    if (pendingTargetTab) {
      setActiveTab(pendingTargetTab);
      setPendingTargetTab(null);
    }
    setToastMessage(`Berhasil masuk Portal Petugas TU (${staffName}).`);
  };

  const handleLogoutPetugas = async () => {
    if (sessionToken) {
      try {
        await fetch('/api/tu-auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    handleLockToPemohon('Portal Petugas TU telah dikunci. Anda kembali ke Mode Pemohon.');
  };

  const inspectedRequest = requests.find((r) => r.id === inspectedRequestId) ?? null;
  const pendingCount = requests.filter((r) => r.status !== 'Selesai').length;

  const handleStartRequest = (serviceId: ServiceCategoryId) => {
    setPrefillStudent(null);
    setSelectedServiceId(serviceId);
    setActiveTab('ajukan');
  };

  const handleCreateLetterFromStudent = (
    student: DapodikStudent,
    serviceId: ServiceCategoryId
  ) => {
    setPrefillStudent(student);
    setSelectedServiceId(serviceId);
    setActiveTab('ajukan');
  };

  const handleSubmitNewRequest = async (newReq: ServiceRequest) => {
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReq),
      });
      if (!res.ok) {
        setToastMessage('Gagal mengirim permohonan layanan.');
        return;
      }
      const created = (await res.json()) as ServiceRequest;
      if (userMode === 'petugas' && sessionToken) {
        await loadProtectedData(sessionToken);
      } else {
        await loadPublicRequests();
      }
      setPrefillStudent(null);
      setInspectedRequestId(created.id);
      setActiveTab('antrean');
      setToastMessage(`Permohonan ${created.id} berhasil diajukan ke antrean Tata Usaha.`);
    } catch {
      setToastMessage('Terjadi gangguan koneksi saat mengirim permohonan.');
    }
  };

  const handleTrackExact = async (query: string): Promise<ServiceRequest | null> => {
    try {
      const res = await fetch(`/api/requests/track?q=${encodeURIComponent(query)}`);
      if (!res.ok) return null;
      const list = (await res.json()) as ServiceRequest[];
      if (list.length > 0) {
        setRequests((prev) => {
          const exists = prev.some((r) => r.id === list[0].id);
          return exists ? prev : [list[0], ...prev];
        });
        return list[0];
      }
    } catch {
      // Ignore
    }
    return null;
  };

  const handleUpdateStatus = async (
    requestId: string,
    newStatus: RequestStatus,
    letterNumber: string,
    staffNote: string,
    addToAgenda: boolean
  ) => {
    if (!sessionToken) {
      void requestPetugasAccess('antrean');
      return;
    }

    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ newStatus, letterNumber, staffNote, addToAgenda }),
      });

      if (res.status === 401) {
        handleLockToPemohon('Sesi Petugas TU berakhir. Silakan masuk dengan token kembali.');
        return;
      }

      if (!res.ok) {
        setToastMessage('Gagal memperbarui status permohonan.');
        return;
      }

      const data = (await res.json()) as {
        request: ServiceRequest;
        createdAgenda: AgendaEntry | null;
      };
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? data.request : r))
      );
      if (data.createdAgenda) {
        setAgendaEntries((prev) => [data.createdAgenda!, ...prev]);
      }
      setToastMessage(`Status tiket ${requestId} diperbarui menjadi ${newStatus}.`);
    } catch {
      setToastMessage('Terjadi kesalahan saat menyimpan status tiket.');
    }
  };

  const handleOpenPrintForRequest = (
    request: ServiceRequest,
    docType: 'surat' | 'tanda-terima'
  ) => {
    setPrintTargetId(request.id);
    setPrintDocMode(userMode === 'petugas' ? docType : 'tanda-terima');
    setInspectedRequestId(null);
    setActiveTab('cetak');
  };

  const handleSaveStudent = async (saved: DapodikStudent, isNew: boolean) => {
    if (!sessionToken) return;
    try {
      const url = isNew ? '/api/students' : `/api/students/${encodeURIComponent(saved.id)}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(saved),
      });

      if (res.status === 401) {
        handleLockToPemohon('Sesi Petugas TU berakhir. Silakan verifikasi token kembali.');
        return;
      }

      if (!res.ok) {
        setToastMessage('Gagal menyimpan data peserta didik Dapodik.');
        return;
      }

      const record = (await res.json()) as DapodikStudent;
      setStudents((prev) =>
        isNew ? [record, ...prev] : prev.map((item) => (item.id === record.id ? record : item))
      );
      setToastMessage(
        isNew
          ? `Peserta didik ${record.nama} ditambahkan ke Database Dapodik.`
          : `Data Dapodik ${record.nama} berhasil diperbarui.`
      );
    } catch {
      setToastMessage('Gagal terhubung ke server Database Dapodik.');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.status === 401) {
        handleLockToPemohon('Sesi Petugas TU berakhir.');
        return;
      }
      if (res.ok) {
        setStudents((prev) => prev.filter((item) => item.id !== id));
        setToastMessage('Data peserta didik dihapus dari database.');
      }
    } catch {
      setToastMessage('Gagal menghapus data peserta didik.');
    }
  };

  const handleImportStudents = async (
    imported: DapodikStudent[],
    mode: ImportMergeMode
  ) => {
    if (!sessionToken) return;
    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ students: imported, mode }),
      });

      if (res.status === 401) {
        handleLockToPemohon('Sesi Petugas TU berakhir.');
        return;
      }

      if (!res.ok) {
        setToastMessage('Gagal mengimpor file data siswa.');
        return;
      }

      const result = (await res.json()) as {
        students: DapodikStudent[];
        addedCount: number;
        updatedCount: number;
      };
      setStudents(result.students);
      setToastMessage(
        `Impor selesai: ${result.addedCount} siswa baru ditambahkan, ${result.updatedCount} data siswa diperbarui.`
      );
    } catch {
      setToastMessage('Gagal mengimpor data ke server.');
    }
  };

  const handleAddAgenda = async (entry: AgendaEntry) => {
    if (!sessionToken) return;
    try {
      const res = await fetch('/api/agenda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(entry),
      });
      if (res.status === 401) {
        handleLockToPemohon('Sesi Petugas TU berakhir.');
        return;
      }
      if (res.ok) {
        const created = (await res.json()) as AgendaEntry;
        setAgendaEntries((prev) => [created, ...prev]);
        setToastMessage(`Agenda ${created.agendaNumber} berhasil dicatat.`);
      }
    } catch {
      setToastMessage('Gagal mencatat agenda surat.');
    }
  };

  const handleDeleteAgenda = async (id: string) => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`/api/agenda/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.status === 401) {
        handleLockToPemohon('Sesi Petugas TU berakhir.');
        return;
      }
      if (res.ok) {
        setAgendaEntries((prev) => prev.filter((item) => item.id !== id));
        setToastMessage('Entri agenda surat dihapus.');
      }
    } catch {
      setToastMessage('Gagal menghapus entri agenda.');
    }
  };

  const handleSaveKopSurat = async (nextConfig: KopSuratConfig): Promise<boolean> => {
    if (!sessionToken) {
      void requestPetugasAccess('cetak');
      return false;
    }
    try {
      const res = await fetch('/api/kop-surat', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(nextConfig),
      });
      if (res.status === 401) {
        handleLockToPemohon('Sesi Petugas TU berakhir. Silakan verifikasi token kembali.');
        return false;
      }
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        setToastMessage(errBody?.error || 'Gagal menyimpan konfigurasi Kop Surat.');
        return false;
      }
      const saved = (await res.json()) as KopSuratConfig;
      setKopSuratConfig(saved);
      setToastMessage('Konfigurasi Kop Surat sekolah berhasil disimpan.');
      return true;
    } catch {
      setToastMessage('Terjadi kesalahan koneksi saat menyimpan Kop Surat.');
      return false;
    }
  };

  const targetLabelMap: Record<WorkspaceTab, string> = {
    beranda: 'Beranda Loket',
    ajukan: 'Ajukan Permohonan',
    antrean: 'Kelola Antrean',
    dapodik: 'Database Siswa Dapodik',
    agenda: 'Buku Agenda Surat TU',
    cetak: 'Cetak Dokumen Resmi',
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        userMode={userMode}
        onRequestPetugasAccess={(tab) => void requestPetugasAccess(tab)}
        onLogoutPetugas={() => void handleLogoutPetugas()}
        onOpenChangeToken={() => {
          setTokenModalMode('change');
          setPendingTargetTab(null);
          setTokenModalOpen(true);
        }}
        canChangeToken={!authStatus.hasEnvToken}
        pendingCount={pendingCount}
        studentCount={students.length}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar
          activeTab={activeTab}
          userMode={userMode}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickCreate={() => {
            setPrefillStudent(null);
            setActiveTab('ajukan');
          }}
          onRequestPetugasAccess={() => void requestPetugasAccess()}
        />

        {toastMessage && (
          <div className="no-print mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <span>{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                aria-label="Tutup notifikasi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {activeTab === 'beranda' && (
            <OverviewView
              requests={requests}
              onStartRequest={handleStartRequest}
              onSelectRequest={(req) => setInspectedRequestId(req.id)}
              onNavigateQueue={(initialQuery) => {
                setQueueSearchInitial(initialQuery ?? '');
                setActiveTab('antrean');
              }}
              onTrackExact={handleTrackExact}
            />
          )}

          {activeTab === 'ajukan' && (
            <SubmitRequestView
              initialServiceId={selectedServiceId}
              existingCount={requests.length}
              userMode={userMode}
              students={students}
              prefillStudent={prefillStudent}
              onSubmitNewRequest={handleSubmitNewRequest}
            />
          )}

          {activeTab === 'antrean' && (
            <QueueTrackingView
              requests={requests}
              initialSearch={queueSearchInitial}
              onSelectRequest={(req) => setInspectedRequestId(req.id)}
              onNavigateCreate={() => setActiveTab('ajukan')}
            />
          )}

          {activeTab === 'dapodik' &&
            (userMode === 'petugas' && sessionToken ? (
              <DapodikDatabaseView
                students={students}
                userMode={userMode}
                onSaveStudent={handleSaveStudent}
                onDeleteStudent={handleDeleteStudent}
                onImportStudents={handleImportStudents}
                onCreateLetterFromStudent={handleCreateLetterFromStudent}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
                <Lock className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
                <h2 className="mt-3 text-base font-semibold text-slate-900">
                  Database Siswa Dapodik Terproteksi Token
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                  Data NIK, No. KK, dan riwayat peserta didik hanya dapat diakses oleh Petugas Tata Usaha yang terverifikasi token.
                </p>
                <button
                  type="button"
                  onClick={() => void requestPetugasAccess('dapodik')}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Masukkan Token Petugas TU</span>
                </button>
              </div>
            ))}

          {activeTab === 'agenda' &&
            (userMode === 'petugas' && sessionToken ? (
              <AgendaSuratView
                entries={agendaEntries}
                userMode={userMode}
                onAddEntry={handleAddAgenda}
                onDeleteEntry={handleDeleteAgenda}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
                <Lock className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
                <h2 className="mt-3 text-base font-semibold text-slate-900">
                  Buku Agenda Surat TU Terproteksi Token
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                  Arsip surat masuk dan surat keluar resmi hanya dapat dibuka oleh Petugas Tata Usaha.
                </p>
                <button
                  type="button"
                  onClick={() => void requestPetugasAccess('agenda')}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Masukkan Token Petugas TU</span>
                </button>
              </div>
            ))}

          {activeTab === 'cetak' && (
            <DocumentPrintView
              requests={requests}
              userMode={userMode}
              kopSurat={kopSuratConfig}
              onSaveKopSurat={handleSaveKopSurat}
              selectedRequestId={printTargetId}
              initialDocMode={printDocMode}
            />
          )}
        </main>

        <footer className="no-print border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <span>
              SIP TU {SCHOOL_INFO.shortName} · {SCHOOL_INFO.address}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a
                href={SCHOOL_INFO.publicPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-700 hover:underline"
              >
                {SCHOOL_INFO.publicPortalUrl}
              </a>
              <span aria-hidden="true">·</span>
              <span>
                Telp. {SCHOOL_INFO.phone} · {SCHOOL_INFO.email}
              </span>
            </div>
          </div>
        </footer>
      </div>

      <RequestDetailDrawer
        request={inspectedRequest}
        userMode={userMode}
        totalLettersCount={agendaEntries.filter((e) => e.type === 'Surat Keluar').length}
        onClose={() => setInspectedRequestId(null)}
        onUpdateStatus={handleUpdateStatus}
        onOpenPrintForRequest={handleOpenPrintForRequest}
      />

      <PetugasTokenGateModal
        open={tokenModalOpen}
        mode={tokenModalMode}
        targetLabel={pendingTargetTab ? targetLabelMap[pendingTargetTab] : undefined}
        sessionToken={sessionToken}
        onClose={() => {
          setTokenModalOpen(false);
          setPendingTargetTab(null);
        }}
        onAuthenticated={(token, staffName) => void handleAuthenticated(token, staffName)}
        onTokenChanged={() => {
          setTokenModalOpen(false);
          setToastMessage('Token masuk Petugas TU berhasil diperbarui.');
        }}
      />
    </div>
  );
}
