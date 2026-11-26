import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  buildBackupBundle,
  type ClaimedTokenRecord,
  type DeduplicateRepoTarget,
  deduplicateRepository,
  DEFAULT_BACKUP_SETTINGS,
  DEFAULT_KOP_SURAT,
  DEFAULT_REPORTING_PORTAL,
  DEFAULT_TU_STAFF,
  ensureRepositoriesInitialized,
  getRepositoryStatuses,
  isSafeRasterImageDataUrl,
  isValidEmailAddress,
  readAgendaRepository,
  readClaimedToken,
  readGtkRepository,
  readRequestsRepository,
  readRombelsRepository,
  readSettingsRepository,
  readStudentsRepository,
  restoreBackupBundle,
  sanitizeBackupSettings,
  sanitizeKopSurat,
  sanitizeReportingPortal,
  sanitizeTuStaffConfig,
  toPublicTuStaffInfo,
  writeAgendaRepository,
  writeClaimedToken,
  writeGtkRepository,
  writeRequestsRepository,
  writeRombelsRepository,
  writeSettingsRepository,
  writeStudentsRepository,
} from './server/repositoryStore.ts';
import type {
  AgendaEntry,
  BackupRepositoryKey,
  BackupScopeKey,
  BackupSettingsConfig,
  DapodikGtk,
  DapodikRombel,
  DapodikStudent,
  ReportingPortalConfig,
  RequestParticipant,
  ServiceRequest,
  TuStaffConfig,
} from './src/types/tu.ts';
import { applyDispendukcapilCheck, formatPtkDisplayName } from './src/utils/gtkDapodikValidation.ts';
import { normalizeRombelRecord, sortRombelsNaturally } from './src/utils/rombelDapodikUtils.ts';

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface SessionPayload {
  jti: string;
  role: 'petugas';
  staffName: string;
  exp: number;
}

const revokedSessionIds = new Set<string>();

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

function resolveActiveStaffName(tuStaff?: TuStaffConfig): string {
  const cfg = tuStaff ?? readSettingsRepository().tuStaff;
  if (!cfg.isEnabled) {
    return 'Petugas TU (Nonaktif)';
  }
  return cfg.activeStaffName || 'Petugas Tata Usaha';
}

function signSessionToken(staffNameOverride?: string): string {
  const payload: SessionPayload = {
    jti: crypto.randomUUID(),
    role: 'petugas',
    staffName: staffNameOverride || resolveActiveStaffName(),
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
  ensureRepositoriesInitialized();

  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Auth status
  app.get('/api/tu-auth/status', (req: Request, res: Response) => {
    const claimedToken = readClaimedToken();
    const envToken = (process.env.TU_ACCESS_TOKEN || '').trim();
    const hasEnvToken = envToken.length > 0;
    const hasClaimedToken = claimedToken !== null;
    const session = verifySessionToken(req.headers.authorization);

    res.json({
      isConfigured: hasEnvToken || hasClaimedToken,
      hasEnvToken,
      hasClaimedToken,
      authenticated: session !== null,
      staffName: session ? resolveActiveStaffName() : null,
    });
  });

  // First-run token claim
  app.post('/api/tu-auth/claim', (req: Request, res: Response) => {
    const envToken = (process.env.TU_ACCESS_TOKEN || '').trim();
    const existingClaimed = readClaimedToken();

    if (envToken.length > 0 || existingClaimed !== null) {
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
    writeClaimedToken({
      salt: hashed.salt,
      hash: hashed.hash,
      claimedAt: new Date().toISOString(),
    });

    const activeName = resolveActiveStaffName();
    const sessionToken = signSessionToken(activeName);
    res.status(201).json({
      sessionToken,
      staffName: activeName,
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
    const claimedToken = readClaimedToken();

    if (envToken.length > 0) {
      if (!verifyEnvToken(token, envToken)) {
        res.status(401).json({ error: 'Token masuk Petugas TU tidak sesuai.' });
        return;
      }
    } else if (claimedToken) {
      if (!verifyClaimedToken(token, claimedToken)) {
        res.status(401).json({ error: 'Token masuk Petugas TU tidak sesuai.' });
        return;
      }
    } else {
      res.status(403).json({
        error: 'Token Petugas TU belum diaktivasi. Tetapkan token aktivasi terlebih dahulu.',
      });
      return;
    }

    const activeName = resolveActiveStaffName();
    const sessionToken = signSessionToken(activeName);
    res.json({
      sessionToken,
      staffName: activeName,
    });
  });

  // Change token
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

    const claimedToken = readClaimedToken();
    if (claimedToken && !verifyClaimedToken(currentToken, claimedToken)) {
      res.status(401).json({ error: 'Token lama tidak sesuai.' });
      return;
    }

    const hashed = hashTokenScrypt(newToken);
    writeClaimedToken({
      salt: hashed.salt,
      hash: hashed.hash,
      claimedAt: new Date().toISOString(),
    });

    res.json({ ok: true });
  });

  app.post('/api/tu-auth/logout', (req: Request, res: Response) => {
    const session = verifySessionToken(req.headers.authorization);
    if (session) {
      revokedSessionIds.add(session.jti);
    }
    res.json({ ok: true });
  });

  // Repository status summary (Protected Petugas TU)
  app.get('/api/repositories/status', requirePetugasAuth, (_req: Request, res: Response) => {
    res.json({
      repositories: getRepositoryStatuses(),
    });
  });

  // Controlled Public Dapodik Lookup
  app.get('/api/dapodik/lookup-student', (req: Request, res: Response) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const digitsOnly = rawQ.replace(/\D/g, '');
    const normalizedQ = rawQ.toLowerCase();
    if (rawQ.length < 4) {
      res.json({ found: false, student: null });
      return;
    }

    const students = readStudentsRepository();
    const matched = students.find((s) => {
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
    const gtkList = readGtkRepository();

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

    const exactMatch = gtkList.find((g) => {
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

    const candidates = gtkList
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

  // Public Pemohon Routes
  app.get('/api/requests/public', (_req: Request, res: Response) => {
    const requests = readRequestsRepository();
    res.json(requests.map(toPublicRequest));
  });

  app.get('/api/requests/track', (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const qDigits = q.replace(/\D/g, '');
    if (!q) {
      res.status(400).json({ error: 'Parameter pencarian wajib diisi.' });
      return;
    }
    const requests = readRequestsRepository();
    const matches = requests
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
      const settings = readSettingsRepository();
      const petugasSession = verifySessionToken(req.headers.authorization);
      if (!settings.reportingPortal.isOpen && !petugasSession) {
        res.status(403).json({
          error:
            settings.reportingPortal.closedMessage ||
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

      const requests = readRequestsRepository();
      const nowIso = new Date().toISOString();
      const maxSeq = requests.reduce((max, item) => {
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
        assignedStaff: settings.tuStaff.isEnabled
          ? settings.tuStaff.activeStaffName || 'Petugas Tata Usaha'
          : 'Menunggu Penugasan (Petugas TU Nonaktif)',
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

      requests.unshift(newReq);
      writeRequestsRepository(requests);

      res.status(201).json(petugasSession ? newReq : toPublicRequest(newReq));
    } catch (err) {
      console.error('Failed to persist service request:', err);
      res.status(500).json({
        error: 'Terjadi kesalahan saat menyimpan permohonan ke repositori Tata Usaha. Silakan coba lagi.',
      });
    }
  });

  // Protected Petugas TU Persuratan Routes
  app.get('/api/requests', requirePetugasAuth, (_req: Request, res: Response) => {
    res.json(readRequestsRepository());
  });

  app.patch('/api/requests/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const { newStatus, letterNumber, staffNote, addToAgenda, assignedStaff } = req.body as {
      newStatus?: ServiceRequest['status'];
      letterNumber?: string;
      staffNote?: string;
      addToAgenda?: boolean;
      assignedStaff?: string;
    };

    if (!newStatus) {
      res.status(400).json({ error: 'Status baru wajib dipilih.' });
      return;
    }

    const requests = readRequestsRepository();
    const targetIdx = requests.findIndex((r) => r.id === id);
    if (targetIdx < 0) {
      res.status(404).json({ error: 'Tiket permohonan tidak ditemukan.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = requests[targetIdx];
    const activeActor = resolveActiveStaffName();
    const noteText =
      (typeof staffNote === 'string' && staffNote.trim()) ||
      `Status permohonan diperbarui menjadi "${newStatus}" oleh Petugas Tata Usaha.`;

    const updated: ServiceRequest = {
      ...existing,
      status: newStatus,
      assignedStaff:
        typeof assignedStaff === 'string' && assignedStaff.trim()
          ? assignedStaff.trim().slice(0, 160)
          : existing.assignedStaff,
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
          actor: activeActor,
          note: noteText,
        },
      ],
    };

    requests[targetIdx] = updated;
    writeRequestsRepository(requests);

    let createdAgenda: AgendaEntry | null = null;
    if (addToAgenda) {
      const agenda = readAgendaRepository();
      const outCount = agenda.filter((e) => e.type === 'Surat Keluar').length + 221;
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
      agenda.unshift(createdAgenda);
      writeAgendaRepository(agenda);
    }

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

    const requests = readRequestsRepository();
    const idx = requests.findIndex((r) => r.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Tiket permohonan tidak ditemukan.' });
      return;
    }

    const existing = requests[idx];
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
      assignedStaff:
        typeof body.assignedStaff === 'string' && body.assignedStaff.trim()
          ? body.assignedStaff.trim().slice(0, 160)
          : existing.assignedStaff,
      participants,
      updatedAt: nowIso,
      timeline: [
        ...existing.timeline,
        {
          id: `tl-${Date.now()}`,
          timestamp: nowIso,
          status: existing.status,
          actor: resolveActiveStaffName(),
          note: 'Data ajuan permohonan disunting oleh Petugas Tata Usaha.',
        },
      ],
    };

    requests[idx] = updated;
    writeRequestsRepository(requests);
    res.json(updated);
  });

  app.delete('/api/requests/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const requests = readRequestsRepository();
    const exists = requests.some((r) => r.id === id);
    if (!exists) {
      res.status(404).json({ error: 'Tiket permohonan tidak ditemukan.' });
      return;
    }
    const nextRequests = requests.filter((r) => r.id !== id);
    writeRequestsRepository(nextRequests);
    res.json({ ok: true, id });
  });

  // Protected Dapodik Student Database Repository Routes
  app.get('/api/students', requirePetugasAuth, (_req: Request, res: Response) => {
    res.json(readStudentsRepository());
  });

  app.post('/api/students', requirePetugasAuth, (req: Request, res: Response) => {
    const student = req.body as DapodikStudent;
    if (!student || typeof student.nama !== 'string' || !student.nama.trim()) {
      res.status(400).json({ error: 'Nama peserta didik wajib diisi.' });
      return;
    }

    const students = readStudentsRepository();
    const record: DapodikStudent = {
      ...student,
      id: student.id?.trim() || `pd-${Date.now()}`,
      vervalPdSyncAt: new Date().toISOString(),
    };
    students.unshift(record);
    writeStudentsRepository(students);
    res.status(201).json(record);
  });

  app.put('/api/students/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const incoming = req.body as DapodikStudent;
    const students = readStudentsRepository();
    const idx = students.findIndex((s) => s.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Data siswa tidak ditemukan.' });
      return;
    }
    const updated: DapodikStudent = {
      ...incoming,
      id,
      vervalPdSyncAt: new Date().toISOString(),
    };
    students[idx] = updated;
    writeStudentsRepository(students);
    res.json(updated);
  });

  app.delete('/api/students/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const students = readStudentsRepository();
    writeStudentsRepository(students.filter((s) => s.id !== id));
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

    const nowIso = new Date().toISOString();
    const sanitizedIncoming = incomingList
      .filter((s): s is DapodikStudent => Boolean(s && typeof s.nama === 'string' && s.nama.trim()))
      .map((s, idx) => ({
        ...s,
        id: s.id?.trim() || `pd-imp-${Date.now()}-${idx}`,
        vervalPdSyncAt: s.vervalPdSyncAt || nowIso,
      }));

    let students = readStudentsRepository();
    let addedCount = 0;
    let updatedCount = 0;

    if (mode === 'replace') {
      students = sanitizedIncoming;
      addedCount = sanitizedIncoming.length;
    } else if (mode === 'append') {
      students = [...sanitizedIncoming, ...students];
      addedCount = sanitizedIncoming.length;
    } else {
      for (const incoming of sanitizedIncoming) {
        const matchIdx = students.findIndex(
          (existing) =>
            (incoming.nisn && existing.nisn === incoming.nisn) ||
            (incoming.nipd && existing.nipd === incoming.nipd)
        );
        if (matchIdx >= 0) {
          students[matchIdx] = {
            ...students[matchIdx],
            ...incoming,
            id: students[matchIdx].id,
            vervalPdSyncAt: nowIso,
          };
          updatedCount++;
        } else {
          students.unshift(incoming);
          addedCount++;
        }
      }
    }

    const envelope = writeStudentsRepository(students);
    res.json({
      students: envelope.data,
      addedCount,
      updatedCount,
      repositoryUpdatedAt: envelope.updatedAt,
    });
  });

  // Protected Agenda Surat Repository Routes
  app.get('/api/agenda', requirePetugasAuth, (_req: Request, res: Response) => {
    res.json(readAgendaRepository());
  });

  app.post('/api/agenda', requirePetugasAuth, (req: Request, res: Response) => {
    const entry = req.body as AgendaEntry;
    if (!entry || typeof entry.subject !== 'string' || !entry.letterNumber) {
      res.status(400).json({ error: 'Data agenda surat tidak lengkap.' });
      return;
    }
    const agenda = readAgendaRepository();
    const saved: AgendaEntry = {
      ...entry,
      id: entry.id || `ag-${Date.now()}`,
    };
    agenda.unshift(saved);
    writeAgendaRepository(agenda);
    res.status(201).json(saved);
  });

  app.delete('/api/agenda/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const agenda = readAgendaRepository();
    writeAgendaRepository(agenda.filter((item) => item.id !== id));
    res.json({ ok: true });
  });

  // Kop Surat & Reporting Portal Config Repository Routes
  app.get('/api/kop-surat', (_req: Request, res: Response) => {
    res.json(readSettingsRepository().kopSurat);
  });

  app.put('/api/kop-surat', requirePetugasAuth, (req: Request, res: Response) => {
    const { config, error } = sanitizeKopSurat(req.body, DEFAULT_KOP_SURAT);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const current = readSettingsRepository();
    writeSettingsRepository({ ...current, kopSurat: config });
    res.json(config);
  });

  app.get('/api/reporting-status', (_req: Request, res: Response) => {
    res.json(readSettingsRepository().reportingPortal);
  });

  app.put('/api/reporting-status', requirePetugasAuth, (req: Request, res: Response) => {
    const current = readSettingsRepository();
    const staffName = resolveActiveStaffName(current.tuStaff);
    const updated = sanitizeReportingPortal(
      {
        ...(req.body as Partial<ReportingPortalConfig>),
        updatedAt: new Date().toISOString(),
        updatedBy: staffName,
      },
      current.reportingPortal || DEFAULT_REPORTING_PORTAL
    );
    writeSettingsRepository({ ...current, reportingPortal: updated });
    res.json(updated);
  });

  // Petugas TU Delegation & Activation Settings Routes
  app.get('/api/tu-staff', (_req: Request, res: Response) => {
    res.json(toPublicTuStaffInfo(readSettingsRepository().tuStaff));
  });

  app.get('/api/tu-staff/settings', requirePetugasAuth, (_req: Request, res: Response) => {
    res.json(readSettingsRepository().tuStaff);
  });

  app.put('/api/tu-staff', requirePetugasAuth, (req: Request, res: Response) => {
    const current = readSettingsRepository();
    const gtkList = readGtkRepository();
    const body = req.body as Partial<TuStaffConfig>;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Payload pengaturan Petugas TU tidak valid.' });
      return;
    }

    const hasManualStaffName =
      typeof body.activeStaffName === 'string' && body.activeStaffName.trim().length > 0;
    const requestedGtkId =
      typeof body.activeGtkId === 'string' && body.activeGtkId.trim()
        ? body.activeGtkId.trim()
        : body.activeGtkId === null || hasManualStaffName
          ? null
          : current.tuStaff.activeGtkId;

    if (requestedGtkId) {
      const existsInGtk = gtkList.some((g) => g.id === requestedGtkId);
      if (!existsInGtk) {
        res.status(404).json({
          error: 'Pegawai TU yang dipilih tidak ditemukan dalam Database GTK Dapodik.',
        });
        return;
      }
    }

    if (
      body.activeStaffPhoto !== undefined &&
      !isSafeRasterImageDataUrl(body.activeStaffPhoto)
    ) {
      res.status(400).json({ error: 'Format foto Petugas TU tidak valid.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const actorName = resolveActiveStaffName(current.tuStaff);

    const sanitized = sanitizeTuStaffConfig(
      {
        ...current.tuStaff,
        ...body,
        activeGtkId: requestedGtkId,
        updatedAt: nowIso,
        updatedBy: actorName,
      },
      gtkList,
      DEFAULT_TU_STAFF
    );

    writeSettingsRepository({
      ...current,
      tuStaff: sanitized,
    });
    res.json(sanitized);
  });

  // Protected GTK Dapodik Repository Routes
  app.get('/api/gtk', requirePetugasAuth, (_req: Request, res: Response) => {
    res.json(readGtkRepository());
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
    const gtkList = readGtkRepository();
    const checked = applyDispendukcapilCheck({
      ...incoming,
      fotoDataUrl: incoming.fotoDataUrl ?? '',
      id: incoming.id?.trim() || `gtk-${Date.now()}`,
    });
    gtkList.unshift(checked);
    writeGtkRepository(gtkList);
    res.status(201).json(checked);
  });

  app.put('/api/gtk/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const incoming = req.body as DapodikGtk;
    if (!isSafeRasterImageDataUrl(incoming?.fotoDataUrl ?? '')) {
      res.status(400).json({ error: 'Format foto PTK tidak valid atau melebihi batas ukuran.' });
      return;
    }
    const gtkList = readGtkRepository();
    const idx = gtkList.findIndex((g) => g.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Data PTK tidak ditemukan.' });
      return;
    }
    const checked = applyDispendukcapilCheck({
      ...incoming,
      fotoDataUrl: incoming.fotoDataUrl ?? '',
      id,
    });
    gtkList[idx] = checked;
    writeGtkRepository(gtkList);
    res.json(checked);
  });

  app.delete('/api/gtk/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const gtkList = readGtkRepository().filter((g) => g.id !== id);
    writeGtkRepository(gtkList);

    const settings = readSettingsRepository();
    const hadOperator = settings.tuStaff.operators.some((op) => op.gtkId === id);
    const wasActive = settings.tuStaff.activeGtkId === id;
    if (hadOperator || wasActive) {
      const nextOperators = settings.tuStaff.operators.filter((op) => op.gtkId !== id);
      const nextFallbackOp = nextOperators.find((op) => op.isActive) || null;
      const nextTuStaff = sanitizeTuStaffConfig(
        {
          ...settings.tuStaff,
          operators: nextOperators,
          activeGtkId: wasActive ? (nextFallbackOp?.gtkId ?? null) : settings.tuStaff.activeGtkId,
          isEnabled: wasActive && !nextFallbackOp ? false : settings.tuStaff.isEnabled,
          deactivatedReason:
            wasActive && !nextFallbackOp
              ? 'Pegawai TU aktif dihapus dari Database GTK Dapodik.'
              : settings.tuStaff.deactivatedReason,
          updatedAt: new Date().toISOString(),
        },
        gtkList,
        DEFAULT_TU_STAFF
      );
      writeSettingsRepository({ ...settings, tuStaff: nextTuStaff });
    }

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
    let gtkList = readGtkRepository();
    let addedCount = 0;
    let updatedCount = 0;
    const checkedIncoming = incomingList
      .filter((g): g is DapodikGtk => Boolean(g && typeof g.nama === 'string' && g.nama.trim()))
      .map((g, idx) =>
        applyDispendukcapilCheck({
          ...g,
          fotoDataUrl: isSafeRasterImageDataUrl(g.fotoDataUrl ?? '') ? (g.fotoDataUrl ?? '') : '',
          id: g.id || `gtk-imp-${Date.now()}-${idx}`,
        })
      );

    if (mode === 'replace') {
      gtkList = checkedIncoming;
      addedCount = checkedIncoming.length;
    } else if (mode === 'append') {
      gtkList = [...checkedIncoming, ...gtkList];
      addedCount = checkedIncoming.length;
    } else {
      for (const incoming of checkedIncoming) {
        const matchIdx = gtkList.findIndex(
          (existing) =>
            (incoming.nik && existing.nik === incoming.nik) ||
            (incoming.nip && existing.nip === incoming.nip) ||
            (incoming.nuptk && existing.nuptk === incoming.nuptk)
        );
        if (matchIdx >= 0) {
          gtkList[matchIdx] = applyDispendukcapilCheck({
            ...gtkList[matchIdx],
            ...incoming,
            fotoDataUrl: incoming.fotoDataUrl || gtkList[matchIdx].fotoDataUrl || '',
            id: gtkList[matchIdx].id,
          });
          updatedCount++;
        } else {
          gtkList.unshift(incoming);
          addedCount++;
        }
      }
    }

    const envelope = writeGtkRepository(gtkList);
    res.json({
      gtkList: envelope.data,
      addedCount,
      updatedCount,
      repositoryUpdatedAt: envelope.updatedAt,
    });
  });

  app.post('/api/gtk/padan-dispendukcapil', requirePetugasAuth, (_req: Request, res: Response) => {
    const gtkList = readGtkRepository().map(applyDispendukcapilCheck);
    writeGtkRepository(gtkList);
    res.json({
      gtkList,
      padanCount: gtkList.filter((g) => g.dukcapilStatus === 'Padan Dispendukcapil').length,
      residuCount: gtkList.filter((g) => g.dukcapilStatus === 'Residu Data').length,
      invalidCount: gtkList.filter((g) => g.dukcapilStatus === 'Tidak Padan NIK').length,
    });
  });

  // Public Rombel lookup
  app.get('/api/rombel/public', (_req: Request, res: Response) => {
    const rombels = readRombelsRepository();
    res.json(
      rombels.map((r) => ({
        id: r.id,
        namaRombel: r.namaRombel,
        tingkatKelas: r.tingkatKelas,
        ruangan: r.ruangan,
      }))
    );
  });

  // Protected Rombongan Belajar & Wali Kelas Repository Routes
  app.get('/api/rombel', requirePetugasAuth, (_req: Request, res: Response) => {
    res.json(readRombelsRepository());
  });

  app.post('/api/rombel', requirePetugasAuth, (req: Request, res: Response) => {
    const incoming = req.body as DapodikRombel;
    if (!incoming || typeof incoming.namaRombel !== 'string' || !incoming.namaRombel.trim()) {
      res.status(400).json({ error: 'Nama rombel wajib diisi.' });
      return;
    }
    const gtkList = readGtkRepository();
    const rombels = readRombelsRepository();
    const created = normalizeRombelRecord(
      {
        ...incoming,
        id: incoming.id?.trim() || `rombel-${Date.now()}`,
        updatedAt: new Date().toISOString(),
      },
      gtkList
    );
    const nextRombels = sortRombelsNaturally([...rombels, created]);
    writeRombelsRepository(nextRombels);
    res.status(201).json(created);
  });

  app.put('/api/rombel/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const incoming = req.body as DapodikRombel;
    if (!incoming || typeof incoming.namaRombel !== 'string' || !incoming.namaRombel.trim()) {
      res.status(400).json({ error: 'Nama rombel wajib diisi.' });
      return;
    }
    const gtkList = readGtkRepository();
    const rombels = readRombelsRepository();
    const idx = rombels.findIndex((r) => r.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Data rombel tidak ditemukan.' });
      return;
    }
    const updated = normalizeRombelRecord(
      {
        ...rombels[idx],
        ...incoming,
        id,
        updatedAt: new Date().toISOString(),
      },
      gtkList
    );
    rombels[idx] = updated;
    const nextRombels = sortRombelsNaturally(rombels);
    writeRombelsRepository(nextRombels);
    res.json(updated);
  });

  app.delete('/api/rombel/:id', requirePetugasAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const rombels = readRombelsRepository();
    writeRombelsRepository(rombels.filter((r) => r.id !== id));
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
    const gtkList = readGtkRepository();
    let rombels = readRombelsRepository();
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
          gtkList
        )
      );

    if (mode === 'replace') {
      rombels = sortRombelsNaturally(normalizedIncoming);
      addedCount = normalizedIncoming.length;
    } else if (mode === 'append') {
      rombels = sortRombelsNaturally([...rombels, ...normalizedIncoming]);
      addedCount = normalizedIncoming.length;
    } else {
      for (const incoming of normalizedIncoming) {
        const matchIdx = rombels.findIndex(
          (existing) => existing.namaRombel.toUpperCase() === incoming.namaRombel.toUpperCase()
        );
        if (matchIdx >= 0) {
          rombels[matchIdx] = normalizeRombelRecord(
            {
              ...rombels[matchIdx],
              ...incoming,
              id: rombels[matchIdx].id,
              updatedAt: new Date().toISOString(),
            },
            gtkList
          );
          updatedCount++;
        } else {
          rombels.push(incoming);
          addedCount++;
        }
      }
      rombels = sortRombelsNaturally(rombels);
    }

    const envelope = writeRombelsRepository(rombels);
    res.json({
      rombels: envelope.data,
      addedCount,
      updatedCount,
      repositoryUpdatedAt: envelope.updatedAt,
    });
  });

  // Protected Backup, Restore & Email Backup Settings Routes
  app.get('/api/backup/settings', requirePetugasAuth, (_req: Request, res: Response) => {
    res.json(readSettingsRepository().backup);
  });

  app.put('/api/backup/settings', requirePetugasAuth, (req: Request, res: Response) => {
    const current = readSettingsRepository();
    const body = req.body as Partial<BackupSettingsConfig>;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Payload pengaturan backup email tidak valid.' });
      return;
    }

    const rawTarget = typeof body.targetEmail === 'string' ? body.targetEmail.trim() : '';
    if (!rawTarget || !isValidEmailAddress(rawTarget)) {
      res.status(400).json({
        error: 'Alamat email tujuan backup wajib diisi dengan format email yang valid.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const actorName = resolveActiveStaffName(current.tuStaff);
    const { config, error } = sanitizeBackupSettings(
      {
        ...current.backup,
        ...body,
        updatedAt: nowIso,
        updatedBy: actorName,
      },
      current.backup || DEFAULT_BACKUP_SETTINGS
    );

    if (error) {
      res.status(400).json({ error });
      return;
    }

    writeSettingsRepository({
      ...current,
      backup: config,
    });
    res.json(config);
  });

  app.get('/api/backup/export', requirePetugasAuth, (req: Request, res: Response) => {
    const rawScope = typeof req.query.scope === 'string' ? req.query.scope.trim() : 'all';
    const validScopes: BackupScopeKey[] = [
      'all',
      'requests',
      'agenda',
      'settings',
      'students',
      'gtk',
      'rombels',
    ];
    const scope: BackupScopeKey = validScopes.includes(rawScope as BackupScopeKey)
      ? (rawScope as BackupScopeKey)
      : 'all';

    const current = readSettingsRepository();
    const actorName = resolveActiveStaffName(current.tuStaff);
    const bundle = buildBackupBundle(scope, actorName);

    if (req.query.recordTimestamp === '1') {
      const updatedBackup: BackupSettingsConfig = {
        ...current.backup,
        lastBackupAt: bundle.exportedAt,
        lastBackupBy: actorName,
      };
      writeSettingsRepository({
        ...current,
        backup: updatedBackup,
      });
    }

    res.json(bundle);
  });

  app.post('/api/backup/restore', requirePetugasAuth, (req: Request, res: Response) => {
    const { bundle, selectedRepos, mode } = req.body as {
      bundle?: unknown;
      selectedRepos?: BackupRepositoryKey[];
      mode?: 'replace' | 'merge';
    };

    const allowedRepos: BackupRepositoryKey[] = [
      'requests',
      'agenda',
      'settings',
      'students',
      'gtk',
      'rombels',
    ];
    const cleanSelected = Array.isArray(selectedRepos)
      ? selectedRepos.filter((k): k is BackupRepositoryKey => allowedRepos.includes(k))
      : allowedRepos;

    if (cleanSelected.length === 0) {
      res.status(400).json({ error: 'Pilih minimal satu repositori yang akan di-restore.' });
      return;
    }

    const restoreMode = mode === 'replace' ? 'replace' : 'merge';
    const current = readSettingsRepository();
    const actorName = resolveActiveStaffName(current.tuStaff);

    const { summary, error } = restoreBackupBundle(bundle, cleanSelected, restoreMode, actorName);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    const nextSettings = readSettingsRepository();
    res.json({
      summary,
      repositories: getRepositoryStatuses(),
      data: {
        requests: readRequestsRepository(),
        agenda: readAgendaRepository(),
        students: readStudentsRepository(),
        gtkList: readGtkRepository(),
        rombels: readRombelsRepository(),
        kopSurat: nextSettings.kopSurat,
        reportingPortal: nextSettings.reportingPortal,
        tuStaff: nextSettings.tuStaff,
        backupSettings: nextSettings.backup,
      },
    });
  });

  app.post('/api/backup/mark-emailed', requirePetugasAuth, (req: Request, res: Response) => {
    const recipient = typeof req.body?.recipient === 'string' ? req.body.recipient.trim().slice(0, 180) : '';
    const current = readSettingsRepository();
    const actorName = resolveActiveStaffName(current.tuStaff);
    const nowIso = new Date().toISOString();
    const nextBackup: BackupSettingsConfig = {
      ...current.backup,
      lastBackupAt: nowIso,
      lastBackupBy: actorName,
      lastEmailSentAt: nowIso,
      lastEmailRecipient: recipient || current.backup.targetEmail,
    };
    writeSettingsRepository({
      ...current,
      backup: nextBackup,
    });
    res.json(nextBackup);
  });

  app.post('/api/deduplicate', requirePetugasAuth, (req: Request, res: Response) => {
    const { target, deleteIds } = req.body as {
      target?: unknown;
      deleteIds?: unknown;
    };
    const allowedTargets: DeduplicateRepoTarget[] = [
      'students',
      'gtk',
      'rombels',
      'requests',
      'agenda',
    ];
    if (typeof target !== 'string' || !allowedTargets.includes(target as DeduplicateRepoTarget)) {
      res.status(400).json({ error: 'Target repositori pembersihan duplikat tidak valid.' });
      return;
    }
    if (!Array.isArray(deleteIds)) {
      res.status(400).json({ error: 'Daftar ID data duplikat tidak valid.' });
      return;
    }
    const cleanIds = deleteIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    if (cleanIds.length === 0) {
      res.status(400).json({ error: 'Pilih minimal satu data duplikat untuk dihapus.' });
      return;
    }

    const result = deduplicateRepository(target as DeduplicateRepoTarget, cleanIds);
    res.json({
      target,
      ...result,
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
