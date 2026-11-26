import fs from 'node:fs';
import path from 'node:path';
import type {
  AgendaEntry,
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

export interface ClaimedTokenRecord {
  salt: string;
  hash: string;
  claimedAt: string;
}

export interface PersuratanSettingsData {
  kopSurat: KopSuratConfig;
  reportingPortal: ReportingPortalConfig;
  tuStaff?: TuStaffConfig;
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
    writeSettingsRepository({ kopSurat: kopRes, reportingPortal: portalRes, tuStaff: tuStaffRes });
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
export function readSettingsRepository(): PersuratanSettingsData & { tuStaff: TuStaffConfig } {
  ensureRepositoriesInitialized();
  const fallback: PersuratanSettingsData & { tuStaff: TuStaffConfig } = {
    kopSurat: DEFAULT_KOP_SURAT,
    reportingPortal: DEFAULT_REPORTING_PORTAL,
    tuStaff: DEFAULT_TU_STAFF,
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
