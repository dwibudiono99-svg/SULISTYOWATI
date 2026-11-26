import fs from 'node:fs';
import path from 'node:path';
import type {
  AgendaEntry,
  BackupBundlePayload,
  BackupRepositoryKey,
  BackupScopeKey,
  BackupSettingsConfig,
  DapodikGtk,
  DapodikRombel,
  DapodikStudent,
  KopDividerStyle,
  KopSuratConfig,
  KopSuratMode,
  PublicTuStaffInfo,
  ReportingPortalConfig,
  ServiceRequest,
  TuStaffConfig,
  TuStaffOperator,
} from '../src/types/tu.ts';
import { applyDispendukcapilCheck, formatPtkDisplayName } from '../src/utils/gtkDapodikValidation.ts';
import { normalizeRombelRecord, sortRombelsNaturally } from '../src/utils/rombelDapodikUtils.ts';

export const REPO_DIR = path.resolve(process.cwd(), 'database');
export const AUTH_DATA_DIR = path.resolve(process.cwd(), 'data');
export const AUTH_STORE_PATH = path.resolve(AUTH_DATA_DIR, 'tu_auth.json');
export const LEGACY_STORE_PATH = path.resolve(AUTH_DATA_DIR, 'tu_store.json');

export const REPOSITORY_FILES = {
  requests: path.resolve(REPO_DIR, 'persuratan-permohonan.json'),
  agenda: path.resolve(REPO_DIR, 'persuratan-agenda.json'),
  settings: path.resolve(REPO_DIR, 'persuratan-pengaturan.json'),
  students: path.resolve(REPO_DIR, 'dapodik-siswa.json'),
  gtk: path.resolve(REPO_DIR, 'dapodik-gtk.json'),
  rombels: path.resolve(REPO_DIR, 'dapodik-rombel.json'),
} as const;

export const DEFAULT_KOP_SURAT: KopSuratConfig = {
  showKopSurat: true,
  mode: 'custom',
  bannerImageDataUrl: '',
  leftLogoDataUrl: '/assets/logo-jatim-sman9.png',
  rightLogoDataUrl: '',
  provinceLine: 'PEMERINTAH PROVINSI JAWA TIMUR',
  departmentLine: 'DINAS PENDIDIKAN',
  schoolNameLine: 'SMA NEGERI 9 SURABAYA',
  addressLine: 'Jalan Wijayakusuma Nomor 48, Ketabang, Genteng, Surabaya, Jawa Timur 60272',
  contactLine: 'Telepon (031) 5342608 - Faksimili (031) 5477817',
  websiteLine: 'Laman : sman9sby.sch.id  Surel : smanixsurabaya@gmail.com, NPSN : 20532263',
  dividerStyle: 'thick-thin',
  cityName: 'Surabaya',
  principalTitle: 'Kepala Sekolah,',
  principalName: 'TRI KURNIAWATI, S.Pd., M.M., M.Pd.',
  principalNip: '197203251997032003',
};

export const DEFAULT_REPORTING_PORTAL: ReportingPortalConfig = {
  isOpen: true,
  closedMessage:
    'Pelayanan pengajuan permohonan Tata Usaha secara daring sedang ditutup sementara (di luar jam kerja loket atau pemeliharaan berkas). Silakan pantau tiket berjalan atau ajukan kembali saat loket dibuka.',
  updatedAt: '2026-11-25T07:00:00+07:00',
  updatedBy: 'Sulistyowati, S.Pd.',
};

export const DEFAULT_TU_STAFF: TuStaffConfig = {
  isEnabled: true,
  activeGtkId: null,
  activeStaffName: 'Sulistyowati, S.Pd.',
  activeStaffNip: '',
  activeStaffRole: 'Koordinator Pelayanan Tata Usaha',
  activeStaffPhoto: '/src/assets/images/tu_staff_avatar_1795598580710.jpg',
  deactivatedReason: '',
  operators: [],
  updatedAt: '2026-11-25T07:00:00+07:00',
  updatedBy: 'Sulistyowati, S.Pd.',
};

export const DEFAULT_BACKUP_SETTINGS: BackupSettingsConfig = {
  targetEmail: 'smanixsurabaya@gmail.com',
  ccEmail: '',
  subjectPrefix: '[Backup SIP TU SMAN 9 Surabaya]',
  defaultScope: 'all',
  includeAttachmentFormat: 'json',
  lastBackupAt: '',
  lastBackupBy: '',
  lastEmailSentAt: '',
  lastEmailRecipient: '',
  updatedAt: '2026-11-25T07:00:00+07:00',
  updatedBy: 'Sulistyowati, S.Pd.',
};

export interface ClaimedTokenRecord {
  salt: string;
  hash: string;
  claimedAt: string;
}

export interface PersuratanSettingsData {
  kopSurat: KopSuratConfig;
  reportingPortal: ReportingPortalConfig;
  tuStaff?: TuStaffConfig;
  backup?: BackupSettingsConfig;
}

export interface RepositoryEnvelope<T> {
  repository: string;
  label: string;
  schemaVersion: number;
  updatedAt: string;
  totalRecords: number;
  data: T;
}

export interface RepositoryStatusItem {
  key: keyof typeof REPOSITORY_FILES;
  label: string;
  fileName: string;
  totalRecords: number;
  updatedAt: string;
}

const BUILTIN_KOP_ASSETS = new Set([
  '/assets/logo-jatim-sman9.png',
  '/assets/aistudio/image_53f155ea.png',
  '/src/assets/images/tu_staff_avatar_1795598580710.jpg',
]);

export function isSafeRasterImageDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === '' || BUILTIN_KOP_ASSETS.has(value)) return true;
  if (value.length > 2_800_000) return false;
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

export function sanitizeKopSurat(
  input: unknown,
  fallback: KopSuratConfig = DEFAULT_KOP_SURAT
): { config: KopSuratConfig; error?: string } {
  if (!input || typeof input !== 'object') {
    return { config: fallback, error: 'Payload konfigurasi Kop Surat tidak valid.' };
  }
  const raw = input as Partial<KopSuratConfig>;
  const mode: KopSuratMode = raw.mode === 'upload-banner' ? 'upload-banner' : 'custom';
  const dividerStyle: KopDividerStyle =
    raw.dividerStyle === 'thick-thin' || raw.dividerStyle === 'single'
      ? raw.dividerStyle
      : 'double';

  const bannerImageDataUrl =
    typeof raw.bannerImageDataUrl === 'string' ? raw.bannerImageDataUrl : '';
  const leftLogoDataUrl =
    typeof raw.leftLogoDataUrl === 'string' ? raw.leftLogoDataUrl : '';
  const rightLogoDataUrl =
    typeof raw.rightLogoDataUrl === 'string' ? raw.rightLogoDataUrl : '';

  if (
    !isSafeRasterImageDataUrl(bannerImageDataUrl) ||
    !isSafeRasterImageDataUrl(leftLogoDataUrl) ||
    !isSafeRasterImageDataUrl(rightLogoDataUrl)
  ) {
    return {
      config: fallback,
      error: 'Format gambar tidak didukung atau melebihi 2 MB. Gunakan file PNG, JPG, atau WEBP.',
    };
  }

  if (mode === 'upload-banner' && !bannerImageDataUrl) {
    return {
      config: fallback,
      error: 'Silakan unggah berkas gambar Kop Surat terlebih dahulu untuk mode Upload Berkas.',
    };
  }

  const cleanText = (val: unknown, defaultVal: string, maxLen = 200): string => {
    if (typeof val !== 'string') return defaultVal;
    return val.trim().slice(0, maxLen);
  };

  return {
    config: {
      showKopSurat: raw.showKopSurat !== false,
      mode,
      bannerImageDataUrl,
      leftLogoDataUrl,
      rightLogoDataUrl,
      provinceLine: cleanText(raw.provinceLine, fallback.provinceLine, 120),
      departmentLine: cleanText(raw.departmentLine, fallback.departmentLine, 120),
      schoolNameLine: cleanText(raw.schoolNameLine, fallback.schoolNameLine, 120),
      addressLine: cleanText(raw.addressLine, fallback.addressLine, 220),
      contactLine: cleanText(raw.contactLine, fallback.contactLine, 220),
      websiteLine: cleanText(raw.websiteLine, fallback.websiteLine, 220),
      dividerStyle,
      cityName: cleanText(raw.cityName, fallback.cityName, 80) || 'Surabaya',
      principalTitle: cleanText(raw.principalTitle, fallback.principalTitle, 100) || 'Kepala Sekolah,',
      principalName: cleanText(raw.principalName, fallback.principalName, 120) || fallback.principalName,
      principalNip: cleanText(raw.principalNip, fallback.principalNip, 40),
    },
  };
}

export function sanitizeReportingPortal(
  input: unknown,
  fallback: ReportingPortalConfig = DEFAULT_REPORTING_PORTAL
): ReportingPortalConfig {
  if (!input || typeof input !== 'object') return fallback;
  const raw = input as Partial<ReportingPortalConfig>;
  return {
    isOpen: raw.isOpen !== false,
    closedMessage:
      typeof raw.closedMessage === 'string' && raw.closedMessage.trim()
        ? raw.closedMessage.trim().slice(0, 500)
        : fallback.closedMessage,
    updatedAt:
      typeof raw.updatedAt === 'string' && raw.updatedAt
        ? raw.updatedAt
        : new Date().toISOString(),
    updatedBy:
      typeof raw.updatedBy === 'string' && raw.updatedBy.trim()
        ? raw.updatedBy.trim().slice(0, 120)
        : fallback.updatedBy,
  };
}

const VALID_BACKUP_SCOPES = new Set<BackupScopeKey>([
  'all',
  'requests',
  'agenda',
  'settings',
  'students',
  'gtk',
  'rombels',
]);

export function isValidEmailAddress(email: string): boolean {
  return /^[^\s@<>()[\]\\,;:\s@"]+@[^\s@<>()[\]\\,;:\s@"]+\.[^\s@<>()[\]\\,;:\s@"]{2,}$/.test(
    email.trim()
  );
}

export function sanitizeBackupSettings(
  input: unknown,
  fallback: BackupSettingsConfig = DEFAULT_BACKUP_SETTINGS
): { config: BackupSettingsConfig; error?: string } {
  if (!input || typeof input !== 'object') {
    return { config: fallback };
  }
  const raw = input as Partial<BackupSettingsConfig>;
  const targetEmail =
    typeof raw.targetEmail === 'string' ? raw.targetEmail.trim().slice(0, 180) : fallback.targetEmail;
  const ccEmail =
    typeof raw.ccEmail === 'string' ? raw.ccEmail.trim().slice(0, 180) : fallback.ccEmail;

  if (targetEmail && !isValidEmailAddress(targetEmail)) {
    return { config: fallback, error: 'Format alamat email tujuan backup tidak valid.' };
  }
  if (ccEmail && !isValidEmailAddress(ccEmail)) {
    return { config: fallback, error: 'Format alamat email CC tidak valid.' };
  }

  const defaultScope: BackupScopeKey =
    typeof raw.defaultScope === 'string' && VALID_BACKUP_SCOPES.has(raw.defaultScope as BackupScopeKey)
      ? (raw.defaultScope as BackupScopeKey)
      : fallback.defaultScope;

  const includeAttachmentFormat =
    raw.includeAttachmentFormat === 'both' ? 'both' : 'json';

  return {
    config: {
      targetEmail,
      ccEmail,
      subjectPrefix:
        typeof raw.subjectPrefix === 'string' && raw.subjectPrefix.trim()
          ? raw.subjectPrefix.trim().slice(0, 120)
          : fallback.subjectPrefix,
      defaultScope,
      includeAttachmentFormat,
      lastBackupAt:
        typeof raw.lastBackupAt === 'string' ? raw.lastBackupAt.slice(0, 64) : fallback.lastBackupAt,
      lastBackupBy:
        typeof raw.lastBackupBy === 'string' ? raw.lastBackupBy.slice(0, 160) : fallback.lastBackupBy,
      lastEmailSentAt:
        typeof raw.lastEmailSentAt === 'string'
          ? raw.lastEmailSentAt.slice(0, 64)
          : fallback.lastEmailSentAt,
      lastEmailRecipient:
        typeof raw.lastEmailRecipient === 'string'
          ? raw.lastEmailRecipient.slice(0, 180)
          : fallback.lastEmailRecipient,
      updatedAt:
        typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : new Date().toISOString(),
      updatedBy:
        typeof raw.updatedBy === 'string' && raw.updatedBy.trim()
          ? raw.updatedBy.trim().slice(0, 160)
          : fallback.updatedBy,
    },
  };
}

export function buildGtkOperatorRole(gtk: DapodikGtk): string {
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

export function isPegawaiTuGtk(gtk: DapodikGtk): boolean {
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

export function sanitizeTuStaffConfig(
  input: unknown,
  gtkList: DapodikGtk[] = [],
  fallback: TuStaffConfig = DEFAULT_TU_STAFF
): TuStaffConfig {
  if (!input || typeof input !== 'object') return fallback;
  const raw = input as Partial<TuStaffConfig>;
  const gtkMap = new Map(gtkList.map((g) => [g.id, g]));

  const rawOperators = Array.isArray(raw.operators) ? raw.operators : fallback.operators;
  const seenIds = new Set<string>();
  const operators: TuStaffOperator[] = [];
  for (const op of rawOperators) {
    if (!op || typeof op !== 'object' || typeof op.gtkId !== 'string' || !op.gtkId.trim()) continue;
    const gtkId = op.gtkId.trim();
    if (seenIds.has(gtkId)) continue;
    seenIds.add(gtkId);
    const matchedGtk = gtkMap.get(gtkId);
    operators.push({
      gtkId,
      nama: matchedGtk
        ? formatPtkDisplayName(matchedGtk)
        : (typeof op.nama === 'string' && op.nama.trim().slice(0, 160)) || 'Pegawai TU',
      nip: matchedGtk
        ? (matchedGtk.nip || matchedGtk.nuptk || '').trim()
        : (typeof op.nip === 'string' ? op.nip.trim().slice(0, 40) : ''),
      jabatan: matchedGtk
        ? buildGtkOperatorRole(matchedGtk)
        : (typeof op.jabatan === 'string' && op.jabatan.trim().slice(0, 160)) || 'Pegawai Tata Usaha',
      fotoDataUrl: matchedGtk
        ? matchedGtk.fotoDataUrl || ''
        : isSafeRasterImageDataUrl(op.fotoDataUrl)
          ? op.fotoDataUrl
          : '',
      isActive: op.isActive !== false,
      updatedAt:
        typeof op.updatedAt === 'string' && op.updatedAt ? op.updatedAt : new Date().toISOString(),
    });
  }

  const requestedActiveGtkId =
    typeof raw.activeGtkId === 'string' && raw.activeGtkId.trim() ? raw.activeGtkId.trim() : null;
  const activeGtk = requestedActiveGtkId ? gtkMap.get(requestedActiveGtkId) : undefined;

  const isEnabled = raw.isEnabled !== false;
  const activeStaffName = activeGtk
    ? formatPtkDisplayName(activeGtk)
    : typeof raw.activeStaffName === 'string' && raw.activeStaffName.trim()
      ? raw.activeStaffName.trim().slice(0, 160)
      : fallback.activeStaffName;

  const activeStaffNip = activeGtk
    ? (activeGtk.nip || activeGtk.nuptk || '').trim()
    : typeof raw.activeStaffNip === 'string'
      ? raw.activeStaffNip.trim().slice(0, 40)
      : fallback.activeStaffNip;

  const activeStaffRole = activeGtk
    ? buildGtkOperatorRole(activeGtk)
    : typeof raw.activeStaffRole === 'string' && raw.activeStaffRole.trim()
      ? raw.activeStaffRole.trim().slice(0, 160)
      : fallback.activeStaffRole;

  const activeStaffPhoto = activeGtk
    ? activeGtk.fotoDataUrl || ''
    : isSafeRasterImageDataUrl(raw.activeStaffPhoto)
      ? raw.activeStaffPhoto
      : fallback.activeStaffPhoto;

  return {
    isEnabled,
    activeGtkId: requestedActiveGtkId,
    activeStaffName,
    activeStaffNip,
    activeStaffRole,
    activeStaffPhoto,
    deactivatedReason:
      typeof raw.deactivatedReason === 'string' ? raw.deactivatedReason.trim().slice(0, 300) : '',
    operators,
    updatedAt:
      typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : new Date().toISOString(),
    updatedBy:
      typeof raw.updatedBy === 'string' && raw.updatedBy.trim()
        ? raw.updatedBy.trim().slice(0, 160)
        : fallback.updatedBy,
  };
}

export function toPublicTuStaffInfo(config: TuStaffConfig): PublicTuStaffInfo {
  return {
    isEnabled: config.isEnabled,
    activeStaffName: config.isEnabled ? config.activeStaffName : 'Petugas TU Dinonaktifkan',
    activeStaffRole: config.isEnabled ? config.activeStaffRole : 'Penugasan Petugas TU Nonaktif',
    activeStaffPhoto: config.isEnabled ? config.activeStaffPhoto : '',
    deactivatedReason: config.isEnabled ? '' : config.deactivatedReason,
    updatedAt: config.updatedAt,
  };
}

const LEGACY_DUMMY_STUDENT_IDS = new Set([
  'pd-001',
  'pd-002',
  'pd-003',
  'pd-004',
  'pd-005',
  'pd-006',
  'pd-007',
  'pd-imp-1795640655987-8',
  'pd-imp-1795640655986-7',
  'pd-imp-1795640655986-6',
]);
const LEGACY_DUMMY_STUDENT_NISNS = new Set(['0081234567', '0081923412', '0072819231']);
function isLegacyDummyStudent(s: Partial<DapodikStudent> | null | undefined): boolean {
  if (!s) return true;
  if (typeof s.id === 'string' && LEGACY_DUMMY_STUDENT_IDS.has(s.id)) return true;
  if (typeof s.nisn === 'string' && LEGACY_DUMMY_STUDENT_NISNS.has(s.nisn.trim())) return true;
  return false;
}
const LEGACY_DUMMY_REQUEST_IDS = new Set([
  'TU-2026-0148',
  'TU-2026-0149',
  'TU-2026-0150',
  'TU-2026-0151',
  'TU-2026-0152',
  'TU-2026-0141',
]);
const LEGACY_DUMMY_AGENDA_IDS = new Set(['ag-1', 'ag-2', 'ag-3', 'ag-4', 'ag-5']);

function atomicWriteJson(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function writeEnvelope<T>(
  filePath: string,
  repository: string,
  label: string,
  data: T,
  totalRecords: number
): RepositoryEnvelope<T> {
  const envelope: RepositoryEnvelope<T> = {
    repository,
    label,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    totalRecords,
    data,
  };
  atomicWriteJson(filePath, envelope);
  return envelope;
}

function readEnvelope<T>(
  filePath: string,
  repository: string,
  label: string,
  defaultData: T,
  computeCount: (val: T) => number
): RepositoryEnvelope<T> {
  if (!fs.existsSync(filePath)) {
    return writeEnvelope(filePath, repository, label, defaultData, computeCount(defaultData));
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<RepositoryEnvelope<T>>;
    if (parsed && parsed.data !== undefined) {
      return {
        repository: parsed.repository || repository,
        label: parsed.label || label,
        schemaVersion: parsed.schemaVersion || 1,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        totalRecords:
          typeof parsed.totalRecords === 'number'
            ? parsed.totalRecords
            : computeCount(parsed.data),
        data: parsed.data,
      };
    }
    return writeEnvelope(filePath, repository, label, defaultData, computeCount(defaultData));
  } catch {
    return writeEnvelope(filePath, repository, label, defaultData, computeCount(defaultData));
  }
}

let migrationChecked = false;

export function ensureRepositoriesInitialized(): void {
  if (migrationChecked) return;
  migrationChecked = true;
  fs.mkdirSync(REPO_DIR, { recursive: true });

  // One-time migration from legacy monolithic data/tu_store.json if repository files don't exist yet
  let legacy: Record<string, unknown> | null = null;
  if (fs.existsSync(LEGACY_STORE_PATH)) {
    try {
      const raw = fs.readFileSync(LEGACY_STORE_PATH, 'utf8');
      legacy = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      legacy = null;
    }
  }

  if (!fs.existsSync(REPOSITORY_FILES.gtk)) {
    const rawGtk = Array.isArray(legacy?.gtkList)
      ? (legacy!.gtkList as DapodikGtk[]).map(applyDispendukcapilCheck)
      : [];
    writeGtkRepository(rawGtk);
  }

  const currentGtk = readGtkRepository();

  if (!fs.existsSync(REPOSITORY_FILES.students)) {
    const rawStudents = Array.isArray(legacy?.students)
      ? (legacy!.students as DapodikStudent[]).filter((s) => !isLegacyDummyStudent(s))
      : [];
    writeStudentsRepository(rawStudents);
  }

  if (!fs.existsSync(REPOSITORY_FILES.rombels)) {
    const rawRombels = Array.isArray(legacy?.rombels)
      ? sortRombelsNaturally(
          (legacy!.rombels as DapodikRombel[]).map((r) => normalizeRombelRecord(r, currentGtk))
        )
      : [];
    writeRombelsRepository(rawRombels);
  }

  if (!fs.existsSync(REPOSITORY_FILES.requests)) {
    const rawRequests = Array.isArray(legacy?.requests)
      ? (legacy!.requests as ServiceRequest[]).filter(
          (r) => r && !LEGACY_DUMMY_REQUEST_IDS.has(r.id)
        )
      : [];
    writeRequestsRepository(rawRequests);
  }

  if (!fs.existsSync(REPOSITORY_FILES.agenda)) {
    const rawAgenda = Array.isArray(legacy?.agenda)
      ? (legacy!.agenda as AgendaEntry[]).filter((a) => a && !LEGACY_DUMMY_AGENDA_IDS.has(a.id))
      : [];
    writeAgendaRepository(rawAgenda);
  }

  if (!fs.existsSync(REPOSITORY_FILES.settings)) {
    const kopRes = legacy?.kopSurat
      ? sanitizeKopSurat(legacy.kopSurat, DEFAULT_KOP_SURAT).config
      : DEFAULT_KOP_SURAT;
    const portalRes = legacy?.reportingPortal
      ? sanitizeReportingPortal(legacy.reportingPortal, DEFAULT_REPORTING_PORTAL)
      : DEFAULT_REPORTING_PORTAL;
    const tuStaffRes = legacy?.tuStaff
      ? sanitizeTuStaffConfig(legacy.tuStaff, currentGtk, DEFAULT_TU_STAFF)
      : DEFAULT_TU_STAFF;
    const backupRes = legacy?.backup
      ? sanitizeBackupSettings(legacy.backup, DEFAULT_BACKUP_SETTINGS).config
      : DEFAULT_BACKUP_SETTINGS;
    writeSettingsRepository({
      kopSurat: kopRes,
      reportingPortal: portalRes,
      tuStaff: tuStaffRes,
      backup: backupRes,
    });
  }

  if (!fs.existsSync(AUTH_STORE_PATH) && legacy?.claimedToken) {
    atomicWriteJson(AUTH_STORE_PATH, { claimedToken: legacy.claimedToken });
  }
}

// --- Auth Store (kept in gitignored data/tu_auth.json) ---
export function readClaimedToken(): ClaimedTokenRecord | null {
  ensureRepositoriesInitialized();
  if (!fs.existsSync(AUTH_STORE_PATH)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(AUTH_STORE_PATH, 'utf8')) as {
      claimedToken?: ClaimedTokenRecord | null;
    };
    return parsed.claimedToken ?? null;
  } catch {
    return null;
  }
}

export function writeClaimedToken(record: ClaimedTokenRecord | null): void {
  atomicWriteJson(AUTH_STORE_PATH, { claimedToken: record });
}

// --- Persuratan: Permohonan Surat ---
export function readRequestsRepository(): ServiceRequest[] {
  ensureRepositoriesInitialized();
  const env = readEnvelope<ServiceRequest[]>(
    REPOSITORY_FILES.requests,
    'persuratan-permohonan',
    'Database Repositori Permohonan Surat TU SMAN 9 Surabaya',
    [],
    (arr) => arr.length
  );
  return Array.isArray(env.data) ? env.data : [];
}

export function writeRequestsRepository(requests: ServiceRequest[]): RepositoryEnvelope<ServiceRequest[]> {
  return writeEnvelope(
    REPOSITORY_FILES.requests,
    'persuratan-permohonan',
    'Database Repositori Permohonan Surat TU SMAN 9 Surabaya',
    requests,
    requests.length
  );
}

// --- Persuratan: Buku Agenda Surat Masuk & Keluar ---
export function readAgendaRepository(): AgendaEntry[] {
  ensureRepositoriesInitialized();
  const env = readEnvelope<AgendaEntry[]>(
    REPOSITORY_FILES.agenda,
    'persuratan-agenda',
    'Database Repositori Buku Agenda Surat Masuk & Keluar SMAN 9 Surabaya',
    [],
    (arr) => arr.length
  );
  return Array.isArray(env.data) ? env.data : [];
}

export function writeAgendaRepository(agenda: AgendaEntry[]): RepositoryEnvelope<AgendaEntry[]> {
  return writeEnvelope(
    REPOSITORY_FILES.agenda,
    'persuratan-agenda',
    'Database Repositori Buku Agenda Surat Masuk & Keluar SMAN 9 Surabaya',
    agenda,
    agenda.length
  );
}

// --- Persuratan: Pengaturan Kop Surat, Portal Pelaporan & Petugas TU ---
export function readSettingsRepository(): PersuratanSettingsData & {
  tuStaff: TuStaffConfig;
  backup: BackupSettingsConfig;
} {
  ensureRepositoriesInitialized();
  const fallback: PersuratanSettingsData & {
    tuStaff: TuStaffConfig;
    backup: BackupSettingsConfig;
  } = {
    kopSurat: DEFAULT_KOP_SURAT,
    reportingPortal: DEFAULT_REPORTING_PORTAL,
    tuStaff: DEFAULT_TU_STAFF,
    backup: DEFAULT_BACKUP_SETTINGS,
  };
  const env = readEnvelope<PersuratanSettingsData>(
    REPOSITORY_FILES.settings,
    'persuratan-pengaturan',
    'Database Repositori Pengaturan Kop Surat & Portal Layanan TU',
    fallback,
    () => 1
  );
  const gtkList = readGtkRepository();
  return {
    kopSurat: sanitizeKopSurat(env.data?.kopSurat, DEFAULT_KOP_SURAT).config,
    reportingPortal: sanitizeReportingPortal(env.data?.reportingPortal, DEFAULT_REPORTING_PORTAL),
    tuStaff: sanitizeTuStaffConfig(env.data?.tuStaff, gtkList, DEFAULT_TU_STAFF),
    backup: sanitizeBackupSettings(env.data?.backup, DEFAULT_BACKUP_SETTINGS).config,
  };
}

export function writeSettingsRepository(
  settings: PersuratanSettingsData
): RepositoryEnvelope<PersuratanSettingsData> {
  return writeEnvelope(
    REPOSITORY_FILES.settings,
    'persuratan-pengaturan',
    'Database Repositori Pengaturan Kop Surat & Portal Layanan TU',
    settings,
    1
  );
}

// --- Database Siswa Dapodik ---
export function readStudentsRepository(): DapodikStudent[] {
  ensureRepositoriesInitialized();
  const env = readEnvelope<DapodikStudent[]>(
    REPOSITORY_FILES.students,
    'dapodik-siswa',
    'Database Repositori Peserta Didik Dapodik SMAN 9 Surabaya',
    [],
    (arr) => arr.length
  );
  return Array.isArray(env.data) ? env.data.filter((s) => !isLegacyDummyStudent(s)) : [];
}

export function writeStudentsRepository(students: DapodikStudent[]): RepositoryEnvelope<DapodikStudent[]> {
  return writeEnvelope(
    REPOSITORY_FILES.students,
    'dapodik-siswa',
    'Database Repositori Peserta Didik Dapodik SMAN 9 Surabaya',
    students,
    students.length
  );
}

// --- Database GTK Dapodik ---
export function readGtkRepository(): DapodikGtk[] {
  ensureRepositoriesInitialized();
  const env = readEnvelope<DapodikGtk[]>(
    REPOSITORY_FILES.gtk,
    'dapodik-gtk',
    'Database Repositori GTK Dapodik & Dispendukcapil SMAN 9 Surabaya',
    [],
    (arr) => arr.length
  );
  return Array.isArray(env.data) ? env.data.map(applyDispendukcapilCheck) : [];
}

export function writeGtkRepository(gtkList: DapodikGtk[]): RepositoryEnvelope<DapodikGtk[]> {
  return writeEnvelope(
    REPOSITORY_FILES.gtk,
    'dapodik-gtk',
    'Database Repositori GTK Dapodik & Dispendukcapil SMAN 9 Surabaya',
    gtkList,
    gtkList.length
  );
}

// --- Database Rombongan Belajar & Wali Kelas ---
export function readRombelsRepository(): DapodikRombel[] {
  ensureRepositoriesInitialized();
  const env = readEnvelope<DapodikRombel[]>(
    REPOSITORY_FILES.rombels,
    'dapodik-rombel',
    'Database Repositori Rombongan Belajar & Wali Kelas SMAN 9 Surabaya',
    [],
    (arr) => arr.length
  );
  const gtkList = readGtkRepository();
  return Array.isArray(env.data)
    ? sortRombelsNaturally(env.data.map((r) => normalizeRombelRecord(r, gtkList)))
    : [];
}

export function writeRombelsRepository(rombels: DapodikRombel[]): RepositoryEnvelope<DapodikRombel[]> {
  return writeEnvelope(
    REPOSITORY_FILES.rombels,
    'dapodik-rombel',
    'Database Repositori Rombongan Belajar & Wali Kelas SMAN 9 Surabaya',
    rombels,
    rombels.length
  );
}

export function getRepositoryStatuses(): RepositoryStatusItem[] {
  ensureRepositoriesInitialized();
  const specs: Array<{ key: keyof typeof REPOSITORY_FILES; label: string }> = [
    { key: 'requests', label: 'Persuratan: Permohonan Layanan' },
    { key: 'agenda', label: 'Persuratan: Buku Agenda Surat' },
    { key: 'settings', label: 'Persuratan: Kop & Portal Layanan' },
    { key: 'students', label: 'Database Siswa Dapodik' },
    { key: 'gtk', label: 'Database GTK Dapodik' },
    { key: 'rombels', label: 'Database Rombel & Wali Kelas' },
  ];

  return specs.map(({ key, label }) => {
    const filePath = REPOSITORY_FILES[key];
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<RepositoryEnvelope<unknown>>;
      return {
        key,
        label,
        fileName: `database/${path.basename(filePath)}`,
        totalRecords: typeof parsed.totalRecords === 'number' ? parsed.totalRecords : 0,
        updatedAt: parsed.updatedAt || '',
      };
    } catch {
      return {
        key,
        label,
        fileName: `database/${path.basename(filePath)}`,
        totalRecords: 0,
        updatedAt: '',
      };
    }
  });
}

export function buildBackupBundle(
  scope: BackupScopeKey = 'all',
  exportedBy = 'Petugas Tata Usaha'
): BackupBundlePayload {
  ensureRepositoriesInitialized();
  const includeAll = scope === 'all';
  const requests = includeAll || scope === 'requests' ? readRequestsRepository() : undefined;
  const agenda = includeAll || scope === 'agenda' ? readAgendaRepository() : undefined;
  const settings = includeAll || scope === 'settings' ? readSettingsRepository() : undefined;
  const students = includeAll || scope === 'students' ? readStudentsRepository() : undefined;
  const gtk = includeAll || scope === 'gtk' ? readGtkRepository() : undefined;
  const rombels = includeAll || scope === 'rombels' ? readRombelsRepository() : undefined;

  return {
    app: 'SIP-TU-SMAN9-SBY',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    exportedBy,
    scope,
    counts: {
      requests: requests?.length ?? 0,
      agenda: agenda?.length ?? 0,
      students: students?.length ?? 0,
      gtk: gtk?.length ?? 0,
      rombels: rombels?.length ?? 0,
      settings: settings ? 1 : 0,
    },
    repositories: {
      ...(requests !== undefined ? { requests } : {}),
      ...(agenda !== undefined ? { agenda } : {}),
      ...(settings !== undefined ? { settings } : {}),
      ...(students !== undefined ? { students } : {}),
      ...(gtk !== undefined ? { gtk } : {}),
      ...(rombels !== undefined ? { rombels } : {}),
    },
  };
}

export interface RestoreResultSummary {
  restoredKeys: BackupRepositoryKey[];
  counts: Record<BackupRepositoryKey, number>;
  restoredAt: string;
}

function extractRepositoriesFromInput(
  rawInput: unknown
): BackupBundlePayload['repositories'] | null {
  if (!rawInput || typeof rawInput !== 'object') return null;
  const obj = rawInput as Record<string, unknown>;

  if (obj.repositories && typeof obj.repositories === 'object') {
    return obj.repositories as BackupBundlePayload['repositories'];
  }

  // Also support single-file RepositoryEnvelope exported directly from database/*.json
  if (typeof obj.repository === 'string' && obj.data !== undefined) {
    const repoMap: Record<string, BackupRepositoryKey> = {
      'persuratan-permohonan': 'requests',
      'persuratan-agenda': 'agenda',
      'persuratan-pengaturan': 'settings',
      'dapodik-siswa': 'students',
      'dapodik-gtk': 'gtk',
      'dapodik-rombel': 'rombels',
    };
    const matchedKey = repoMap[obj.repository];
    if (matchedKey) {
      return { [matchedKey]: obj.data } as BackupBundlePayload['repositories'];
    }
  }

  return null;
}

export function restoreBackupBundle(
  bundleInput: unknown,
  selectedRepos: BackupRepositoryKey[],
  mode: 'replace' | 'merge',
  actorName: string
): { summary: RestoreResultSummary; error?: string } {
  const repos = extractRepositoriesFromInput(bundleInput);
  if (!repos) {
    return {
      summary: {
        restoredKeys: [],
        counts: { requests: 0, agenda: 0, settings: 0, students: 0, gtk: 0, rombels: 0 },
        restoredAt: new Date().toISOString(),
      },
      error: 'Format file backup JSON tidak dikenali. Gunakan file hasil ekspor SIP TU SMAN 9 Surabaya.',
    };
  }

  const allowedSet = new Set<BackupRepositoryKey>(selectedRepos);
  const restoredKeys: BackupRepositoryKey[] = [];
  const counts: Record<BackupRepositoryKey, number> = {
    requests: 0,
    agenda: 0,
    settings: 0,
    students: 0,
    gtk: 0,
    rombels: 0,
  };
  const nowIso = new Date().toISOString();

  // 1. Restore GTK first so Rombel & TuStaff can resolve GTK IDs accurately
  if (allowedSet.has('gtk') && Array.isArray(repos.gtk)) {
    const sanitizedIncoming = repos.gtk
      .filter((g): g is DapodikGtk => Boolean(g && typeof g === 'object' && typeof g.nama === 'string' && g.nama.trim()))
      .map((g, idx) =>
        applyDispendukcapilCheck({
          ...g,
          fotoDataUrl: isSafeRasterImageDataUrl(g.fotoDataUrl ?? '') ? (g.fotoDataUrl ?? '') : '',
          id: typeof g.id === 'string' && g.id.trim() ? g.id.trim() : `gtk-rst-${Date.now()}-${idx}`,
        })
      );

    if (mode === 'replace') {
      writeGtkRepository(sanitizedIncoming);
      counts.gtk = sanitizedIncoming.length;
    } else {
      const existing = readGtkRepository();
      for (const inc of sanitizedIncoming) {
        const idx = existing.findIndex(
          (cur) =>
            cur.id === inc.id ||
            (inc.nik && cur.nik === inc.nik) ||
            (inc.nip && cur.nip === inc.nip) ||
            (inc.nuptk && cur.nuptk === inc.nuptk)
        );
        if (idx >= 0) {
          existing[idx] = applyDispendukcapilCheck({
            ...existing[idx],
            ...inc,
            fotoDataUrl: inc.fotoDataUrl || existing[idx].fotoDataUrl || '',
            id: existing[idx].id,
          });
        } else {
          existing.unshift(inc);
        }
      }
      writeGtkRepository(existing);
      counts.gtk = sanitizedIncoming.length;
    }
    restoredKeys.push('gtk');
  }

  const latestGtkList = readGtkRepository();

  // 2. Students
  if (allowedSet.has('students') && Array.isArray(repos.students)) {
    const sanitizedIncoming = repos.students
      .filter((s): s is DapodikStudent => Boolean(s && typeof s === 'object' && typeof s.nama === 'string' && s.nama.trim()))
      .map((s, idx) => ({
        ...s,
        id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `pd-rst-${Date.now()}-${idx}`,
        vervalPdSyncAt: s.vervalPdSyncAt || nowIso,
      }));

    if (mode === 'replace') {
      writeStudentsRepository(sanitizedIncoming);
      counts.students = sanitizedIncoming.length;
    } else {
      const existing = readStudentsRepository();
      for (const inc of sanitizedIncoming) {
        const idx = existing.findIndex(
          (cur) =>
            cur.id === inc.id ||
            (inc.nisn && cur.nisn === inc.nisn) ||
            (inc.nipd && cur.nipd === inc.nipd)
        );
        if (idx >= 0) {
          existing[idx] = { ...existing[idx], ...inc, id: existing[idx].id };
        } else {
          existing.unshift(inc);
        }
      }
      writeStudentsRepository(existing);
      counts.students = sanitizedIncoming.length;
    }
    restoredKeys.push('students');
  }

  // 3. Rombels
  if (allowedSet.has('rombels') && Array.isArray(repos.rombels)) {
    const sanitizedIncoming = repos.rombels
      .filter((r): r is DapodikRombel => Boolean(r && typeof r === 'object' && typeof r.namaRombel === 'string' && r.namaRombel.trim()))
      .map((r, idx) =>
        normalizeRombelRecord(
          {
            ...r,
            id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `rombel-rst-${Date.now()}-${idx}`,
            updatedAt: r.updatedAt || nowIso,
          },
          latestGtkList
        )
      );

    if (mode === 'replace') {
      writeRombelsRepository(sortRombelsNaturally(sanitizedIncoming));
      counts.rombels = sanitizedIncoming.length;
    } else {
      const existing = readRombelsRepository();
      for (const inc of sanitizedIncoming) {
        const idx = existing.findIndex(
          (cur) =>
            cur.id === inc.id ||
            cur.namaRombel.toUpperCase() === inc.namaRombel.toUpperCase()
        );
        if (idx >= 0) {
          existing[idx] = normalizeRombelRecord(
            { ...existing[idx], ...inc, id: existing[idx].id, updatedAt: nowIso },
            latestGtkList
          );
        } else {
          existing.push(inc);
        }
      }
      writeRombelsRepository(sortRombelsNaturally(existing));
      counts.rombels = sanitizedIncoming.length;
    }
    restoredKeys.push('rombels');
  }

  // 4. Requests
  if (allowedSet.has('requests') && Array.isArray(repos.requests)) {
    const sanitizedIncoming = repos.requests
      .filter(
        (r): r is ServiceRequest =>
          Boolean(
            r &&
              typeof r === 'object' &&
              typeof r.applicantName === 'string' &&
              r.applicantName.trim() &&
              typeof r.purpose === 'string'
          )
      )
      .map((r, idx) => ({
        ...r,
        id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `TU-RST-${Date.now()}-${idx}`,
        timeline: Array.isArray(r.timeline) ? r.timeline : [],
        submittedRequirements: Array.isArray(r.submittedRequirements) ? r.submittedRequirements : [],
      }));

    if (mode === 'replace') {
      writeRequestsRepository(sanitizedIncoming);
      counts.requests = sanitizedIncoming.length;
    } else {
      const existing = readRequestsRepository();
      for (const inc of sanitizedIncoming) {
        const idx = existing.findIndex((cur) => cur.id === inc.id);
        if (idx >= 0) {
          existing[idx] = inc;
        } else {
          existing.unshift(inc);
        }
      }
      writeRequestsRepository(existing);
      counts.requests = sanitizedIncoming.length;
    }
    restoredKeys.push('requests');
  }

  // 5. Agenda
  if (allowedSet.has('agenda') && Array.isArray(repos.agenda)) {
    const sanitizedIncoming = repos.agenda
      .filter(
        (a): a is AgendaEntry =>
          Boolean(
            a &&
              typeof a === 'object' &&
              typeof a.subject === 'string' &&
              a.subject.trim() &&
              typeof a.letterNumber === 'string'
          )
      )
      .map((a, idx) => ({
        ...a,
        id: typeof a.id === 'string' && a.id.trim() ? a.id.trim() : `ag-rst-${Date.now()}-${idx}`,
      }));

    if (mode === 'replace') {
      writeAgendaRepository(sanitizedIncoming);
      counts.agenda = sanitizedIncoming.length;
    } else {
      const existing = readAgendaRepository();
      for (const inc of sanitizedIncoming) {
        const idx = existing.findIndex(
          (cur) =>
            cur.id === inc.id ||
            (inc.agendaNumber && cur.agendaNumber === inc.agendaNumber)
        );
        if (idx >= 0) {
          existing[idx] = inc;
        } else {
          existing.unshift(inc);
        }
      }
      writeAgendaRepository(existing);
      counts.agenda = sanitizedIncoming.length;
    }
    restoredKeys.push('agenda');
  }

  // 6. Settings
  if (allowedSet.has('settings') && repos.settings && typeof repos.settings === 'object') {
    const currentSettings = readSettingsRepository();
    const rawSet = repos.settings;
    const nextSettings: PersuratanSettingsData = {
      kopSurat: rawSet.kopSurat
        ? sanitizeKopSurat(rawSet.kopSurat, currentSettings.kopSurat).config
        : currentSettings.kopSurat,
      reportingPortal: rawSet.reportingPortal
        ? sanitizeReportingPortal(rawSet.reportingPortal, currentSettings.reportingPortal)
        : currentSettings.reportingPortal,
      tuStaff: rawSet.tuStaff
        ? sanitizeTuStaffConfig(rawSet.tuStaff, latestGtkList, currentSettings.tuStaff)
        : currentSettings.tuStaff,
      backup: rawSet.backup
        ? sanitizeBackupSettings(rawSet.backup, currentSettings.backup).config
        : currentSettings.backup,
    };
    writeSettingsRepository(nextSettings);
    counts.settings = 1;
    restoredKeys.push('settings');
  }

  if (restoredKeys.length === 0) {
    return {
      summary: {
        restoredKeys: [],
        counts,
        restoredAt: nowIso,
      },
      error: 'Tidak ada data repositori yang valid atau terpilih di dalam berkas backup ini.',
    };
  }

  // Record restore metadata in settings
  const finalSettings = readSettingsRepository();
  writeSettingsRepository({
    ...finalSettings,
    backup: {
      ...finalSettings.backup,
      updatedAt: nowIso,
      updatedBy: actorName,
    },
  });

  return {
    summary: {
      restoredKeys,
      counts,
      restoredAt: nowIso,
    },
  };
}

export type DeduplicateRepoTarget = 'students' | 'gtk' | 'rombels' | 'requests' | 'agenda';

export function deduplicateRepository(
  target: DeduplicateRepoTarget,
  deleteIds: string[]
): {
  deletedCount: number;
  remainingCount: number;
  items: unknown[];
  tuStaff?: TuStaffConfig;
} {
  ensureRepositoriesInitialized();
  const idSet = new Set(deleteIds.map((id) => String(id).trim()).filter(Boolean));

  if (target === 'students') {
    const current = readStudentsRepository();
    const next = current.filter((s) => !idSet.has(s.id));
    writeStudentsRepository(next);
    return {
      deletedCount: current.length - next.length,
      remainingCount: next.length,
      items: next,
    };
  }

  if (target === 'gtk') {
    const current = readGtkRepository();
    const next = current.filter((g) => !idSet.has(g.id));
    writeGtkRepository(next);

    const settings = readSettingsRepository();
    const hadOperator = settings.tuStaff.operators.some((op) => idSet.has(op.gtkId));
    const wasActive = Boolean(settings.tuStaff.activeGtkId && idSet.has(settings.tuStaff.activeGtkId));
    let updatedTuStaff = settings.tuStaff;

    if (hadOperator || wasActive) {
      const nextOperators = settings.tuStaff.operators.filter((op) => !idSet.has(op.gtkId));
      const nextFallbackOp = nextOperators.find((op) => op.isActive) || null;
      updatedTuStaff = sanitizeTuStaffConfig(
        {
          ...settings.tuStaff,
          operators: nextOperators,
          activeGtkId: wasActive ? (nextFallbackOp?.gtkId ?? null) : settings.tuStaff.activeGtkId,
          isEnabled: wasActive && !nextFallbackOp ? false : settings.tuStaff.isEnabled,
          deactivatedReason:
            wasActive && !nextFallbackOp
              ? 'Pegawai TU aktif dihapus saat pembersihan duplikasi GTK.'
              : settings.tuStaff.deactivatedReason,
          updatedAt: new Date().toISOString(),
        },
        next,
        DEFAULT_TU_STAFF
      );
      writeSettingsRepository({ ...settings, tuStaff: updatedTuStaff });
    }

    return {
      deletedCount: current.length - next.length,
      remainingCount: next.length,
      items: next,
      tuStaff: updatedTuStaff,
    };
  }

  if (target === 'rombels') {
    const current = readRombelsRepository();
    const next = sortRombelsNaturally(current.filter((r) => !idSet.has(r.id)));
    writeRombelsRepository(next);
    return {
      deletedCount: current.length - next.length,
      remainingCount: next.length,
      items: next,
    };
  }

  if (target === 'requests') {
    const current = readRequestsRepository();
    const next = current.filter((r) => !idSet.has(r.id));
    writeRequestsRepository(next);
    return {
      deletedCount: current.length - next.length,
      remainingCount: next.length,
      items: next,
    };
  }

  const current = readAgendaRepository();
  const next = current.filter((a) => !idSet.has(a.id));
  writeAgendaRepository(next);
  return {
    deletedCount: current.length - next.length,
    remainingCount: next.length,
    items: next,
  };
}
