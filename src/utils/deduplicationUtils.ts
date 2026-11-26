import {
  AgendaEntry,
  DapodikGtk,
  DapodikRombel,
  DapodikStudent,
  ServiceRequest,
} from '../types/tu';
import { formatPtkDisplayName } from './gtkDapodikValidation';
import { normalizeRombelKey } from './rombelDapodikUtils';

export type DeduplicateTarget = 'students' | 'gtk' | 'rombels' | 'requests' | 'agenda';
export type DeduplicateMatchMode = 'all' | 'name-only' | 'identity-only';

export interface DuplicateGroupItem<T> {
  id: string;
  record: T;
  title: string;
  subtitle: string;
  detailBadges: string[];
  completenessScore: number;
}

export interface DuplicateGroup<T> {
  groupId: string;
  reasons: string[];
  hasIdentityConflict: boolean;
  recommendedKeepId: string;
  items: DuplicateGroupItem<T>[];
}

function normalizeNameText(value: string | undefined | null): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeIdToken(value: string | undefined | null): string {
  const trimmed = String(value ?? '').trim().toLowerCase();
  if (!trimmed || trimmed === '-' || /^0+$/.test(trimmed)) return '';
  return trimmed.replace(/\s+/g, '');
}

function countNonEmptyFields(obj: object): number {
  let score = 0;
  for (const val of Object.values(obj as Record<string, unknown>)) {
    if (typeof val === 'string' && val.trim() !== '' && val.trim() !== '-') score += 1;
    else if (typeof val === 'number' && val > 0) score += 1;
    else if (typeof val === 'boolean' && val) score += 1;
    else if (Array.isArray(val) && val.length > 0) score += 1;
  }
  return score;
}

function clusterByKeys<T extends { id: string }>(
  records: T[],
  keyExtractor: (item: T) => Array<{ key: string; label: string }>
): Array<{ indices: number[]; reasons: string[] }> {
  const parent = records.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const bucketMap = new Map<string, { label: string; indices: number[] }>();
  records.forEach((rec, idx) => {
    const entries = keyExtractor(rec);
    for (const { key, label } of entries) {
      if (!key) continue;
      const existing = bucketMap.get(key);
      if (existing) {
        existing.indices.push(idx);
      } else {
        bucketMap.set(key, { label, indices: [idx] });
      }
    }
  });

  const edgeReasons = new Map<number, Set<string>>();
  for (const { label, indices } of bucketMap.values()) {
    if (indices.length < 2) continue;
    for (let i = 1; i < indices.length; i++) {
      union(indices[0], indices[i]);
    }
    for (const idx of indices) {
      const root = find(idx);
      const set = edgeReasons.get(root) ?? new Set<string>();
      set.add(label);
      edgeReasons.set(root, set);
    }
  }

  // Merge reason sets across united roots
  const grouped = new Map<number, { indices: number[]; reasons: Set<string> }>();
  records.forEach((_, idx) => {
    const root = find(idx);
    const entry = grouped.get(root) ?? { indices: [], reasons: new Set<string>() };
    entry.indices.push(idx);
    const rSet = edgeReasons.get(idx);
    if (rSet) {
      for (const r of rSet) entry.reasons.add(r);
    }
    grouped.set(root, entry);
  });

  // Also ensure all reasons from bucketMap attach to the final root
  for (const { label, indices } of bucketMap.values()) {
    if (indices.length < 2) continue;
    const root = find(indices[0]);
    const entry = grouped.get(root);
    if (entry) entry.reasons.add(label);
  }

  return Array.from(grouped.values())
    .filter((g) => g.indices.length > 1)
    .map((g) => ({
      indices: g.indices,
      reasons: Array.from(g.reasons),
    }));
}

export function findDuplicateStudents(
  students: DapodikStudent[],
  mode: DeduplicateMatchMode = 'all'
): DuplicateGroup<DapodikStudent>[] {
  const clusters = clusterByKeys(students, (s) => {
    const keys: Array<{ key: string; label: string }> = [];
    const nameKey = normalizeNameText(s.nama);
    const nisnKey = normalizeIdToken(s.nisn);
    const nikKey = normalizeIdToken(s.nik);
    const nipdKey = normalizeIdToken(s.nipd);

    if (mode !== 'identity-only' && nameKey) {
      keys.push({ key: `name:${nameKey}`, label: 'Nama Sama' });
    }
    if (mode !== 'name-only') {
      if (nisnKey) keys.push({ key: `nisn:${nisnKey}`, label: 'NISN Sama' });
      if (nikKey) keys.push({ key: `nik:${nikKey}`, label: 'NIK Sama' });
      if (nipdKey) keys.push({ key: `nipd:${nipdKey}`, label: 'NIPD Sama' });
    }
    return keys;
  });

  return clusters.map((cluster, idx) => {
    const members = cluster.indices.map((i) => students[i]);
    const distinctNisn = new Set(members.map((m) => normalizeIdToken(m.nisn)).filter(Boolean));
    const distinctNik = new Set(members.map((m) => normalizeIdToken(m.nik)).filter(Boolean));
    const distinctBirth = new Set(
      members.map((m) => normalizeIdToken(m.tanggalLahir)).filter(Boolean)
    );
    const hasIdentityConflict =
      distinctNisn.size > 1 || distinctNik.size > 1 || distinctBirth.size > 1;

    const items: DuplicateGroupItem<DapodikStudent>[] = members
      .map((s) => {
        let score = countNonEmptyFields(s);
        if (normalizeIdToken(s.nisn).length === 10) score += 10;
        if (normalizeIdToken(s.nik).length === 16) score += 10;
        if (s.namaIbu?.trim()) score += 5;
        if (s.rombelSaatIni?.trim()) score += 3;
        return {
          id: s.id,
          record: s,
          title: s.nama || '(Tanpa Nama)',
          subtitle: `${s.rombelSaatIni || 'Tanpa Rombel'} · JK: ${s.jk || '-'}`,
          detailBadges: [
            `NISN: ${s.nisn || '-'}`,
            `NIPD: ${s.nipd || '-'}`,
            `NIK: ${s.nik || '-'}`,
            s.tanggalLahir ? `Tgl Lahir: ${s.tanggalLahir}` : '',
            s.namaIbu ? `Ibu: ${s.namaIbu}` : '',
          ].filter(Boolean),
          completenessScore: score,
        };
      })
      .sort((a, b) => b.completenessScore - a.completenessScore);

    return {
      groupId: `stu-dup-${idx}-${items[0]?.id}`,
      reasons: cluster.reasons,
      hasIdentityConflict,
      recommendedKeepId: items[0].id,
      items,
    };
  });
}

export function findDuplicateGtk(
  gtkList: DapodikGtk[],
  mode: DeduplicateMatchMode = 'all'
): DuplicateGroup<DapodikGtk>[] {
  const clusters = clusterByKeys(gtkList, (g) => {
    const keys: Array<{ key: string; label: string }> = [];
    const bareName = normalizeNameText(g.nama);
    const fullDisplay = normalizeNameText(formatPtkDisplayName(g));
    const nikKey = normalizeIdToken(g.nik);
    const nipKey = normalizeIdToken(g.nip);
    const nuptkKey = normalizeIdToken(g.nuptk);

    if (mode !== 'identity-only') {
      if (bareName) keys.push({ key: `name:${bareName}`, label: 'Nama Sama' });
      if (fullDisplay && fullDisplay !== bareName) {
        keys.push({ key: `display:${fullDisplay}`, label: 'Nama & Gelar Sama' });
      }
    }
    if (mode !== 'name-only') {
      if (nikKey) keys.push({ key: `nik:${nikKey}`, label: 'NIK Sama' });
      if (nipKey) keys.push({ key: `nip:${nipKey}`, label: 'NIP Sama' });
      if (nuptkKey) keys.push({ key: `nuptk:${nuptkKey}`, label: 'NUPTK Sama' });
    }
    return keys;
  });

  return clusters.map((cluster, idx) => {
    const members = cluster.indices.map((i) => gtkList[i]);
    const distinctNik = new Set(members.map((m) => normalizeIdToken(m.nik)).filter(Boolean));
    const distinctNip = new Set(members.map((m) => normalizeIdToken(m.nip)).filter(Boolean));
    const distinctBirth = new Set(
      members.map((m) => normalizeIdToken(m.tanggalLahir)).filter(Boolean)
    );
    const hasIdentityConflict =
      distinctNik.size > 1 || distinctNip.size > 1 || distinctBirth.size > 1;

    const items: DuplicateGroupItem<DapodikGtk>[] = members
      .map((g) => {
        let score = countNonEmptyFields(g);
        if (g.fotoDataUrl) score += 15;
        if (normalizeIdToken(g.nik).length === 16) score += 10;
        if (normalizeIdToken(g.nip).length >= 8) score += 10;
        if (normalizeIdToken(g.nuptk).length >= 8) score += 6;
        if (g.dukcapilStatus === 'Padan Dispendukcapil') score += 8;
        return {
          id: g.id,
          record: g,
          title: formatPtkDisplayName(g),
          subtitle: `${g.jabatanPtk || g.jenisPtk} · ${g.statusKepegawaian}`,
          detailBadges: [
            `NIP: ${g.nip || '-'}`,
            `NUPTK: ${g.nuptk || '-'}`,
            `NIK: ${g.nik || '-'}`,
            g.fotoDataUrl ? 'Ada Foto' : 'Tanpa Foto',
          ],
          completenessScore: score,
        };
      })
      .sort((a, b) => b.completenessScore - a.completenessScore);

    return {
      groupId: `gtk-dup-${idx}-${items[0]?.id}`,
      reasons: cluster.reasons,
      hasIdentityConflict,
      recommendedKeepId: items[0].id,
      items,
    };
  });
}

export function findDuplicateRombels(rombels: DapodikRombel[]): DuplicateGroup<DapodikRombel>[] {
  const clusters = clusterByKeys(rombels, (r) => {
    const key = normalizeRombelKey(r.namaRombel);
    return key ? [{ key: `rombel:${key}`, label: 'Nama Rombel Sama' }] : [];
  });

  return clusters.map((cluster, idx) => {
    const members = cluster.indices.map((i) => rombels[i]);
    const items: DuplicateGroupItem<DapodikRombel>[] = members
      .map((r) => {
        let score = countNonEmptyFields(r);
        if (r.waliKelasId) score += 10;
        if (r.jumlahTotal > 0) score += 5;
        return {
          id: r.id,
          record: r,
          title: r.namaRombel,
          subtitle: `Tingkat ${r.tingkatKelas} · Wali: ${r.waliKelasNama || '-'}`,
          detailBadges: [
            `Ruang: ${r.ruangan || '-'}`,
            `Siswa: ${r.jumlahTotal}`,
            `Kurikulum: ${r.kurikulum || '-'}`,
          ],
          completenessScore: score,
        };
      })
      .sort((a, b) => b.completenessScore - a.completenessScore);

    return {
      groupId: `rombel-dup-${idx}-${items[0]?.id}`,
      reasons: cluster.reasons,
      hasIdentityConflict: false,
      recommendedKeepId: items[0].id,
      items,
    };
  });
}

export function findDuplicateRequests(
  requests: ServiceRequest[],
  mode: DeduplicateMatchMode = 'all'
): DuplicateGroup<ServiceRequest>[] {
  const clusters = clusterByKeys(requests, (r) => {
    const keys: Array<{ key: string; label: string }> = [];
    const nameKey = normalizeNameText(r.applicantName);
    const idNum = normalizeIdToken(r.identityNumber);
    const serviceKey = normalizeNameText(r.serviceId);
    const purposeKey = normalizeNameText(r.purpose);

    if (mode !== 'identity-only' && nameKey && serviceKey && purposeKey) {
      keys.push({
        key: `req-same:${nameKey}|${serviceKey}|${purposeKey}`,
        label: 'Nama, Layanan & Keperluan Sama',
      });
    } else if (mode === 'name-only' && nameKey) {
      keys.push({
        key: `req-name:${nameKey}`,
        label: 'Nama Pemohon Sama',
      });
    }
    if (mode !== 'name-only' && idNum && serviceKey && purposeKey) {
      keys.push({
        key: `req-id:${idNum}|${serviceKey}|${purposeKey}`,
        label: 'NISN/NIP, Layanan & Keperluan Sama',
      });
    }
    return keys;
  });

  return clusters.map((cluster, idx) => {
    const members = cluster.indices.map((i) => requests[i]);
    const distinctIds = new Set(
      members.map((m) => normalizeIdToken(m.identityNumber)).filter(Boolean)
    );
    const hasIdentityConflict = distinctIds.size > 1;

    const items: DuplicateGroupItem<ServiceRequest>[] = members
      .map((r) => {
        let score = countNonEmptyFields(r) + (r.timeline?.length ?? 0) * 2;
        if (r.letterNumber) score += 10;
        if (r.status === 'Selesai') score += 12;
        else if (r.status !== 'Diajukan') score += 5;
        return {
          id: r.id,
          record: r,
          title: `${r.applicantName} (${r.id})`,
          subtitle: `${r.serviceTitle} · Status: ${r.status}`,
          detailBadges: [
            `NISN/NIP: ${r.identityNumber}`,
            `Keperluan: ${r.purpose.slice(0, 50)}`,
            r.letterNumber ? `No. Surat: ${r.letterNumber}` : 'Belum bernomor',
          ],
          completenessScore: score,
        };
      })
      .sort((a, b) => b.completenessScore - a.completenessScore);

    return {
      groupId: `req-dup-${idx}-${items[0]?.id}`,
      reasons: cluster.reasons,
      hasIdentityConflict,
      recommendedKeepId: items[0].id,
      items,
    };
  });
}

export function findDuplicateAgenda(
  entries: AgendaEntry[],
  mode: DeduplicateMatchMode = 'all'
): DuplicateGroup<AgendaEntry>[] {
  const clusters = clusterByKeys(entries, (a) => {
    const keys: Array<{ key: string; label: string }> = [];
    const letterNo = normalizeIdToken(a.letterNumber);
    const agendaNo = normalizeIdToken(a.agendaNumber);
    const subject = normalizeNameText(a.subject);
    const party = normalizeNameText(a.counterparty);

    if (mode !== 'identity-only' && subject && party && a.letterDate) {
      keys.push({
        key: `ag-subj:${a.type}|${party}|${subject}|${a.letterDate}`,
        label: 'Asal/Tujuan, Perihal & Tanggal Sama',
      });
    }
    if (mode !== 'name-only') {
      if (letterNo) {
        keys.push({ key: `ag-let:${a.type}|${letterNo}`, label: 'Nomor Surat Sama' });
      }
      if (agendaNo) {
        keys.push({ key: `ag-no:${agendaNo}`, label: 'Nomor Agenda Sama' });
      }
    }
    return keys;
  });

  return clusters.map((cluster, idx) => {
    const members = cluster.indices.map((i) => entries[i]);
    const items: DuplicateGroupItem<AgendaEntry>[] = members
      .map((a) => {
        let score = countNonEmptyFields(a);
        if (a.relatedTicketId) score += 8;
        if (a.disposition?.trim()) score += 4;
        return {
          id: a.id,
          record: a,
          title: `${a.agendaNumber} — ${a.letterNumber}`,
          subtitle: `${a.type} · ${a.counterparty}`,
          detailBadges: [
            `Tgl Surat: ${a.letterDate}`,
            `Perihal: ${a.subject.slice(0, 60)}`,
          ],
          completenessScore: score,
        };
      })
      .sort((a, b) => b.completenessScore - a.completenessScore);

    return {
      groupId: `ag-dup-${idx}-${items[0]?.id}`,
      reasons: cluster.reasons,
      hasIdentityConflict: false,
      recommendedKeepId: items[0].id,
      items,
    };
  });
}
