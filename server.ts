import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  AgendaEntry,
  DapodikGtk,
  DapodikRombel,
  DapodikStudent,
  KopDividerStyle,
  KopSuratConfig,
  KopSuratMode,
  ReportingPortalConfig,
  RequestParticipant,
  ServiceRequest,
} from './src/types/tu.ts';
import { applyDispendukcapilCheck, formatPtkDisplayName } from './src/utils/gtkDapodikValidation.ts';
import { normalizeRombelRecord, sortRombelsNaturally } from './src/utils/rombelDapodikUtils.ts';

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'tu_store.json');

const DEFAULT_KOP_SURAT: KopSuratConfig = {
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

const DEFAULT_REPORTING_PORTAL: ReportingPortalConfig = {
  isOpen: true,
  closedMessage:
    'Pelayanan pengajuan permohonan Tata Usaha secara daring sedang ditutup sementara (di luar jam kerja loket atau pemeliharaan berkas). Silakan pantau tiket berjalan atau ajukan kembali saat loket dibuka.',
  updatedAt: '2026-11-25T07:00:00+07:00',
  updatedBy: 'Sulistyowati, S.Pd.',
};

interface ClaimedTokenRecord {
  salt: string;
  hash: string;
  claimedAt: string;
}

interface ServerStore {
  claimedToken: ClaimedTokenRecord | null;
  kopSurat: KopSuratConfig;
  reportingPortal: ReportingPortalConfig;
  students: DapodikStudent[];
  gtkList: DapodikGtk[];
  rombels: DapodikRombel[];
  requests: ServiceRequest[];
  agenda: AgendaEntry[];
}

interface SessionPayload {
  jti: string;
  role: 'petugas';
  staffName: string;
  exp: number;
}

const revokedSessionIds = new Set<string>();

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

function loadInitialSeeds(): Pick<ServerStore, 'students' | 'requests' | 'agenda'> {
  return {
    students: [],
    requests: [],
    agenda: [],
  };
}

function loadInitialGtkSeeds(): DapodikGtk[] {
  return [];
}

const BUILTIN_KOP_ASSETS = new Set([
  '/assets/logo-jatim-sman9.png',
  '/assets/aistudio/image_53f155ea.png',
]);

function isSafeRasterImageDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === '' || BUILTIN_KOP_ASSETS.has(value)) return true;
  if (value.length > 2_800_000) return false;
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

function sanitizeKopSurat(
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

function sanitizeReportingPortal(
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
      typeof raw.updatedBy === 'string' && raw.updatedBy
        ? raw.updatedBy.trim().slice(0, 120)
        : fallback.updatedBy,
  };
}

function loadInitialRombelSeeds(_gtkList: DapodikGtk[]): DapodikRombel[] {
  return [];
}

function readStore(): ServerStore {
  if (!fs.existsSync(STORE_PATH)) {
    const seeds = loadInitialSeeds();
    const gtkList = loadInitialGtkSeeds();
    const initial: ServerStore = {
      claimedToken: null,
      kopSurat: DEFAULT_KOP_SURAT,
      reportingPortal: DEFAULT_REPORTING_PORTAL,
      students: seeds.students,
      gtkList,
      rombels: loadInitialRombelSeeds(gtkList),
      requests: seeds.requests,
      agenda: seeds.agenda,
    };
    writeStore(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ServerStore>;
    const seeds = loadInitialSeeds();
    const kopResult = parsed.kopSurat
      ? sanitizeKopSurat(parsed.kopSurat, DEFAULT_KOP_SURAT)
      : { config: DEFAULT_KOP_SURAT };
    const reportingPortal = parsed.reportingPortal
      ? sanitizeReportingPortal(parsed.reportingPortal, DEFAULT_REPORTING_PORTAL)
      : DEFAULT_REPORTING_PORTAL;
    const gtkList = Array.isArray(parsed.gtkList)
      ? parsed.gtkList.map(applyDispendukcapilCheck)
      : loadInitialGtkSeeds();
    const rombels = Array.isArray(parsed.rombels)
      ? sortRombelsNaturally(parsed.rombels.map((r) => normalizeRombelRecord(r, gtkList)))
      : loadInitialRombelSeeds(gtkList);
    const students = Array.isArray(parsed.students)
      ? parsed.students.filter((s) => !isLegacyDummyStudent(s))
      : seeds.students;
    const requests = Array.isArray(parsed.requests)
      ? parsed.requests.filter((r) => r && !LEGACY_DUMMY_REQUEST_IDS.has(r.id))
      : seeds.requests;
    const agenda = Array.isArray(parsed.agenda)
      ? parsed.agenda.filter((a) => a && !LEGACY_DUMMY_AGENDA_IDS.has(a.id))
      : seeds.agenda;
    return {
      claimedToken: parsed.claimedToken ?? null,
      kopSurat: kopResult.config,
      reportingPortal,
      students,
      gtkList,
      rombels,
      requests,
      agenda,
    };
  } catch {
    const seeds = loadInitialSeeds();
    const gtkList = loadInitialGtkSeeds();
    return {
      claimedToken: null,
      kopSurat: DEFAULT_KOP_SURAT,
      reportingPortal: DEFAULT_REPORTING_PORTAL,
      students: seeds.students,
      gtkList,
      rombels: loadInitialRombelSeeds(gtkList),
      requests: seeds.requests,
      agenda: seeds.agenda,
    };
  }
}

function writeStore(store: ServerStore): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function hashTokenScrypt(token: string, salt?: string): { salt: string; hash: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(token, usedSalt, 64).toString('hex');
  return { salt: usedSalt, hash: derived };
}

function verifyClaimedToken(inputToken: string, record: ClaimedTokenRecord): boolean {
  const { hash } = hashTokenScrypt(inputToken, record.salt);
  const bufA = Buffer.from(hash, 'hex');
  const bufB = Buffer.from(record.hash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyEnvToken(inputToken: string, envToken: string): boolean {
  const digestA = crypto.createHash('sha256').update(inputToken).digest();
  const digestB = crypto.createHash('sha256').update(envToken).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function signSessionToken(): string {
  const payload: SessionPayload = {
    jti: crypto.randomUUID(),
    role: 'petugas',
    staffName: 'Sulistyowati, S.Pd.',
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(authHeader: string | undefined): SessionPayload | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice(7).trim();
  const parts = rawToken.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (payload.role !== 'petugas' || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null;
    }
    if (revokedSessionIds.has(payload.jti)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function maskIdentityNumber(idNum: string): string {
  const trimmed = idNum.trim();
  if (trimmed.length <= 4) return '****';
  return `${'*'.repeat(Math.max(trimmed.length - 4, 4))}${trimmed.slice(-4)}`;
}

function sanitizeParticipants(raw: unknown): RequestParticipant[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const cleaned = raw
    .filter((item): item is Partial<RequestParticipant> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => ({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `part-${Date.now()}-${idx}`,
      nama: typeof item.nama === 'string' ? item.nama.trim().slice(0, 160) : '',
      identityNumber:
        typeof item.identityNumber === 'string' ? item.identityNumber.trim().slice(0, 40) : '',
      classOrCohort:
        typeof item.classOrCohort === 'string' ? item.classOrCohort.trim().slice(0, 120) : '-',
      roleLabel: typeof item.roleLabel === 'string' ? item.roleLabel.trim().slice(0, 80) : '',
    }))
    .filter((item) => item.nama.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

function toPublicRequest(req: ServiceRequest): ServiceRequest {
  return {
    ...req,
    identityNumber: maskIdentityNumber(req.identityNumber),
    participants: Array.isArray(req.participants)
      ? req.participants.map((p) => ({
          ...p,
          identityNumber: maskIdentityNumber(p.identityNumber),
        }))
      : undefined,
    phone: '',
    notes: '',
    submittedRequirements: [],
  };
}

function requirePetugasAuth(req: Request, res: Response, next: NextFunction): void {
  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    res.status(401).json({
      error: 'Akses ditolak. Masuk menggunakan Token Petugas TU terlebih dahulu.',
    });
    return;
  }
  res.locals.petugas = session;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Auth status
  app.get('/api/tu-auth/status', (req: Request, res: Response) => {
    const store = readStore();
    const envToken = (process.env.TU_ACCESS_TOKEN || '').trim();
    const hasEnvToken = envToken.length > 0;
    const hasClaimedToken = store.claimedToken !== null;
    const session = verifySessionToken(req.headers.authorization);

    res.json({
      isConfigured: hasEnvToken || hasClaimedToken,
      hasEnvToken,
      hasClaimedToken,
      authenticated: session !== null,
      staffName: session?.staffName ?? null,
    });
  });

  // First-run token claim (only when env token is unset and no claimed token exists)
  app.post('/api/tu-auth/claim', (req: Request, res: Response) => {
    const envToken = (process.env.TU_ACCESS_TOKEN || '').trim();
    const store = readStore();

    if (envToken.length > 0 || store.claimedToken !== null) {
      res.status(409).json({
        error: 'Token Petugas TU sudah ditetapkan sebelumnya. Gunakan formulir verifikasi token.',
      });
      return;
    }

    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (token.length < 6 || token.length > 128) {
      res.status(400).json({
        error: 'Token Petugas TU harus terdiri dari 6 hingga 128 karakter.',
      });
      return;
    }

    const hashed = hashTokenScrypt(token);
    store.claimedToken = {
      salt: hashed.salt,
      hash: hashed.hash,
      claimedAt: new Date().toISOString(),
    };
    writeStore(store);

    const sessionToken = signSessionToken();
    res.status(201).json({
      sessionToken,
      staffName: 'Sulistyowati, S.Pd.',
    });
  });

  // Token verification login
  app.post('/api/tu-auth/login', (req: Request, res: Response) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      res.status(400).json({ error: 'Token masuk Petugas TU wajib diisi.' });
      return;
    }

    const envToken = (process.env.TU_ACCESS_TOKEN || '').trim();
    const store = readStore();

    if (envToken.length > 0) {
      if (!verifyEnvToken(token, envToken)) {
        res.status(401).json({ error: 'Token masuk Petugas TU tidak sesuai.' });
        return;
      }
    } else if (store.claimedToken) {
      if (!verifyClaimedToken(token, store.claimedToken)) {
        res.status(401).json({ error: 'Token masuk Petugas TU tidak sesuai.' });
        return;
      }
    } else {
      res.status(403).json({
        error: 'Token Petugas TU belum diaktivasi. Tetapkan token aktivasi terlebih dahulu.',
      });
      return;
    }

    const sessionToken = signSessionToken();
    res.json({
      sessionToken,
      staffName: 'Sulistyowati, S.Pd.',
    });
  });

  // Change token (only when authenticated and not overridden by env var)
  app.post('/api/tu-auth/change-token', requirePetugasAuth, (req: Request, res: Response) => {
    const envToken = (process.env.TU_ACCESS_TOKEN || '').trim();
    if (envToken.length > 0) {
      res.status(409).json({
        error: 'Token Petugas TU dikunci oleh konfigurasi lingkungan server (TU_ACCESS_TOKEN).',
      });
      return;
    }

    const currentToken =
      typeof req.body?.currentToken === 'string' ? req.body.currentToken.trim() : '';
    const newToken = typeof req.body?.newToken === 'string' ? req.body.newToken.trim() : '';

    if (newToken.length < 6 || newToken.length > 128) {
      res.status(400).json({ error: 'Token baru harus terdiri dari 6 hingga 128 karakter.' });
      return;
    }

    const store = readStore();
    if (store.claimedToken && !verifyClaimedToken(currentToken, store.claimedToken)) {
      res.status(401).json({ error: 'Token lama tidak sesuai.' });
      return;
    }

    const hashed = hashTokenScrypt(newToken);
    store.claimedToken = {
      salt: hashed.salt,
      hash: hashed.hash,
      claimedAt: new Date().toISOString(),
    };
    writeStore(store);

    res.json({ ok: true });
  });

  app.post('/api/tu-auth/logout', (req: Request, res: Response) => {
    const session = verifySessionToken(req.headers.authorization);
    if (session) {
      revokedSessionIds.add(session.jti);
    }
    res.json({ ok: true });
  });

  // Controlled Public Dapodik Lookup (returns non-sensitive letter-form fields only; never NIK/KK/NPWP/Ibu)
  app.get('/api/dapodik/lookup-student', (req: Request, res: Response) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const digitsOnly = rawQ.replace(/\D/g, '');
    const normalizedQ = rawQ.toLowerCase();
    if (rawQ.length < 4) {
      res.json({ found: false, student: null });
      return;
    }

    const store = readStore();
    const matched = store.students.find((s) => {
      const nisn = String(s.nisn ?? '').trim();
      const nipd = String(s.nipd ?? '').trim();
      if (digitsOnly.length >= 4) {
        if (nisn && nisn.replace(/\D/g, '') === digitsOnly) return true;
        if (nipd && nipd.replace(/\D/g, '') === digitsOnly) return true;
      }
      return (
        (nisn && nisn.toLowerCase() === normalizedQ) ||
        (nipd && nipd.toLowerCase() === normalizedQ)
      );
    });

    if (!matched) {
      res.json({ found: false, student: null });
      return;
    }

    res.json({
      found: true,
      student: {
        id: matched.id,
        nama: matched.nama,
        nipd: matched.nipd,
        nisn: matched.nisn,
        jk: matched.jk,
        tempatLahir: matched.tempatLahir,
        tanggalLahir: matched.tanggalLahir,
        rombelSaatIni: matched.rombelSaatIni,
        tingkatKelas: matched.tingkatKelas,
        statusSiswa: matched.statusSiswa,
        hp: matched.hp || matched.telepon || '',
      },
    });
  });

  app.get('/api/dapodik/lookup-gtk', (req: Request, res: Response) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (rawQ.length < 3) {
      res.json({ found: false, exact: false, gtk: null, candidates: [] });
      return;
    }

    const digitsOnly = rawQ.replace(/\D/g, '');
    const normalizedQ = rawQ.replace(/\s+/g, ' ').toLowerCase();
    const store = readStore();

    const toPublicGtk = (g: DapodikGtk) => ({
      id: g.id,
      nama: g.nama,
      displayName: formatPtkDisplayName(g),
      gelarDepan: g.gelarDepan ?? '',
      gelarBelakang: g.gelarBelakang ?? '',
      nip: g.nip,
      nuptk: g.nuptk,
      jenisPtk: g.jenisPtk,
      jabatanPtk: g.jabatanPtk ?? '',
      tugasTambahan: g.tugasTambahan,
      statusKepegawaian: g.statusKepegawaian,
      dukcapilStatus: g.dukcapilStatus,
      hp: g.hp,
      fotoDataUrl: g.fotoDataUrl ?? '',
    });

    const exactMatch = store.gtkList.find((g) => {
      const nipDigits = String(g.nip ?? '').replace(/\D/g, '');
      const nuptkDigits = String(g.nuptk ?? '').replace(/\D/g, '');
      const bareName = String(g.nama ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
      const fullDisplay = formatPtkDisplayName(g).trim().replace(/\s+/g, ' ').toLowerCase();
      if (digitsOnly.length >= 8) {
        if (nipDigits && nipDigits === digitsOnly) return true;
        if (nuptkDigits && nuptkDigits === digitsOnly) return true;
      }
      return bareName === normalizedQ || fullDisplay === normalizedQ;
    });

    if (exactMatch) {
      const pub = toPublicGtk(exactMatch);
      res.json({ found: true, exact: true, gtk: pub, candidates: [pub] });
      return;
    }

    const candidates = store.gtkList
      .filter((g) => {
        const nipDigits = String(g.nip ?? '').replace(/\D/g, '');
        const nuptkDigits = String(g.nuptk ?? '').replace(/\D/g, '');
        const bareName = String(g.nama ?? '').toLowerCase();
        const fullDisplay = formatPtkDisplayName(g).toLowerCase();
        if (digitsOnly.length >= 6) {
          if (nipDigits.includes(digitsOnly) || nuptkDigits.includes(digitsOnly)) return true;
        }
        return bareName.includes(normalizedQ) || fullDisplay.includes(normalizedQ);
      })
      .slice(0, 6)
      .map(toPublicGtk);

    res.json({
      found: candidates.length > 0,
      exact: false,
      gtk: candidates.length === 1 && digitsOnly.length >= 8 ? candidates[0] : null,
      candidates,
    });
  });

  // Public Pemohon Routes (masked PII, no student database access)
  app.get('/api/requests/public', (_req: Request, res: Response) => {
    const store = readStore();
    res.json(store.requests.map(toPublicRequest));
  });

  app.get('/api/requests/track', (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const qDigits = q.replace(/\D/g, '');
    if (!q) {
      res.status(400).json({ error: 'Parameter pencarian wajib diisi.' });
      return;
    }
    const store = readStore();
    const matches = store.requests
      .filter((item) => {
        if (item.id.toLowerCase() === q) return true;
        const idNorm = item.identityNumber.trim().toLowerCase();
        if (idNorm === q) return true;
        if (qDigits.length >= 4 && item.identityNumber.replace(/\D/g, '') === qDigits) {
          return true;
        }
        if (Array.isArray(item.participants)) {
          return item.participants.some((p) => {
            const pId = p.identityNumber.trim().toLowerCase();
            if (pId === q) return true;
            if (qDigits.length >= 4 && p.identityNumber.replace(/\D/g, '') === qDigits) return true;
            return false;
          });
        }
        return false;
      })
      .map(toPublicRequest);
    res.json(matches);
  });

  app.post('/api/requests', (req: Request, res: Response) => {
    try {
      const store = readStore();
      const petugasSession = verifySessionToken(req.headers.authorization);
      if (!store.reportingPortal.isOpen && !petugasSession) {
        res.status(403).json({
          error:
            store.reportingPortal.closedMessage ||
            'Pelayanan pelaporan/permohonan daring sedang ditutup sementara.',
        });
        return;
      }

      const body = req.body as Partial<ServiceRequest>;
      if (
        typeof body?.applicantName !== 'string' ||
        !body.applicantName.trim() ||
        typeof body?.identityNumber !== 'string' ||
        !body.identityNumber.trim() ||
        typeof body?.phone !== 'string' ||
        !body.phone.trim() ||
        typeof body?.purpose !== 'string' ||
        !body.purpose.trim() ||
        typeof body?.serviceId !== 'string' ||
        !body.serviceId.trim() ||
        typeof body?.serviceTitle !== 'string' ||
        !body.serviceTitle.trim()
      ) {
        res.status(400).json({ error: 'Data pengajuan permohonan tidak lengkap.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const maxSeq = store.requests.reduce((max, item) => {
        const match = /^TU-\d{4}-(\d+)$/i.exec(String(item.id || '').trim());
        const num = match ? Number(match[1]) : 0;
        return Number.isFinite(num) && num > max ? num : max;
      }, 0);
      const nextNumber = maxSeq + 1;
      const ticketId = `TU-2026-${String(nextNumber).padStart(4, '0')}`;

      const participants = sanitizeParticipants(body.participants);

      const newReq: ServiceRequest = {
        id: ticketId,
        serviceId: body.serviceId,
        serviceTitle: body.serviceTitle.trim(),
        applicantName: body.applicantName.trim(),
        applicantRole: body.applicantRole || 'Siswa',
        identityNumber: body.identityNumber.trim(),
        classOrCohort: (body.classOrCohort || '-').trim() || '-',
        phone: body.phone.trim(),
        purpose: body.purpose.trim(),
        notes: (body.notes || '').trim(),
        participants,
        submittedRequirements: Array.isArray(body.submittedRequirements)
          ? body.submittedRequirements.filter((x): x is string => typeof x === 'string')
          : [],
        status: 'Diajukan',
        assignedStaff: 'Sulistyowati, S.Pd.',
        createdAt: nowIso,
        updatedAt: nowIso,
        estimatedReadyAt:
          typeof body.estimatedReadyAt === 'string' && body.estimatedReadyAt
            ? body.estimatedReadyAt
            : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        timeline: [
          {
            id: `tl-${Date.now()}`,
            timestamp: nowIso,
            status: 'Diajukan',
            actor: body.applicantName.trim(),
            note: `Permohonan ${body.serviceTitle.trim()}${
              participants && participants.length > 1 ? ` (${participants.length} peserta)` : ''
            } diajukan secara daring melalui SIP TU SMAN 9 Surabaya.`,
          },
        ],
      };

      store.requests.unshift(newReq);
      writeStore(store);

      res.status(201).json(petugasSession ? newReq : toPublicRequest(newReq));
    } catch (err) {
      console.error('Failed to persist service request:', err);
      res.status(500).json({
        error: 'Terjadi kesalahan saat menyimpan permohonan ke sistem Tata Usaha. Silakan coba lagi.',
      });
    }
  });

  // Protected Petugas TU Routes
  app.get('/api/requests', requirePetugasAuth, (_req: Request, res: Response) => {
    const store = readStore();
    res.json(store.requests);
  });

  app.patch('/api/requests/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const { newStatus, letterNumber, staffNote, addToAgenda } = req.body as {
      newStatus?: ServiceRequest['status'];
      letterNumber?: string;
      staffNote?: string;
      addToAgenda?: boolean;
    };

    if (!newStatus) {
      res.status(400).json({ error: 'Status baru wajib dipilih.' });
      return;
    }

    const store = readStore();
    const targetIdx = store.requests.findIndex((r) => r.id === id);
    if (targetIdx < 0) {
      res.status(404).json({ error: 'Tiket permohonan tidak ditemukan.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = store.requests[targetIdx];
    const noteText =
      (typeof staffNote === 'string' && staffNote.trim()) ||
      `Status permohonan diperbarui menjadi "${newStatus}" oleh Petugas Tata Usaha.`;

    const updated: ServiceRequest = {
      ...existing,
      status: newStatus,
      letterNumber:
        typeof letterNumber === 'string' && letterNumber.trim()
          ? letterNumber.trim()
          : existing.letterNumber,
      updatedAt: nowIso,
      revisionNote: newStatus === 'Perlu Perbaikan' ? noteText : existing.revisionNote,
      timeline: [
        ...existing.timeline,
        {
          id: `tl-${Date.now()}`,
          timestamp: nowIso,
          status: newStatus,
          actor: 'Sulistyowati, S.Pd.',
          note: noteText,
        },
      ],
    };

    store.requests[targetIdx] = updated;

    let createdAgenda: AgendaEntry | null = null;
    if (addToAgenda) {
      const outCount = store.agenda.filter((e) => e.type === 'Surat Keluar').length + 221;
      createdAgenda = {
        id: `ag-${Date.now()}`,
        type: 'Surat Keluar',
        agendaNumber: `SK/2026/${String(outCount).padStart(4, '0')}`,
        letterNumber:
          updated.letterNumber || `421.3/${outCount}/101.6.1.9/2026`,
        letterDate: nowIso.slice(0, 10),
        recordedDate: nowIso.slice(0, 10),
        counterparty:
          updated.participants && updated.participants.length > 1
            ? `${updated.applicantName} dkk (${updated.participants.length} orang)`
            : `${updated.applicantName} (${updated.classOrCohort})`,
        subject: `${updated.serviceTitle} — ${updated.purpose}`,
        classification: 'Biasa',
        disposition: 'Tercatat otomatis dari pelayanan tiket SIP TU.',
        relatedTicketId: updated.id,
      };
      store.agenda.unshift(createdAgenda);
    }

    writeStore(store);
    res.json({ request: updated, createdAgenda });
  });

  app.put('/api/requests/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as Partial<ServiceRequest>;
    if (
      typeof body?.applicantName !== 'string' ||
      !body.applicantName.trim() ||
      typeof body?.identityNumber !== 'string' ||
      !body.identityNumber.trim() ||
      typeof body?.purpose !== 'string' ||
      !body.purpose.trim()
    ) {
      res.status(400).json({ error: 'Nama pemohon, NISN/NIP, dan keperluan wajib diisi.' });
      return;
    }

    const store = readStore();
    const idx = store.requests.findIndex((r) => r.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Tiket permohonan tidak ditemukan.' });
      return;
    }

    const existing = store.requests[idx];
    const nowIso = new Date().toISOString();
    const participants = sanitizeParticipants(body.participants);

    const updated: ServiceRequest = {
      ...existing,
      serviceId: body.serviceId || existing.serviceId,
      serviceTitle:
        typeof body.serviceTitle === 'string' && body.serviceTitle.trim()
          ? body.serviceTitle.trim()
          : existing.serviceTitle,
      applicantName: body.applicantName.trim(),
      applicantRole: body.applicantRole || existing.applicantRole,
      identityNumber: body.identityNumber.trim(),
      classOrCohort:
        typeof body.classOrCohort === 'string' && body.classOrCohort.trim()
          ? body.classOrCohort.trim()
          : '-',
      phone:
        typeof body.phone === 'string' && body.phone.trim()
          ? body.phone.trim()
          : existing.phone,
      purpose: body.purpose.trim(),
      notes: typeof body.notes === 'string' ? body.notes.trim() : existing.notes,
      participants,
      updatedAt: nowIso,
      timeline: [
        ...existing.timeline,
        {
          id: `tl-${Date.now()}`,
          timestamp: nowIso,
          status: existing.status,
          actor: (res.locals.petugas as SessionPayload | undefined)?.staffName || 'Sulistyowati, S.Pd.',
          note: 'Data ajuan permohonan disunting oleh Petugas Tata Usaha.',
        },
      ],
    };

    store.requests[idx] = updated;
    writeStore(store);
    res.json({ request: updated });
  });

  app.delete('/api/requests/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const store = readStore();
    const exists = store.requests.some((r) => r.id === id);
    if (!exists) {
      res.status(404).json({ error: 'Tiket permohonan tidak ditemukan.' });
      return;
    }
    store.requests = store.requests.filter((r) => r.id !== id);
    writeStore(store);
    res.json({ ok: true, id });
  });

  // Protected Dapodik Student Database Routes
  app.get('/api/students', requirePetugasAuth, (_req: Request, res: Response) => {
    const store = readStore();
    res.json(store.students);
  });

  app.post('/api/students', requirePetugasAuth, (req: Request, res: Response) => {
    const student = req.body as DapodikStudent;
    if (!student || typeof student.nama !== 'string' || !student.nama.trim()) {
      res.status(400).json({ error: 'Nama peserta didik wajib diisi.' });
      return;
    }

    const store = readStore();
    const record: DapodikStudent = {
      ...student,
      id: `pd-${Date.now()}`,
      vervalPdSyncAt: new Date().toISOString(),
    };
    store.students.unshift(record);
    writeStore(store);
    res.status(201).json(record);
  });

  app.put('/api/students/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const incoming = req.body as DapodikStudent;
    const store = readStore();
    const idx = store.students.findIndex((s) => s.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Data siswa tidak ditemukan.' });
      return;
    }
    const updated: DapodikStudent = {
      ...incoming,
      id,
      vervalPdSyncAt: new Date().toISOString(),
    };
    store.students[idx] = updated;
    writeStore(store);
    res.json(updated);
  });

  app.delete('/api/students/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const store = readStore();
    store.students = store.students.filter((s) => s.id !== id);
    writeStore(store);
    res.json({ ok: true });
  });

  app.post('/api/students/import', requirePetugasAuth, (req: Request, res: Response) => {
    const { students: incomingList, mode } = req.body as {
      students?: DapodikStudent[];
      mode?: 'upsert' | 'append' | 'replace';
    };
    if (!Array.isArray(incomingList)) {
      res.status(400).json({ error: 'Daftar data siswa tidak valid.' });
      return;
    }

    const store = readStore();
    let addedCount = 0;
    let updatedCount = 0;

    if (mode === 'replace') {
      store.students = incomingList;
      addedCount = incomingList.length;
    } else if (mode === 'append') {
      store.students = [...incomingList, ...store.students];
      addedCount = incomingList.length;
    } else {
      for (const incoming of incomingList) {
        const matchIdx = store.students.findIndex(
          (existing) =>
            (incoming.nisn && existing.nisn === incoming.nisn) ||
            (incoming.nipd && existing.nipd === incoming.nipd)
        );
        if (matchIdx >= 0) {
          store.students[matchIdx] = {
            ...store.students[matchIdx],
            ...incoming,
            id: store.students[matchIdx].id,
          };
          updatedCount++;
        } else {
          store.students.unshift(incoming);
          addedCount++;
        }
      }
    }

    writeStore(store);
    res.json({
      students: store.students,
      addedCount,
      updatedCount,
    });
  });

  // Protected Agenda Surat Routes
  app.get('/api/agenda', requirePetugasAuth, (_req: Request, res: Response) => {
    const store = readStore();
    res.json(store.agenda);
  });

  app.post('/api/agenda', requirePetugasAuth, (req: Request, res: Response) => {
    const entry = req.body as AgendaEntry;
    if (!entry || typeof entry.subject !== 'string' || !entry.letterNumber) {
      res.status(400).json({ error: 'Data agenda surat tidak lengkap.' });
      return;
    }
    const store = readStore();
    const saved: AgendaEntry = {
      ...entry,
      id: entry.id || `ag-${Date.now()}`,
    };
    store.agenda.unshift(saved);
    writeStore(store);
    res.status(201).json(saved);
  });

  app.delete('/api/agenda/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const store = readStore();
    store.agenda = store.agenda.filter((item) => item.id !== id);
    writeStore(store);
    res.json({ ok: true });
  });

  // Kop Surat Config Routes (GET public for printed receipts/letters; PUT protected)
  app.get('/api/kop-surat', (_req: Request, res: Response) => {
    const store = readStore();
    res.json(store.kopSurat);
  });

  app.put('/api/kop-surat', requirePetugasAuth, (req: Request, res: Response) => {
    const { config, error } = sanitizeKopSurat(req.body, DEFAULT_KOP_SURAT);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const store = readStore();
    store.kopSurat = config;
    writeStore(store);
    res.json(store.kopSurat);
  });

  // Reporting Open/Close Portal Routes (GET public; PUT protected)
  app.get('/api/reporting-status', (_req: Request, res: Response) => {
    const store = readStore();
    res.json(store.reportingPortal);
  });

  app.put('/api/reporting-status', requirePetugasAuth, (req: Request, res: Response) => {
    const store = readStore();
    const staffName = (res.locals.petugas as SessionPayload | undefined)?.staffName || 'Sulistyowati, S.Pd.';
    const updated = sanitizeReportingPortal(
      {
        ...(req.body as Partial<ReportingPortalConfig>),
        updatedAt: new Date().toISOString(),
        updatedBy: staffName,
      },
      store.reportingPortal
    );
    store.reportingPortal = updated;
    writeStore(store);
    res.json(store.reportingPortal);
  });

  // Protected GTK Dapodik + Dispendukcapil NIK Matching Routes
  app.get('/api/gtk', requirePetugasAuth, (_req: Request, res: Response) => {
    const store = readStore();
    res.json(store.gtkList);
  });

  app.post('/api/gtk', requirePetugasAuth, (req: Request, res: Response) => {
    const incoming = req.body as DapodikGtk;
    if (!incoming || typeof incoming.nama !== 'string' || !incoming.nama.trim()) {
      res.status(400).json({ error: 'Nama PTK wajib diisi.' });
      return;
    }
    if (!isSafeRasterImageDataUrl(incoming.fotoDataUrl ?? '')) {
      res.status(400).json({ error: 'Format foto PTK tidak valid atau melebihi batas ukuran.' });
      return;
    }
    const store = readStore();
    const checked = applyDispendukcapilCheck({
      ...incoming,
      fotoDataUrl: incoming.fotoDataUrl ?? '',
      id: `gtk-${Date.now()}`,
    });
    store.gtkList.unshift(checked);
    writeStore(store);
    res.status(201).json(checked);
  });

  app.put('/api/gtk/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const incoming = req.body as DapodikGtk;
    if (!isSafeRasterImageDataUrl(incoming?.fotoDataUrl ?? '')) {
      res.status(400).json({ error: 'Format foto PTK tidak valid atau melebihi batas ukuran.' });
      return;
    }
    const store = readStore();
    const idx = store.gtkList.findIndex((g) => g.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Data PTK tidak ditemukan.' });
      return;
    }
    const checked = applyDispendukcapilCheck({
      ...incoming,
      fotoDataUrl: incoming.fotoDataUrl ?? '',
      id,
    });
    store.gtkList[idx] = checked;
    writeStore(store);
    res.json(checked);
  });

  app.delete('/api/gtk/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const store = readStore();
    store.gtkList = store.gtkList.filter((g) => g.id !== id);
    writeStore(store);
    res.json({ ok: true });
  });

  app.post('/api/gtk/import', requirePetugasAuth, (req: Request, res: Response) => {
    const { gtkList: incomingList, mode } = req.body as {
      gtkList?: DapodikGtk[];
      mode?: 'upsert' | 'append' | 'replace';
    };
    if (!Array.isArray(incomingList)) {
      res.status(400).json({ error: 'Daftar data GTK tidak valid.' });
      return;
    }
    const store = readStore();
    let addedCount = 0;
    let updatedCount = 0;
    const checkedIncoming = incomingList.map((g, idx) =>
      applyDispendukcapilCheck({
        ...g,
        fotoDataUrl: isSafeRasterImageDataUrl(g.fotoDataUrl ?? '') ? (g.fotoDataUrl ?? '') : '',
        id: g.id || `gtk-imp-${Date.now()}-${idx}`,
      })
    );

    if (mode === 'replace') {
      store.gtkList = checkedIncoming;
      addedCount = checkedIncoming.length;
    } else if (mode === 'append') {
      store.gtkList = [...checkedIncoming, ...store.gtkList];
      addedCount = checkedIncoming.length;
    } else {
      for (const incoming of checkedIncoming) {
        const matchIdx = store.gtkList.findIndex(
          (existing) =>
            (incoming.nik && existing.nik === incoming.nik) ||
            (incoming.nip && existing.nip === incoming.nip) ||
            (incoming.nuptk && existing.nuptk === incoming.nuptk)
        );
        if (matchIdx >= 0) {
          store.gtkList[matchIdx] = applyDispendukcapilCheck({
            ...store.gtkList[matchIdx],
            ...incoming,
            fotoDataUrl: incoming.fotoDataUrl || store.gtkList[matchIdx].fotoDataUrl || '',
            id: store.gtkList[matchIdx].id,
          });
          updatedCount++;
        } else {
          store.gtkList.unshift(incoming);
          addedCount++;
        }
      }
    }

    writeStore(store);
    res.json({
      gtkList: store.gtkList,
      addedCount,
      updatedCount,
    });
  });

  app.post('/api/gtk/padan-dispendukcapil', requirePetugasAuth, (_req: Request, res: Response) => {
    const store = readStore();
    store.gtkList = store.gtkList.map(applyDispendukcapilCheck);
    writeStore(store);
    res.json({
      gtkList: store.gtkList,
      padanCount: store.gtkList.filter((g) => g.dukcapilStatus === 'Padan Dispendukcapil').length,
      residuCount: store.gtkList.filter((g) => g.dukcapilStatus === 'Residu Data').length,
      invalidCount: store.gtkList.filter((g) => g.dukcapilStatus === 'Tidak Padan NIK').length,
    });
  });

  // Public Rombel lookup (class codes only, no staff PII)
  app.get('/api/rombel/public', (_req: Request, res: Response) => {
    const store = readStore();
    res.json(
      store.rombels.map((r) => ({
        id: r.id,
        namaRombel: r.namaRombel,
        tingkatKelas: r.tingkatKelas,
        ruangan: r.ruangan,
      }))
    );
  });

  // Protected Rombongan Belajar & Wali Kelas Settings Routes
  app.get('/api/rombel', requirePetugasAuth, (_req: Request, res: Response) => {
    const store = readStore();
    res.json(store.rombels);
  });

  app.post('/api/rombel', requirePetugasAuth, (req: Request, res: Response) => {
    const incoming = req.body as DapodikRombel;
    if (!incoming || typeof incoming.namaRombel !== 'string' || !incoming.namaRombel.trim()) {
      res.status(400).json({ error: 'Nama rombel wajib diisi.' });
      return;
    }
    const store = readStore();
    const created = normalizeRombelRecord(
      {
        ...incoming,
        id: `rombel-${Date.now()}`,
        updatedAt: new Date().toISOString(),
      },
      store.gtkList
    );
    store.rombels = sortRombelsNaturally([...store.rombels, created]);
    writeStore(store);
    res.status(201).json(created);
  });

  app.put('/api/rombel/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const incoming = req.body as DapodikRombel;
    if (!incoming || typeof incoming.namaRombel !== 'string' || !incoming.namaRombel.trim()) {
      res.status(400).json({ error: 'Nama rombel wajib diisi.' });
      return;
    }
    const store = readStore();
    const idx = store.rombels.findIndex((r) => r.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Data rombel tidak ditemukan.' });
      return;
    }
    const updated = normalizeRombelRecord(
      {
        ...store.rombels[idx],
        ...incoming,
        id,
        updatedAt: new Date().toISOString(),
      },
      store.gtkList
    );
    store.rombels[idx] = updated;
    store.rombels = sortRombelsNaturally(store.rombels);
    writeStore(store);
    res.json(updated);
  });

  app.delete('/api/rombel/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const store = readStore();
    store.rombels = store.rombels.filter((r) => r.id !== id);
    writeStore(store);
    res.json({ ok: true });
  });

  app.post('/api/rombel/import', requirePetugasAuth, (req: Request, res: Response) => {
    const { rombels: incomingList, mode } = req.body as {
      rombels?: DapodikRombel[];
      mode?: 'upsert' | 'append' | 'replace';
    };
    if (!Array.isArray(incomingList)) {
      res.status(400).json({ error: 'Daftar rombongan belajar tidak valid.' });
      return;
    }
    const store = readStore();
    let addedCount = 0;
    let updatedCount = 0;

    const normalizedIncoming = incomingList
      .filter((r) => r && typeof r.namaRombel === 'string' && r.namaRombel.trim())
      .map((r, idx) =>
        normalizeRombelRecord(
          {
            ...r,
            id: r.id || `rombel-imp-${Date.now()}-${idx}`,
          },
          store.gtkList
        )
      );

    if (mode === 'replace') {
      store.rombels = sortRombelsNaturally(normalizedIncoming);
      addedCount = normalizedIncoming.length;
    } else if (mode === 'append') {
      store.rombels = sortRombelsNaturally([...store.rombels, ...normalizedIncoming]);
      addedCount = normalizedIncoming.length;
    } else {
      for (const incoming of normalizedIncoming) {
        const matchIdx = store.rombels.findIndex(
          (existing) => existing.namaRombel.toUpperCase() === incoming.namaRombel.toUpperCase()
        );
        if (matchIdx >= 0) {
          store.rombels[matchIdx] = normalizeRombelRecord(
            {
              ...store.rombels[matchIdx],
              ...incoming,
              id: store.rombels[matchIdx].id,
              updatedAt: new Date().toISOString(),
            },
            store.gtkList
          );
          updatedCount++;
        } else {
          store.rombels.push(incoming);
          addedCount++;
        }
      }
      store.rombels = sortRombelsNaturally(store.rombels);
    }

    writeStore(store);
    res.json({
      rombels: store.rombels,
      addedCount,
      updatedCount,
    });
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIP TU SMAN 9 Surabaya server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
