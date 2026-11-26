import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileUp,
  HardDriveDownload,
  LogOut,
  Mail,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AgendaEntry,
  BackupBundlePayload,
  BackupRepositoryKey,
  BackupScopeKey,
  BackupSettingsConfig,
  DapodikGtk,
  DapodikRombel,
  DapodikStudent,
  RepositoryStatusItem,
  ServiceRequest,
} from '../types/tu';
import { ImportMergeMode } from './DapodikImportExportModal';
import {
  clearCachedGmailToken,
  EmailAttachmentPayload,
  getGmailAccessToken,
  gmailSignOut,
  googleGmailSignIn,
  initGmailAuth,
  sendBackupEmailViaGmail,
  textToBase64,
  bytesToBase64,
} from '../services/gmailBackupService';
import {
  buildBackupFileName,
  downloadBlobFile,
  downloadJsonFile,
  exportAgendaWorkbook,
  exportCombinedExcelBackup,
  exportPersuratanRequestsWorkbook,
} from '../utils/backupExportUtils';
import {
  exportDapodikWorkbook,
  parseDapodikFile,
  studentsToDapodikCsv,
} from '../utils/dapodikValidation';
import { formatTanggalIndonesia } from '../utils/formatters';
import {
  exportGtkWorkbook,
  gtkListToCsv,
  parseGtkDapodikFile,
} from '../utils/gtkDapodikValidation';
import {
  exportRombelWorkbook,
  parseRombelDapodikFile,
  rombelListToCsv,
} from '../utils/rombelDapodikUtils';

type BackupSubTab = 'backup-restore' | 'import-export' | 'email-backup';

interface BackupRestoreViewProps {
  sessionToken: string;
  requests: ServiceRequest[];
  agendaEntries: AgendaEntry[];
  students: DapodikStudent[];
  gtkList: DapodikGtk[];
  rombels: DapodikRombel[];
  backupSettings: BackupSettingsConfig;
  repositoryStatuses: RepositoryStatusItem[];
  onRefreshStatuses: () => Promise<void>;
  onExportBundle: (scope: BackupScopeKey, recordTimestamp?: boolean) => Promise<BackupBundlePayload | null>;
  onRestoreBundle: (
    bundle: unknown,
    selectedRepos: BackupRepositoryKey[],
    mode: 'replace' | 'merge'
  ) => Promise<{ ok: boolean; message?: string }>;
  onSaveBackupSettings: (next: Partial<BackupSettingsConfig>) => Promise<boolean>;
  onMarkBackupEmailed: (recipient: string) => Promise<void>;
  onImportStudents: (imported: DapodikStudent[], mode: ImportMergeMode) => Promise<boolean>;
  onImportGtk: (imported: DapodikGtk[], mode: ImportMergeMode) => Promise<boolean>;
  onImportRombels: (imported: DapodikRombel[], mode: ImportMergeMode) => Promise<boolean>;
  onOpenDeduplicate?: () => void;
}

const REPO_LABELS: Record<BackupRepositoryKey, { title: string; subtitle: string }> = {
  requests: {
    title: 'Permohonan Surat Layanan TU',
    subtitle: 'database/persuratan-permohonan.json',
  },
  agenda: {
    title: 'Buku Agenda Surat Masuk & Keluar',
    subtitle: 'database/persuratan-agenda.json',
  },
  settings: {
    title: 'Pengaturan Kop, Loket, Petugas TU & Email Backup',
    subtitle: 'database/persuratan-pengaturan.json',
  },
  students: {
    title: 'Database Peserta Didik Dapodik',
    subtitle: 'database/dapodik-siswa.json',
  },
  gtk: {
    title: 'Database GTK Dapodik & Dispendukcapil',
    subtitle: 'database/dapodik-gtk.json',
  },
  rombels: {
    title: 'Database Rombongan Belajar & Wali Kelas',
    subtitle: 'database/dapodik-rombel.json',
  },
};

const ALL_REPO_KEYS: BackupRepositoryKey[] = [
  'requests',
  'agenda',
  'settings',
  'students',
  'gtk',
  'rombels',
];

interface ParsedJsonBackupPreview {
  fileName: string;
  rawPayload: unknown;
  exportedAt: string;
  exportedBy: string;
  availableKeys: BackupRepositoryKey[];
  counts: Record<BackupRepositoryKey, number>;
}

function parseBackupPreview(fileName: string, raw: unknown): ParsedJsonBackupPreview | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const counts: Record<BackupRepositoryKey, number> = {
    requests: 0,
    agenda: 0,
    settings: 0,
    students: 0,
    gtk: 0,
    rombels: 0,
  };
  const availableKeys: BackupRepositoryKey[] = [];

  if (obj.repositories && typeof obj.repositories === 'object') {
    const repos = obj.repositories as Record<string, unknown>;
    if (Array.isArray(repos.requests)) {
      counts.requests = repos.requests.length;
      availableKeys.push('requests');
    }
    if (Array.isArray(repos.agenda)) {
      counts.agenda = repos.agenda.length;
      availableKeys.push('agenda');
    }
    if (repos.settings && typeof repos.settings === 'object') {
      counts.settings = 1;
      availableKeys.push('settings');
    }
    if (Array.isArray(repos.students)) {
      counts.students = repos.students.length;
      availableKeys.push('students');
    }
    if (Array.isArray(repos.gtk)) {
      counts.gtk = repos.gtk.length;
      availableKeys.push('gtk');
    }
    if (Array.isArray(repos.rombels)) {
      counts.rombels = repos.rombels.length;
      availableKeys.push('rombels');
    }
    return availableKeys.length > 0
      ? {
          fileName,
          rawPayload: raw,
          exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
          exportedBy: typeof obj.exportedBy === 'string' ? obj.exportedBy : 'Arsip SIP TU',
          availableKeys,
          counts,
        }
      : null;
  }

  // Also support single repository envelope JSON directly from database/*.json
  if (typeof obj.repository === 'string' && obj.data !== undefined) {
    const repoMap: Record<string, BackupRepositoryKey> = {
      'persuratan-permohonan': 'requests',
      'persuratan-agenda': 'agenda',
      'persuratan-pengaturan': 'settings',
      'dapodik-siswa': 'students',
      'dapodik-gtk': 'gtk',
      'dapodik-rombel': 'rombels',
    };
    const key = repoMap[obj.repository];
    if (!key) return null;
    availableKeys.push(key);
    counts[key] = Array.isArray(obj.data) ? obj.data.length : 1;
    return {
      fileName,
      rawPayload: raw,
      exportedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : '',
      exportedBy: 'Repositori Tunggal',
      availableKeys,
      counts,
    };
  }

  return null;
}

export function BackupRestoreView({
  requests,
  agendaEntries,
  students,
  gtkList,
  rombels,
  backupSettings,
  repositoryStatuses,
  onRefreshStatuses,
  onExportBundle,
  onRestoreBundle,
  onSaveBackupSettings,
  onMarkBackupEmailed,
  onImportStudents,
  onImportGtk,
  onImportRombels,
  onOpenDeduplicate,
}: BackupRestoreViewProps) {
  const [subTab, setSubTab] = useState<BackupSubTab>('backup-restore');
  const [backupScope, setBackupScope] = useState<BackupScopeKey>(backupSettings.defaultScope || 'all');
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  // Restore state
  const [restorePreview, setRestorePreview] = useState<ParsedJsonBackupPreview | null>(null);
  const [selectedRestoreKeys, setSelectedRestoreKeys] = useState<BackupRepositoryKey[]>([]);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [restoreError, setRestoreError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const jsonRestoreInputRef = useRef<HTMLInputElement>(null);

  // Import/Export state
  const [quickImportMode, setQuickImportMode] = useState<ImportMergeMode>('upsert');
  const [quickImportStatus, setQuickImportStatus] = useState('');
  const [quickImportError, setQuickImportError] = useState('');
  const [importingDataset, setImportingDataset] = useState<string | null>(null);
  const studentFileRef = useRef<HTMLInputElement>(null);
  const gtkFileRef = useRef<HTMLInputElement>(null);
  const rombelFileRef = useRef<HTMLInputElement>(null);

  // Email Settings & Gmail OAuth state
  const [targetEmail, setTargetEmail] = useState(backupSettings.targetEmail);
  const [ccEmail, setCcEmail] = useState(backupSettings.ccEmail);
  const [subjectPrefix, setSubjectPrefix] = useState(backupSettings.subjectPrefix);
  const [defaultScope, setDefaultScope] = useState<BackupScopeKey>(backupSettings.defaultScope);
  const [attachmentFormat, setAttachmentFormat] = useState<'json' | 'both'>(
    backupSettings.includeAttachmentFormat
  );
  const [savingEmailSettings, setSavingEmailSettings] = useState(false);
  const [emailSettingsMsg, setEmailSettingsMsg] = useState('');
  const [emailSettingsError, setEmailSettingsError] = useState('');

  // Gmail Auth in-memory state
  const [gmailUser, setGmailUser] = useState<User | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(() => getGmailAccessToken());
  const [gmailAuthBusy, setGmailAuthBusy] = useState(false);
  const [gmailError, setGmailError] = useState('');
  const [gmailSuccess, setGmailSuccess] = useState('');

  // Send Email confirmation dialog state
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailScopeToSend, setEmailScopeToSend] = useState<BackupScopeKey>(
    backupSettings.defaultScope || 'all'
  );

  useEffect(() => {
    setTargetEmail(backupSettings.targetEmail);
    setCcEmail(backupSettings.ccEmail);
    setSubjectPrefix(backupSettings.subjectPrefix);
    setDefaultScope(backupSettings.defaultScope);
    setAttachmentFormat(backupSettings.includeAttachmentFormat);
    setEmailScopeToSend(backupSettings.defaultScope || 'all');
  }, [backupSettings]);

  useEffect(() => {
    const unsubscribe = initGmailAuth(
      (user, token) => {
        setGmailUser(user);
        setGmailToken(token);
      },
      (user) => {
        setGmailUser(user);
        setGmailToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const liveCounts = useMemo(
    () => ({
      requests: requests.length,
      agenda: agendaEntries.length,
      students: students.length,
      gtk: gtkList.length,
      rombels: rombels.length,
      settings: 1,
    }),
    [requests.length, agendaEntries.length, students.length, gtkList.length, rombels.length]
  );

  const handleDownloadJsonBackup = async () => {
    setDownloadingBackup(true);
    setRestoreError('');
    try {
      const bundle = await onExportBundle(backupScope, true);
      if (bundle) {
        downloadJsonFile(bundle, buildBackupFileName(backupScope, 'json'));
      }
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleJsonFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (jsonRestoreInputRef.current) jsonRestoreInputRef.current.value = '';
    if (!file) return;

    setRestoreError('');
    setRestoreSuccess('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const preview = parseBackupPreview(file.name, parsed);
      if (!preview) {
        setRestorePreview(null);
        setSelectedRestoreKeys([]);
        setRestoreError(
          'File JSON tidak valid atau bukan file backup repositori SIP TU SMAN 9 Surabaya.'
        );
        return;
      }
      setRestorePreview(preview);
      setSelectedRestoreKeys(preview.availableKeys);
    } catch {
      setRestorePreview(null);
      setSelectedRestoreKeys([]);
      setRestoreError('Gagal membaca file JSON. Pastikan format berkas tidak rusak.');
    }
  };

  const toggleRestoreKey = (key: BackupRepositoryKey) => {
    setSelectedRestoreKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleConfirmRestore = async () => {
    if (!restorePreview || selectedRestoreKeys.length === 0) return;
    setRestoring(true);
    setRestoreError('');
    try {
      const res = await onRestoreBundle(restorePreview.rawPayload, selectedRestoreKeys, restoreMode);
      if (!res.ok) {
        setRestoreError(res.message || 'Gagal menerapkan restore backup.');
      } else {
        setRestoreSuccess(
          res.message ||
            `Restore berhasil diterapkan (${selectedRestoreKeys.length} repositori diperbarui).`
        );
        setRestorePreview(null);
        setSelectedRestoreKeys([]);
      }
    } finally {
      setRestoring(false);
      setConfirmRestoreOpen(false);
    }
  };

  const handleQuickExcelImport = async (
    target: 'students' | 'gtk' | 'rombels',
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setQuickImportError('');
    setQuickImportStatus('');
    setImportingDataset(target);
    try {
      if (target === 'students') {
        const parsed = await parseDapodikFile(file);
        if (parsed.students.length === 0) {
          setQuickImportError('Tidak ada baris peserta didik yang terbaca dari file tersebut.');
          return;
        }
        const ok = await onImportStudents(parsed.students, quickImportMode);
        if (ok) {
          setQuickImportStatus(
            `Berhasil mengimpor ${parsed.students.length} data Peserta Didik dari "${file.name}".`
          );
        }
      } else if (target === 'gtk') {
        const parsed = await parseGtkDapodikFile(file);
        if (parsed.gtkList.length === 0) {
          setQuickImportError('Tidak ada baris data GTK yang terbaca dari file tersebut.');
          return;
        }
        const ok = await onImportGtk(parsed.gtkList, quickImportMode);
        if (ok) {
          setQuickImportStatus(
            `Berhasil mengimpor ${parsed.gtkList.length} data GTK dari "${file.name}".`
          );
        }
      } else {
        const parsed = await parseRombelDapodikFile(file, gtkList);
        if (parsed.rombels.length === 0) {
          setQuickImportError('Tidak ada baris Rombel yang terbaca dari file tersebut.');
          return;
        }
        const ok = await onImportRombels(parsed.rombels, quickImportMode);
        if (ok) {
          setQuickImportStatus(
            `Berhasil mengimpor ${parsed.rombels.length} data Rombel dari "${file.name}".`
          );
        }
      }
    } catch (err) {
      setQuickImportError(
        err instanceof Error ? err.message : 'Gagal membaca file impor Excel/CSV.'
      );
    } finally {
      setImportingDataset(null);
    }
  };

  const handleSaveEmailConfig = async () => {
    setEmailSettingsError('');
    setEmailSettingsMsg('');
    const trimmedTarget = targetEmail.trim();
    if (!trimmedTarget || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedTarget)) {
      setEmailSettingsError('Masukkan alamat email tujuan backup yang valid.');
      return;
    }
    if (ccEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ccEmail.trim())) {
      setEmailSettingsError('Format alamat email CC tidak valid.');
      return;
    }
    setSavingEmailSettings(true);
    try {
      const ok = await onSaveBackupSettings({
        targetEmail: trimmedTarget,
        ccEmail: ccEmail.trim(),
        subjectPrefix: subjectPrefix.trim() || '[Backup SIP TU SMAN 9 Surabaya]',
        defaultScope,
        includeAttachmentFormat: attachmentFormat,
      });
      if (ok) {
        setEmailSettingsMsg(`Pengaturan email tujuan backup (${trimmedTarget}) tersimpan.`);
        setEmailScopeToSend(defaultScope);
      } else {
        setEmailSettingsError('Gagal menyimpan pengaturan email backup.');
      }
    } finally {
      setSavingEmailSettings(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGmailError('');
    setGmailSuccess('');
    setGmailAuthBusy(true);
    try {
      const { user, accessToken } = await googleGmailSignIn();
      setGmailUser(user);
      setGmailToken(accessToken);
      setGmailSuccess(
        `Terhubung ke Google (${user.email || 'Akun Google'}). Anda siap mengirim backup ke email tujuan.`
      );
    } catch (err) {
      setGmailError(
        err instanceof Error
          ? err.message
          : 'Login Google dibatalkan atau gagal memperoleh akses Gmail.'
      );
    } finally {
      setGmailAuthBusy(false);
    }
  };

  const handleGoogleLogout = async () => {
    await gmailSignOut();
    setGmailUser(null);
    setGmailToken(null);
    setGmailSuccess('');
  };

  const emailSubjectPreview = useMemo(() => {
    const prefix = (subjectPrefix || '[Backup SIP TU SMAN 9 Surabaya]').trim();
    const datePart = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const scopeLabel = emailScopeToSend === 'all' ? 'Full Repositori' : emailScopeToSend.toUpperCase();
    return `${prefix} ${scopeLabel} - ${datePart}`;
  }, [subjectPrefix, emailScopeToSend]);

  const handleOpenSendConfirmation = () => {
    setGmailError('');
    setGmailSuccess('');
    if (!targetEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(targetEmail.trim())) {
      setGmailError('Email tujuan backup belum valid. Simpan atau perbaiki alamat email tujuan terlebih dahulu.');
      return;
    }
    if (!gmailToken) {
      setGmailError('Silakan klik "Sign in with Google" terlebih dahulu untuk mengotorisasi pengiriman melalui Gmail.');
      return;
    }
    setConfirmSendOpen(true);
  };

  const handleConfirmSendEmail = async () => {
    const activeToken = gmailToken || getGmailAccessToken();
    if (!activeToken) {
      setConfirmSendOpen(false);
      setGmailError('Sesi Google belum aktif. Silakan klik "Sign in with Google".');
      return;
    }

    setSendingEmail(true);
    setGmailError('');
    setGmailSuccess('');
    try {
      const bundle = await onExportBundle(emailScopeToSend, true);
      if (!bundle) {
        throw new Error('Gagal menyiapkan paket backup dari repositori server.');
      }

      const jsonFileName = buildBackupFileName(emailScopeToSend, 'json');
      const jsonContent = JSON.stringify(bundle, null, 2);

      const attachments: EmailAttachmentPayload[] = [
        {
          filename: jsonFileName,
          mimeType: 'application/json',
          base64Content: textToBase64(jsonContent),
        },
      ];

      if (attachmentFormat === 'both') {
        const xlsxBytes = exportCombinedExcelBackup({
          requests,
          agenda: agendaEntries,
          students,
          gtkList,
          rombels,
        });
        attachments.push({
          filename: buildBackupFileName(emailScopeToSend, 'xlsx'),
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          base64Content: bytesToBase64(xlsxBytes),
        });
      }

      const bodyLines = [
        'Yth. Pengelola Tata Usaha SMAN 9 Surabaya,',
        '',
        'Terlampir salinan cadangan (backup) database repositori SIP TU SMAN 9 Surabaya.',
        '',
        `Waktu Ekspor    : ${new Date(bundle.exportedAt).toLocaleString('id-ID')}`,
        `Diekspor oleh   : ${bundle.exportedBy}`,
        `Cakupan Backup  : ${emailScopeToSend === 'all' ? 'Seluruh Repositori (6 Modul)' : emailScopeToSend}`,
        '',
        'Ringkasan Jumlah Data:',
        `- Permohonan Surat Layanan : ${bundle.counts.requests} data`,
        `- Buku Agenda Surat        : ${bundle.counts.agenda} data`,
        `- Peserta Didik Dapodik    : ${bundle.counts.students} siswa`,
        `- GTK Dapodik              : ${bundle.counts.gtk} PTK`,
        `- Rombel & Wali Kelas      : ${bundle.counts.rombels} rombel`,
        `- Pengaturan Kop & Sistem  : ${bundle.counts.settings} paket konfigurasi`,
        '',
        'Berkas .json terlampir dapat dipulihkan kapan saja melalui menu Backup & Restore di Portal Petugas TU.',
        '',
        'Hormat kami,',
        'SIP TU SMAN 9 Surabaya',
      ];

      await sendBackupEmailViaGmail({
        accessToken: activeToken,
        toEmail: targetEmail.trim(),
        ccEmail: ccEmail.trim() || undefined,
        subject: emailSubjectPreview,
        bodyText: bodyLines.join('\n'),
        attachments,
      });

      await onMarkBackupEmailed(targetEmail.trim());
      setGmailSuccess(
        `Backup (${attachments.map((a) => a.filename).join(' & ')}) berhasil dikirim ke ${targetEmail.trim()}.`
      );
      setConfirmSendOpen(false);
    } catch (err) {
      clearCachedGmailToken();
      if (!getGmailAccessToken()) {
        setGmailToken(null);
      }
      setGmailError(
        err instanceof Error ? err.message : 'Gagal mengirim email backup melalui Gmail.'
      );
      setConfirmSendOpen(false);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
              <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Manajemen Arsip, Restore & Backup Email</span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-slate-900">
              Backup, Restore, Importir & Eksportir Database TU
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Cadangkan seluruh repositori persuratan dan Dapodik, pulihkan dari arsip JSON, ekspor/impor Excel & CSV, atau kirim langsung ke email tujuan yang tersimpan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenDeduplicate && (
              <button
                type="button"
                onClick={onOpenDeduplicate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                <span>Cek & Hapus Duplikasi Data</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void onRefreshStatuses()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Segarkan Status</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('email-backup')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Email Tujuan: {backupSettings.targetEmail || 'Belum diatur'}</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setSubTab('backup-restore')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              subTab === 'backup-restore'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <HardDriveDownload className="h-4 w-4" aria-hidden="true" />
            <span>Backup & Restore Repositori</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('import-export')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              subTab === 'import-export'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            <span>Backup Importir & Eksportir</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('email-backup')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              subTab === 'email-backup'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>Simpan Backup ke Email (Gmail)</span>
          </button>
        </div>
      </section>

      {/* SUB-TAB 1: BACKUP & RESTORE REPOSITORI */}
      {subTab === 'backup-restore' && (
        <div className="space-y-6">
          {/* Live Repository Snapshot Grid */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Status 6 Database Repositori Aktif
              </h3>
              {backupSettings.lastBackupAt && (
                <span className="text-xs text-slate-500">
                  Backup terakhir: {formatTanggalIndonesia(backupSettings.lastBackupAt, true)} oleh{' '}
                  {backupSettings.lastBackupBy || 'Petugas TU'}
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ALL_REPO_KEYS.map((key) => {
                const statusItem = repositoryStatuses.find((r) => r.key === key);
                const meta = REPO_LABELS[key];
                const count = statusItem?.totalRecords ?? liveCounts[key];
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">{meta.title}</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                          {statusItem?.fileName || meta.subtitle}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-white px-2 py-0.5 font-mono text-xs font-bold text-blue-700 border border-slate-200">
                        {key === 'settings' ? 'Aktif' : `${count} data`}
                      </span>
                    </div>
                    {statusItem?.updatedAt && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        Diperbarui: {formatTanggalIndonesia(statusItem.updatedAt, true)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Download Backup JSON Card */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Download className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Buat & Unduh Backup Repositori</h3>
                  <p className="text-xs text-slate-500">
                    Simpan salinan utuh repositori ke perangkat dalam format JSON atau kirim ke email.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Pilih Cakupan Repositori Backup
                  </label>
                  <select
                    value={backupScope}
                    onChange={(e) => setBackupScope(e.target.value as BackupScopeKey)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="all">
                      Semua Repositori Lengkap (Permohonan, Agenda, Pengaturan, Siswa, GTK, Rombel)
                    </option>
                    <option value="requests">Hanya Permohonan Surat Layanan TU ({requests.length})</option>
                    <option value="agenda">Hanya Buku Agenda Surat ({agendaEntries.length})</option>
                    <option value="students">Hanya Database Siswa Dapodik ({students.length})</option>
                    <option value="gtk">Hanya Database GTK Dapodik ({gtkList.length})</option>
                    <option value="rombels">Hanya Rombel & Wali Kelas ({rombels.length})</option>
                    <option value="settings">Hanya Pengaturan Kop, Loket & Petugas TU</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={downloadingBackup}
                    onClick={() => void handleDownloadJsonBackup()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>{downloadingBackup ? 'Menyiapkan...' : 'Unduh Backup (.json)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailScopeToSend(backupScope);
                      setSubTab('email-backup');
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    <span>Simpan ke Email Tujuan</span>
                  </button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  File backup JSON menyimpan seluruh struktur relasi termasuk foto GTK, Kop Surat sekolah, penugasan Petugas TU, dan riwayat status permohonan.
                </div>
              </div>
            </section>

            {/* Restore Backup JSON Card */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Restore Database dari File Backup</h3>
                  <p className="text-xs text-slate-500">
                    Unggah file backup <span className="font-mono">.json</span> hasil ekspor SIP TU atau file repositori tunggal.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <input
                  ref={jsonRestoreInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => void handleJsonFileSelected(e)}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => jsonRestoreInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-blue-500 hover:bg-blue-50/40"
                >
                  <FileUp className="h-7 w-7 text-slate-400" aria-hidden="true" />
                  <span className="mt-2 text-xs font-semibold text-slate-800">
                    Pilih File Backup JSON (.json)
                  </span>
                  <span className="mt-0.5 text-[11px] text-slate-500">
                    Mendukung bundel penuh maupun file tunggal dari folder database/
                  </span>
                </button>

                {restoreError && (
                  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{restoreError}</span>
                  </div>
                )}

                {restoreSuccess && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{restoreSuccess}</span>
                  </div>
                )}

                {restorePreview && (
                  <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Pratinjau Berkas: {restorePreview.fileName}
                        </p>
                        <p className="text-[11px] text-slate-600">
                          {restorePreview.exportedAt
                            ? `Diekspor: ${formatTanggalIndonesia(restorePreview.exportedAt, true)}`
                            : 'Arsip repositori valid'}{' '}
                          · Oleh: {restorePreview.exportedBy}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRestorePreview(null);
                          setSelectedRestoreKeys([]);
                        }}
                        className="rounded p-1 text-slate-500 hover:bg-white"
                        aria-label="Batalkan pratinjau restore"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Pilih Repositori yang Dipulihkan:
                      </p>
                      {restorePreview.availableKeys.map((key) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                        >
                          <span className="flex items-center gap-2 font-medium text-slate-800">
                            <input
                              type="checkbox"
                              checked={selectedRestoreKeys.includes(key)}
                              onChange={() => toggleRestoreKey(key)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-700"
                            />
                            <span>{REPO_LABELS[key].title}</span>
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-blue-700">
                            {key === 'settings' ? 'Konfigurasi' : `${restorePreview.counts[key]} data`}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Metode Pemulihan Data:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRestoreMode('merge')}
                          className={`rounded-lg border px-3 py-2 text-left text-xs ${
                            restoreMode === 'merge'
                              ? 'border-blue-600 bg-blue-50 font-semibold text-blue-900'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <div>Gabung & Perbarui</div>
                          <div className="mt-0.5 text-[10px] font-normal text-slate-500">
                            Pertahankan data lain, update yang cocok
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestoreMode('replace')}
                          className={`rounded-lg border px-3 py-2 text-left text-xs ${
                            restoreMode === 'replace'
                              ? 'border-rose-600 bg-rose-50 font-semibold text-rose-900'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <div>Timpa Penuh (Replace)</div>
                          <div className="mt-0.5 text-[10px] font-normal text-slate-500">
                            Ganti seluruh isi repositori terpilih
                          </div>
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={selectedRestoreKeys.length === 0 || restoring}
                      onClick={() => setConfirmRestoreOpen(true)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                      <span>Terapkan Restore ({selectedRestoreKeys.length} Repositori)</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BACKUP IMPORTIR & EKSPORTIR */}
      {subTab === 'import-export' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Pusat Importir & Eksportir Terpadu (Excel, CSV & JSON)
                </h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Ekspor laporan ke Excel (.xlsx) / CSV / JSON atau impor data Excel Dapodik secara langsung dari satu menu.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Mode Impor:</label>
                <select
                  value={quickImportMode}
                  onChange={(e) => setQuickImportMode(e.target.value as ImportMergeMode)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                >
                  <option value="upsert">Gabung & Update (Upsert)</option>
                  <option value="append">Tambahkan Baru (Append)</option>
                  <option value="replace">Ganti Semua Data (Replace)</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const bytes = exportCombinedExcelBackup({
                      requests,
                      agenda: agendaEntries,
                      students,
                      gtkList,
                      rombels,
                    });
                    downloadBlobFile(
                      new Blob([bytes.buffer as ArrayBuffer], {
                        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                      }),
                      buildBackupFileName('all', 'xlsx')
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ekspor Paket Excel Terpadu (.xlsx)</span>
                </button>
              </div>
            </div>

            {quickImportError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{quickImportError}</span>
              </div>
            )}
            {quickImportStatus && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{quickImportStatus}</span>
              </div>
            )}

            <input
              ref={studentFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => void handleQuickExcelImport('students', e)}
              className="hidden"
            />
            <input
              ref={gtkFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => void handleQuickExcelImport('gtk', e)}
              className="hidden"
            />
            <input
              ref={rombelFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => void handleQuickExcelImport('rombels', e)}
              className="hidden"
            />

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {/* 1. Siswa Dapodik */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    <h4 className="text-sm font-bold text-slate-900">Peserta Didik Dapodik</h4>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                    {students.length} siswa
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Ekspor atau impor data biodata siswa format 57 kolom Dapodik (.xlsx / .csv) & backup JSON.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => exportDapodikWorkbook(students, false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Ekspor Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const csv = studentsToDapodikCsv(students);
                      downloadBlobFile(
                        new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
                        `dapodik-siswa-sman9sby-${new Date().toISOString().slice(0, 10)}.csv`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Ekspor CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportDapodikWorkbook(students, true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span>Template</span>
                  </button>
                  <button
                    type="button"
                    disabled={importingDataset === 'students'}
                    onClick={() => studentFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {importingDataset === 'students' ? 'Mengimpor...' : 'Impor Excel / CSV'}
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. GTK Dapodik */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    <h4 className="text-sm font-bold text-slate-900">GTK Dapodik & Pegawai TU</h4>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                    {gtkList.length} PTK
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Ekspor atau impor direktori Guru & Tenaga Kependidikan beserta verifikasi padan NIK Dispendukcapil.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => exportGtkWorkbook(gtkList, false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Ekspor Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const csv = gtkListToCsv(gtkList);
                      downloadBlobFile(
                        new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
                        `dapodik-gtk-sman9sby-${new Date().toISOString().slice(0, 10)}.csv`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Ekspor CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportGtkWorkbook(gtkList, true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span>Template</span>
                  </button>
                  <button
                    type="button"
                    disabled={importingDataset === 'gtk'}
                    onClick={() => gtkFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{importingDataset === 'gtk' ? 'Mengimpor...' : 'Impor Excel / CSV'}</span>
                  </button>
                </div>
              </div>

              {/* 3. Rombel & Wali Kelas */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    <h4 className="text-sm font-bold text-slate-900">Rombel & Wali Kelas</h4>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                    {rombels.length} rombel
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Ekspor atau impor daftar rombongan belajar, ruangan, dan penugasan Wali Kelas.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => exportRombelWorkbook(rombels, false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Ekspor Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const csv = rombelListToCsv(rombels);
                      downloadBlobFile(
                        new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
                        `rombel-sman9sby-${new Date().toISOString().slice(0, 10)}.csv`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Ekspor CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportRombelWorkbook(rombels, true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span>Template</span>
                  </button>
                  <button
                    type="button"
                    disabled={importingDataset === 'rombels'}
                    onClick={() => rombelFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {importingDataset === 'rombels' ? 'Mengimpor...' : 'Impor Excel / CSV'}
                    </span>
                  </button>
                </div>
              </div>

              {/* 4. Persuratan & Buku Agenda */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    <h4 className="text-sm font-bold text-slate-900">Persuratan & Buku Agenda</h4>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                    {requests.length} tiket · {agendaEntries.length} agenda
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Ekspor rekap Excel permohonan layanan dan Buku Agenda Surat Masuk/Keluar atau unduh arsip JSON.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => exportPersuratanRequestsWorkbook(requests)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Excel Permohonan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportAgendaWorkbook(agendaEntries)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Excel Buku Agenda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTab('backup-restore')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Impor / Restore JSON</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* SUB-TAB 3: SIMPAN BACKUP KE EMAIL (SETTING & GMAIL) */}
      {subTab === 'email-backup' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Email Destination Settings Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pengaturan Email Tujuan Backup</h3>
                <p className="text-xs text-slate-500">
                  Simpan alamat email resmi penerima backup agar pengiriman selalu konsisten.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Email Tujuan Utama Backup <span className="text-rose-600">*</span>
                </label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="contoh: smanixsurabaya@gmail.com"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">Pilih cepat:</span>
                  <button
                    type="button"
                    onClick={() => setTargetEmail('smanixsurabaya@gmail.com')}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    smanixsurabaya@gmail.com
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetEmail('sulistyowati06@guru.sma.belajar.id')}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    sulistyowati06@guru.sma.belajar.id
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Email Salinan / CC (Opsional)
                </label>
                <input
                  type="email"
                  value={ccEmail}
                  onChange={(e) => setCcEmail(e.target.value)}
                  placeholder="Opsional, misal email Kepala TU / Arsip"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Awalan Subjek Email Backup
                </label>
                <input
                  type="text"
                  value={subjectPrefix}
                  onChange={(e) => setSubjectPrefix(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Cakupan Backup Default
                  </label>
                  <select
                    value={defaultScope}
                    onChange={(e) => setDefaultScope(e.target.value as BackupScopeKey)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="all">Semua Repositori (Lengkap)</option>
                    <option value="requests">Permohonan Surat</option>
                    <option value="agenda">Buku Agenda</option>
                    <option value="students">Siswa Dapodik</option>
                    <option value="gtk">GTK Dapodik</option>
                    <option value="rombels">Rombel & Wali Kelas</option>
                    <option value="settings">Pengaturan & Kop</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Lampiran Email
                  </label>
                  <select
                    value={attachmentFormat}
                    onChange={(e) => setAttachmentFormat(e.target.value as 'json' | 'both')}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="json">File Backup (.json)</option>
                    <option value="both">Backup (.json) + Rekap Excel (.xlsx)</option>
                  </select>
                </div>
              </div>

              {emailSettingsError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {emailSettingsError}
                </div>
              )}
              {emailSettingsMsg && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {emailSettingsMsg}
                </div>
              )}

              <button
                type="button"
                disabled={savingEmailSettings}
                onClick={() => void handleSaveEmailConfig()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>{savingEmailSettings ? 'Menyimpan...' : 'Simpan Pengaturan Email Tujuan'}</span>
              </button>
            </div>
          </section>

          {/* Gmail Sign-in & Send Backup Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Send className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Kirim Backup ke Email via Gmail</h3>
                <p className="text-xs text-slate-500">
                  Hubungkan akun Google Anda lalu kirim paket backup langsung ke alamat tujuan yang tersimpan.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {/* Google Sign-In Status Box */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-700">Akun Pengirim Gmail</p>
                {gmailToken && gmailUser ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {gmailUser.displayName || 'Akun Google Terhubung'}
                        </p>
                        <p className="text-[11px] text-slate-600">{gmailUser.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleGoogleLogout()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Keluar Google</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-2.5 space-y-2.5">
                    <p className="text-xs text-slate-600">
                      Masuk dengan akun Google untuk mengizinkan aplikasi mengirim lampiran backup melalui Gmail Anda.
                    </p>
                    <button
                      type="button"
                      disabled={gmailAuthBusy}
                      onClick={() => void handleGoogleLogin()}
                      className="gsi-material-button"
                    >
                      <div className="gsi-material-button-state" />
                      <div className="gsi-material-button-content-wrapper">
                        <div className="gsi-material-button-icon">
                          <svg
                            version="1.1"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 48 48"
                            style={{ display: 'block' }}
                            aria-hidden="true"
                          >
                            <path
                              fill="#EA4335"
                              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                            />
                            <path
                              fill="#4285F4"
                              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                            />
                            <path
                              fill="#34A853"
                              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                            />
                            <path fill="none" d="M0 0h48v48H0z" />
                          </svg>
                        </div>
                        <span className="gsi-material-button-contents">
                          {gmailAuthBusy ? 'Menghubungkan...' : 'Sign in with Google'}
                        </span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Scope selector & preview before send */}
              <div className="space-y-3 rounded-xl border border-slate-200 p-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-600">Kirim ke:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {targetEmail.trim() || '(Belum diisi)'}
                  </span>
                </div>
                {ccEmail.trim() && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-600">CC:</span>
                    <span className="font-mono text-slate-800">{ccEmail.trim()}</span>
                  </div>
                )}
                <div>
                  <label className="block font-semibold text-slate-600">Cakupan yang Dikirim:</label>
                  <select
                    value={emailScopeToSend}
                    onChange={(e) => setEmailScopeToSend(e.target.value as BackupScopeKey)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="all">Semua Repositori (Permohonan, Agenda, Siswa, GTK, Rombel, Pengaturan)</option>
                    <option value="requests">Permohonan Surat Layanan TU</option>
                    <option value="agenda">Buku Agenda Surat</option>
                    <option value="students">Database Siswa Dapodik</option>
                    <option value="gtk">Database GTK Dapodik</option>
                    <option value="rombels">Rombel & Wali Kelas</option>
                    <option value="settings">Pengaturan & Kop Surat</option>
                  </select>
                </div>
                <div className="border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                  Subjek: <span className="font-medium text-slate-700">{emailSubjectPreview}</span>
                </div>
                {backupSettings.lastEmailSentAt && (
                  <div className="text-[11px] text-emerald-700">
                    Pengiriman email terakhir: {formatTanggalIndonesia(backupSettings.lastEmailSentAt, true)} ke{' '}
                    {backupSettings.lastEmailRecipient}
                  </div>
                )}
              </div>

              {gmailError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{gmailError}</span>
                </div>
              )}

              {gmailSuccess && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{gmailSuccess}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleOpenSendConfirmation}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                <span>Simpan & Kirim Backup ke Email Tujuan</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Explicit Confirmation Modal: Restore Database */}
      {confirmRestoreOpen && restorePreview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Konfirmasi Restore Database Repositori
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {restoreMode === 'replace'
                    ? 'Mode TIMPA PENUH dipilih: seluruh data lama pada repositori yang dipilih akan diganti oleh isi file backup.'
                    : 'Mode GABUNG & PERBARUI dipilih: data yang cocok akan diperbarui dan data baru akan ditambahkan ke repositori.'}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <p className="font-semibold text-slate-800">Repositori yang akan dipulihkan:</p>
              <ul className="mt-2 space-y-1 text-slate-700">
                {selectedRestoreKeys.map((key) => (
                  <li key={key} className="flex items-center justify-between">
                    <span>• {REPO_LABELS[key].title}</span>
                    <span className="font-mono font-semibold">
                      {key === 'settings' ? '1 paket' : `${restorePreview.counts[key]} data`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={restoring}
                onClick={() => setConfirmRestoreOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={() => void handleConfirmRestore()}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
                  restoreMode === 'replace'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                {restoring ? 'Memulihkan...' : 'Ya, Terapkan Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal: Send Email via Gmail */}
      {confirmSendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Konfirmasi Kirim Backup ke Email
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Sistem akan mengirim email berisi lampiran cadangan database melalui akun Gmail Anda (
                  <span className="font-semibold">{gmailUser?.email || 'Google'}</span>).
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
              <div>
                <span className="font-semibold text-slate-900">Tujuan:</span>{' '}
                <span className="font-mono">{targetEmail.trim()}</span>
              </div>
              {ccEmail.trim() && (
                <div>
                  <span className="font-semibold text-slate-900">CC:</span>{' '}
                  <span className="font-mono">{ccEmail.trim()}</span>
                </div>
              )}
              <div>
                <span className="font-semibold text-slate-900">Subjek:</span> {emailSubjectPreview}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Lampiran:</span>{' '}
                {attachmentFormat === 'both'
                  ? 'File Backup JSON (.json) + Rekap Excel Terpadu (.xlsx)'
                  : 'File Backup JSON (.json)'}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={sendingEmail}
                onClick={() => setConfirmSendOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={sendingEmail}
                onClick={() => void handleConfirmSendEmail()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{sendingEmail ? 'Mengirim Email...' : 'Konfirmasi & Kirim Email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
