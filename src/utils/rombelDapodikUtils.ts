import * as XLSX from 'xlsx';
import type { DapodikGtk, DapodikRombel, DapodikStudent } from '../types/tu.ts';

export const ROMBEL_DAPODIK_HEADERS = [
  'No',
  'Nama Rombel',
  'Tingkat Kelas',
  'L',
  'P',
  'Total',
  'Wali Kelas',
  'Kurikulum',
  'Ruangan',
] as const;

export function sortRombelsNaturally(list: DapodikRombel[]): DapodikRombel[] {
  const rankTingkat = (t: string): number => (t === '10' ? 1 : t === '11' ? 2 : 3);
  return [...list].sort((a, b) => {
    const diff = rankTingkat(a.tingkatKelas) - rankTingkat(b.tingkatKelas);
    if (diff !== 0) return diff;
    return a.namaRombel.localeCompare(b.namaRombel, 'id', { numeric: true, sensitivity: 'base' });
  });
}

export function normalizeRombelRecord(
  rombel: DapodikRombel,
  gtkList?: DapodikGtk[]
): DapodikRombel {
  const jumlahL = Math.max(0, Math.round(Number(rombel.jumlahL) || 0));
  const jumlahP = Math.max(0, Math.round(Number(rombel.jumlahP) || 0));
  const jumlahTotal = jumlahL + jumlahP > 0 ? jumlahL + jumlahP : Math.max(0, Math.round(Number(rombel.jumlahTotal) || 0));
  const cleanName = (rombel.namaRombel || '').trim().toUpperCase();
  const cleanWali = (rombel.waliKelasNama || '').trim().toUpperCase();
  const cleanKurikulum = (rombel.kurikulum || 'KURIKULUM SMA MERDEKA').trim().toUpperCase();
  const cleanRuangan = (rombel.ruangan || cleanName).trim().toUpperCase();
  const tingkatRaw = String(rombel.tingkatKelas || '').trim();
  const tingkatKelas: '10' | '11' | '12' =
    tingkatRaw === '11' || cleanName.startsWith('XI-')
      ? '11'
      : tingkatRaw === '12' || cleanName.startsWith('XII-')
        ? '12'
        : '10';

  let waliKelasId = rombel.waliKelasId || '';
  if (gtkList && gtkList.length > 0) {
    const byId = waliKelasId ? gtkList.find((g) => g.id === waliKelasId) : undefined;
    if (byId) {
      waliKelasId = byId.id;
    } else if (cleanWali) {
      const matched = gtkList.find((g) => g.nama.trim().toUpperCase() === cleanWali);
      if (matched) waliKelasId = matched.id;
    }
  }

  return {
    ...rombel,
    namaRombel: cleanName,
    tingkatKelas,
    jumlahL,
    jumlahP,
    jumlahTotal,
    waliKelasId,
    waliKelasNama: cleanWali,
    kurikulum: cleanKurikulum,
    ruangan: cleanRuangan,
    updatedAt: rombel.updatedAt || new Date().toISOString(),
  };
}

export function rombelListToCsv(rombels: DapodikRombel[]): string {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = sortRombelsNaturally(rombels).map((r, idx) =>
    [
      idx + 1,
      r.namaRombel,
      r.tingkatKelas,
      r.jumlahL,
      r.jumlahP,
      r.jumlahTotal,
      r.waliKelasNama,
      r.kurikulum,
      r.ruangan,
    ]
      .map(escapeCell)
      .join(',')
  );
  return '\uFEFF' + [ROMBEL_DAPODIK_HEADERS.join(','), ...rows].join('\n');
}

export function exportRombelWorkbook(rombels: DapodikRombel[], templateOnly = false): void {
  const sorted = sortRombelsNaturally(rombels);
  const aoa: (string | number)[][] = [
    ['No', 'Nama Rombel', 'Tingkat Kelas', 'Jumlah Siswa', '', '', 'Wali Kelas', 'Kurikulum', 'Ruangan'],
    ['', '', '', 'L', 'P', 'Total', '', '', ''],
    ...(templateOnly
      ? []
      : sorted.map((r, idx) => [
          idx + 1,
          r.namaRombel,
          Number(r.tingkatKelas),
          r.jumlahL,
          r.jumlahP,
          r.jumlahTotal,
          r.waliKelasNama,
          r.kurikulum,
          r.ruangan,
        ])),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 3 }, e: { r: 0, c: 5 } },
  ];
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 14 },
    { wch: 7 },
    { wch: 7 },
    { wch: 8 },
    { wch: 32 },
    { wch: 26 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rombongan Belajar');
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = templateOnly
    ? 'template-rombel-dapodik-sman9sby.xlsx'
    : `rombel-wali-kelas-sman9sby-${dateTag}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function normalizeRombelKey(name: string | undefined | null): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function exportRombelRosterWorkbook(
  rombel: DapodikRombel,
  students: DapodikStudent[],
  waliDisplayName: string
): void {
  const sortedStudents = [...students].sort((a, b) =>
    a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
  );
  const countL = sortedStudents.filter((s) => s.jk === 'L').length;
  const countP = sortedStudents.filter((s) => s.jk === 'P').length;

  const aoa: (string | number)[][] = [
    [`DAFTAR PESERTA DIDIK ROMBONGAN BELAJAR ${rombel.namaRombel} — SMAN 9 SURABAYA`],
    [
      `Tingkat ${rombel.tingkatKelas} | Ruangan: ${rombel.ruangan} | Wali Kelas: ${waliDisplayName} | Total: ${sortedStudents.length} Siswa (L: ${countL}, P: ${countP})`,
    ],
    [],
    [
      'No',
      'NIPD',
      'Nama Peserta Didik',
      'L/P',
      'NISN',
      'NIK',
      'Tempat Lahir',
      'Tanggal Lahir',
      'Agama',
      'Alamat',
      'No. HP',
      'Nama Ibu Kandung',
      'Asal SMP',
      'Status',
    ],
    ...sortedStudents.map((s, idx) => [
      idx + 1,
      s.nipd || '',
      s.nama,
      s.jk,
      s.nisn || '',
      s.nik || '',
      s.tempatLahir || '',
      s.tanggalLahir || '',
      s.agama || '',
      [s.alamatJalan, s.rt ? `RT ${s.rt}` : '', s.rw ? `RW ${s.rw}` : '', s.kelurahan]
        .filter(Boolean)
        .join(', '),
      s.hp || s.telepon || '',
      s.namaIbu || '',
      s.asalSmp || '',
      s.statusSiswa || 'Aktif',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },
  ];
  ws['!cols'] = [
    { wch: 5 },
    { wch: 10 },
    { wch: 32 },
    { wch: 5 },
    { wch: 13 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 10 },
    { wch: 34 },
    { wch: 15 },
    { wch: 24 },
    { wch: 26 },
    { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  const safeSheetName = `Rombel ${rombel.namaRombel}`.slice(0, 31).replace(/[\\/?*[\]]/g, '-');
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  const safeFileTag = rombel.namaRombel.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `daftar-siswa-${safeFileTag}-sman9sby-${dateTag}.xlsx`);
}

export interface ParsedRombelImport {
  rombels: DapodikRombel[];
  headerRowIndex: number;
  skippedRows: number;
}

export async function parseRombelDapodikFile(
  file: File,
  gtkList?: DapodikGtk[]
): Promise<ParsedRombelImport> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Rombel tidak memiliki sheet data yang dapat dibaca.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });

  if (aoa.length === 0) {
    throw new Error('File Rombel yang diunggah kosong.');
  }

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const rowStrings = (aoa[i] || []).map((cell) =>
      String(cell ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
    );
    const hasNamaRombel = rowStrings.some(
      (h) => h === 'nama rombel' || h.includes('rombongan belajar')
    );
    const hasWaliOrTingkat = rowStrings.some(
      (h) => h.includes('wali kelas') || h.includes('tingkat')
    );
    if (hasNamaRombel && hasWaliOrTingkat) {
      headerRowIndex = i;
      break;
    }
  }

  const primaryRow = (aoa[headerRowIndex] || []).map((cell) =>
    String(cell ?? '').replace(/\s+/g, ' ').trim()
  );
  const nextRow = (aoa[headerRowIndex + 1] || []).map((cell) =>
    String(cell ?? '').replace(/\s+/g, ' ').trim()
  );

  const hasSubHeaderRow = nextRow.some((cell) => {
    const lower = cell.toLowerCase();
    return lower === 'l' || lower === 'p' || lower === 'total';
  });

  const maxCols = Math.max(primaryRow.length, hasSubHeaderRow ? nextRow.length : 0);
  const rawHeaders: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const sub = hasSubHeaderRow ? nextRow[c] || '' : '';
    const main = primaryRow[c] || '';
    rawHeaders.push(sub || main);
  }
  const normalizedHeaders = rawHeaders.map((h) => h.toLowerCase());

  const findCol = (predicate: (h: string) => boolean): number =>
    normalizedHeaders.findIndex((h) => predicate(h));

  const colMap = {
    namaRombel: findCol((h) => h === 'nama rombel' || h === 'rombel'),
    tingkatKelas: findCol((h) => h.includes('tingkat')),
    jumlahL: findCol((h) => h === 'l' || h === 'laki-laki'),
    jumlahP: findCol((h) => h === 'p' || h === 'perempuan'),
    jumlahTotal: findCol((h) => h === 'total' || h === 'jumlah siswa'),
    waliKelas: findCol((h) => h.includes('wali kelas') || h === 'wali'),
    kurikulum: findCol((h) => h.includes('kurikulum')),
    ruangan: findCol((h) => h.includes('ruangan') || h.includes('ruang')),
  };

  if (colMap.namaRombel < 0) {
    throw new Error(
      'Kolom "Nama Rombel" tidak ditemukan. Gunakan format Unduhan Rombongan Belajar Dapodik.'
    );
  }

  const rombels: DapodikRombel[] = [];
  let skippedRows = 0;
  const dataStartRow = headerRowIndex + (hasSubHeaderRow ? 2 : 1);

  for (let r = dataStartRow; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const getStr = (idx: number) => (idx >= 0 ? String(row[idx] ?? '').trim() : '');
    const getNum = (idx: number) => {
      if (idx < 0) return 0;
      const n = Number(String(row[idx] ?? '').replace(/[^\d]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };

    const namaRombel = getStr(colMap.namaRombel);
    if (!namaRombel) {
      skippedRows++;
      continue;
    }

    const tingkatRaw = getStr(colMap.tingkatKelas);
    const tingkatKelas: '10' | '11' | '12' =
      tingkatRaw === '11' || namaRombel.toUpperCase().startsWith('XI-')
        ? '11'
        : tingkatRaw === '12' || namaRombel.toUpperCase().startsWith('XII-')
          ? '12'
          : '10';

    const jumlahL = getNum(colMap.jumlahL);
    const jumlahP = getNum(colMap.jumlahP);
    const jumlahTotal = getNum(colMap.jumlahTotal) || jumlahL + jumlahP;

    rombels.push(
      normalizeRombelRecord(
        {
          id: `rombel-imp-${Date.now()}-${r}`,
          namaRombel,
          tingkatKelas,
          jumlahL,
          jumlahP,
          jumlahTotal,
          waliKelasNama: getStr(colMap.waliKelas),
          kurikulum: getStr(colMap.kurikulum) || 'KURIKULUM SMA MERDEKA',
          ruangan: getStr(colMap.ruangan) || namaRombel,
        },
        gtkList
      )
    );
  }

  return {
    rombels: sortRombelsNaturally(rombels),
    headerRowIndex,
    skippedRows,
  };
}
