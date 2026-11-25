import * as XLSX from 'xlsx';
import type { DapodikGtk, DukcapilMatchStatus } from '../types/tu.ts';

const DIGITS_ONLY = /^\d+$/;

const PROVINCE_NAMES: Record<string, string> = {
  '11': 'Aceh',
  '12': 'Sumatera Utara',
  '13': 'Sumatera Barat',
  '14': 'Riau',
  '15': 'Jambi',
  '16': 'Sumatera Selatan',
  '17': 'Bengkulu',
  '18': 'Lampung',
  '19': 'Kep. Bangka Belitung',
  '21': 'Kepulauan Riau',
  '31': 'DKI Jakarta',
  '32': 'Jawa Barat',
  '33': 'Jawa Tengah',
  '34': 'DI Yogyakarta',
  '35': 'Jawa Timur',
  '36': 'Banten',
  '51': 'Bali',
  '52': 'Nusa Tenggara Barat',
  '53': 'Nusa Tenggara Timur',
  '61': 'Kalimantan Barat',
  '62': 'Kalimantan Tengah',
  '63': 'Kalimantan Selatan',
  '64': 'Kalimantan Timur',
  '65': 'Kalimantan Utara',
  '71': 'Sulawesi Utara',
  '72': 'Sulawesi Tengah',
  '73': 'Sulawesi Selatan',
  '74': 'Sulawesi Tenggara',
  '75': 'Gorontalo',
  '76': 'Sulawesi Barat',
  '81': 'Maluku',
  '82': 'Maluku Utara',
  '91': 'Papua',
  '92': 'Papua Barat',
  '93': 'Papua Selatan',
  '94': 'Papua Tengah',
  '95': 'Papua Pegunungan',
  '96': 'Papua Barat Daya',
};

const KABKOTA_JATIM: Record<string, string> = {
  '3501': 'Kab. Pacitan',
  '3502': 'Kab. Ponorogo',
  '3503': 'Kab. Trenggalek',
  '3504': 'Kab. Tulungagung',
  '3505': 'Kab. Blitar',
  '3506': 'Kab. Kediri',
  '3507': 'Kab. Malang',
  '3508': 'Kab. Lumajang',
  '3509': 'Kab. Jember',
  '3510': 'Kab. Banyuwangi',
  '3511': 'Kab. Bondowoso',
  '3512': 'Kab. Situbondo',
  '3513': 'Kab. Probolinggo',
  '3514': 'Kab. Pasuruan',
  '3515': 'Kab. Sidoarjo',
  '3516': 'Kab. Mojokerto',
  '3517': 'Kab. Jombang',
  '3518': 'Kab. Nganjuk',
  '3519': 'Kab. Madiun',
  '3520': 'Kab. Magetan',
  '3521': 'Kab. Ngawi',
  '3522': 'Kab. Bojonegoro',
  '3523': 'Kab. Tuban',
  '3524': 'Kab. Lamongan',
  '3525': 'Kab. Gresik',
  '3526': 'Kab. Bangkalan',
  '3527': 'Kab. Sampang',
  '3528': 'Kab. Pamekasan',
  '3529': 'Kab. Sumenep',
  '3571': 'Kota Kediri',
  '3572': 'Kota Blitar',
  '3573': 'Kota Malang',
  '3574': 'Kota Probolinggo',
  '3575': 'Kota Pasuruan',
  '3576': 'Kota Mojokerto',
  '3577': 'Kota Madiun',
  '3578': 'Kota Surabaya',
  '3579': 'Kota Batu',
};

export const GTK_DAPODIK_HEADERS = [
  'No',
  'Nama',
  'NUPTK',
  'JK',
  'Tempat Lahir',
  'Tanggal Lahir',
  'NIP',
  'Status Kepegawaian',
  'Jenis PTK',
  'Agama',
  'Alamat Jalan',
  'RT',
  'RW',
  'Kelurahan',
  'Kecamatan',
  'Kode Pos',
  'HP',
  'Email',
  'Tugas Tambahan',
  'Status Tugas',
  'SK Pengangkatan',
  'TMT Pengangkatan',
  'Pangkat/Golongan',
  'NIK',
  'No KK',
  'Nama Ibu Kandung',
  'NPWP',
] as const;

export interface GtkDispendukcapilResult {
  status: DukcapilMatchStatus;
  invalidFields: string[];
  warningFields: string[];
  decodedRegion: string;
  decodedBirthAndGender: string;
  summaryNote: string;
}

function toUpperClean(value?: string): string {
  return (value ?? '').trim().toUpperCase();
}

export function normalizeGtkProfileUppercase(gtk: DapodikGtk): DapodikGtk {
  return {
    ...gtk,
    nama: toUpperClean(gtk.nama),
    tempatLahir: toUpperClean(gtk.tempatLahir),
    alamatJalan: toUpperClean(gtk.alamatJalan),
    kelurahan: toUpperClean(gtk.kelurahan),
    kecamatan: toUpperClean(gtk.kecamatan),
    tugasTambahan: toUpperClean(gtk.tugasTambahan),
    skPengangkatan: toUpperClean(gtk.skPengangkatan),
    pangkatGolongan: toUpperClean(gtk.pangkatGolongan),
    namaIbuKandung: toUpperClean(gtk.namaIbuKandung),
    gelarDepan: toUpperClean(gtk.gelarDepan),
    gelarBelakang: toUpperClean(gtk.gelarBelakang),
    jenjang: toUpperClean(gtk.jenjang),
    jurusanProdi: toUpperClean(gtk.jurusanProdi),
    sertifikasi: toUpperClean(gtk.sertifikasi),
    mengajar: toUpperClean(gtk.mengajar),
    jumlahSiswa: toUpperClean(gtk.jumlahSiswa),
    kompetensi: toUpperClean(gtk.kompetensi),
    jabatanPtk: toUpperClean(gtk.jabatanPtk),
  };
}

export function formatPtkDisplayName(gtk: Pick<DapodikGtk, 'nama' | 'gelarDepan' | 'gelarBelakang'>): string {
  const cleanTitle = (raw?: string): string => {
    if (!raw) return '';
    const cleaned = raw
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && part !== '-' && part !== '--')
      .join(', ');
    return cleaned;
  };
  const depan = cleanTitle(gtk.gelarDepan).toUpperCase();
  const belakang = cleanTitle(gtk.gelarBelakang).toUpperCase();
  const namaUpper = (gtk.nama || '').trim().toUpperCase();
  const base = depan ? `${depan}. ${namaUpper}`.replace(/\.\./g, '.') : namaUpper;
  return (belakang ? `${base}, ${belakang}` : base).toUpperCase();
}

export function padankanNikDispendukcapil(gtk: DapodikGtk): GtkDispendukcapilResult {
  const invalidFields: string[] = [];
  const warningFields: string[] = [];

  const nik = gtk.nik.trim();
  const noKk = gtk.noKk.trim();
  const ibu = gtk.namaIbuKandung.trim();

  let decodedRegion = 'Kode wilayah tidak terbaca';
  let decodedBirthAndGender = 'Tanggal lahir & JK NIK tidak terbaca';

  if (!gtk.nama.trim() || gtk.nama.trim().length < 3) {
    invalidFields.push('Nama lengkap GTK sesuai KTP/SK wajib diisi.');
  }

  if (nik.length !== 16 || !DIGITS_ONLY.test(nik)) {
    invalidFields.push('NIK harus tepat 16 digit angka sesuai KTP/KK Dispendukcapil.');
  } else if (/^(\d)\1{15}$/.test(nik) || nik.endsWith('0000')) {
    invalidFields.push('Format digit urut NIK terindikasi tidak valid (0000 / berulang).');
  } else {
    const provCode = nik.slice(0, 2);
    const kabCode = nik.slice(0, 4);
    const kecCode = nik.slice(4, 6);
    const provName = PROVINCE_NAMES[provCode];
    const kabName = KABKOTA_JATIM[kabCode];

    if (!provName || nik.slice(2, 4) === '00' || kecCode === '00') {
      invalidFields.push(`Kode wilayah NIK (${nik.slice(0, 6)}) tidak terdaftar pada master wilayah Dukcapil.`);
    } else {
      decodedRegion = kabName
        ? `${kabName}, ${provName} (${kabCode}.${kecCode})`
        : `Prov. ${provName} (${kabCode}.${kecCode})`;
    }

    const ddRaw = Number.parseInt(nik.slice(6, 8), 10);
    const mm = Number.parseInt(nik.slice(8, 10), 10);
    const yy = nik.slice(10, 12);
    const nikGender: 'L' | 'P' = ddRaw > 40 ? 'P' : 'L';
    const actualDay = ddRaw > 40 ? ddRaw - 40 : ddRaw;

    if (actualDay < 1 || actualDay > 31 || mm < 1 || mm > 12) {
      invalidFields.push(
        `Kode tanggal lahir pada NIK (${nik.slice(6, 12)}) berada di luar rentang kalender Dukcapil.`
      );
    } else {
      decodedBirthAndGender = `${String(actualDay).padStart(2, '0')}-${String(mm).padStart(2, '0')}-${yy} · ${
        nikGender === 'P' ? 'Perempuan' : 'Laki-laki'
      }`;

      if (nikGender !== gtk.jk) {
        invalidFields.push(
          `Jenis kelamin NIK (${nikGender === 'P' ? 'Perempuan / +40' : 'Laki-laki'}) tidak padan dengan JK Dapodik (${gtk.jk}).`
        );
      }

      const tglMatch = gtk.tanggalLahir.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (tglMatch) {
        const [, yearStr, monthStr, dayStr] = tglMatch;
        const expDay = Number.parseInt(dayStr, 10);
        const expMonth = Number.parseInt(monthStr, 10);
        const expYy = yearStr.slice(-2);
        if (actualDay !== expDay || mm !== expMonth || yy !== expYy) {
          invalidFields.push(
            `Tanggal lahir pada NIK (${String(actualDay).padStart(2, '0')}/${String(mm).padStart(
              2,
              '0'
            )}/${yy}) tidak padan dengan Tanggal Lahir Dapodik (${dayStr}/${monthStr}/${expYy}).`
          );
        }
      } else {
        warningFields.push('Tanggal lahir Dapodik belum diisi untuk verifikasi silang NIK.');
      }
    }
  }

  if (!ibu || ibu.length < 3) {
    warningFields.push('Nama Ibu Kandung belum dilengkapi (kunci VervalPTK/Dukcapil).');
  }

  if (noKk.length !== 16 || !DIGITS_ONLY.test(noKk)) {
    warningFields.push('Nomor KK belum 16 digit lengkap.');
  } else if (nik.length === 16 && noKk.slice(0, 2) !== nik.slice(0, 2)) {
    warningFields.push('Kode provinsi pada No. KK berbeda dengan kode provinsi NIK (cek mutasi KK).');
  }

  if (
    (gtk.statusKepegawaian === 'PNS' ||
      gtk.statusKepegawaian === 'PPPK' ||
      gtk.statusKepegawaian === 'PPPK Paruh Waktu' ||
      gtk.statusKepegawaian === 'CPNS') &&
    (!DIGITS_ONLY.test(gtk.nip.trim()) || gtk.nip.trim().length !== 18)
  ) {
    warningFields.push(`NIP ${gtk.statusKepegawaian} seharusnya 18 digit angka.`);
  }

  if (gtk.nuptk.trim() && (!DIGITS_ONLY.test(gtk.nuptk.trim()) || gtk.nuptk.trim().length !== 16)) {
    warningFields.push('NUPTK tidak 16 digit angka.');
  }

  if (!gtk.tempatLahir.trim()) {
    warningFields.push('Tempat lahir GTK belum diisi.');
  }

  const status: DukcapilMatchStatus =
    invalidFields.length > 0
      ? 'Tidak Padan NIK'
      : warningFields.length > 0
        ? 'Residu Data'
        : 'Padan Dispendukcapil';

  const summaryNote =
    status === 'Padan Dispendukcapil'
      ? `Padan struktur NIK Dispendukcapil (${decodedRegion}; Tgl lahir & JK cocok).`
      : invalidFields[0] || warningFields[0];

  return {
    status,
    invalidFields,
    warningFields,
    decodedRegion,
    decodedBirthAndGender,
    summaryNote,
  };
}

export function applyDispendukcapilCheck(gtk: DapodikGtk): DapodikGtk {
  const normalized = normalizeGtkProfileUppercase(gtk);
  const res = padankanNikDispendukcapil(normalized);
  return {
    ...normalized,
    dukcapilStatus: res.status,
    dukcapilNotes: res.summaryNote,
    dukcapilCheckedAt: new Date().toISOString(),
  };
}

function formatDapodikDateDisplay(iso: string): string {
  if (!iso) return '';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function gtkToRowArray(gtk: DapodikGtk, index: number): (string | number)[] {
  return [
    index + 1,
    gtk.nama,
    gtk.nuptk,
    gtk.jk,
    gtk.tempatLahir,
    formatDapodikDateDisplay(gtk.tanggalLahir),
    gtk.nip,
    gtk.statusKepegawaian,
    gtk.jenisPtk,
    gtk.agama,
    gtk.alamatJalan,
    gtk.rt,
    gtk.rw,
    gtk.kelurahan,
    gtk.kecamatan,
    gtk.kodePos,
    gtk.hp,
    gtk.email,
    gtk.tugasTambahan,
    gtk.statusTugas,
    gtk.skPengangkatan,
    formatDapodikDateDisplay(gtk.tmtPengangkatan),
    gtk.pangkatGolongan,
    gtk.nik,
    gtk.noKk,
    gtk.namaIbuKandung,
    gtk.npwp,
  ];
}

export function gtkListToCsv(gtkList: DapodikGtk[]): string {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = gtkList.map((g, idx) => gtkToRowArray(g, idx).map(escapeCell).join(','));
  return '\uFEFF' + [GTK_DAPODIK_HEADERS.join(','), ...rows].join('\n');
}

export function exportGtkWorkbook(gtkList: DapodikGtk[], templateOnly = false): void {
  const aoa: (string | number)[][] = [
    [...GTK_DAPODIK_HEADERS],
    ...(templateOnly ? [] : gtkList.map((g, idx) => gtkToRowArray(g, idx))),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const textCols = new Set([2, 6, 11, 12, 15, 16, 23, 24, 26]);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = 1; r <= range.e.r; r++) {
    for (const c of textCols) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && cell.v !== undefined && cell.v !== '') {
        cell.t = 's';
        cell.v = String(cell.v);
        cell.z = '@';
      }
    }
  }
  ws['!cols'] = GTK_DAPODIK_HEADERS.map((h) => ({ wch: Math.max(h.length + 3, 15) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daftar GTK');
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = templateOnly
    ? 'template-dapodik-gtk-sman9sby.xlsx'
    : `dapodik-gtk-sman9sby-${dateTag}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function normalizeIdCell(raw: unknown, expectedMinLength = 0): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  if (!str) return '';
  if (/^\d+([.,]\d+)?[eE][+-]?\d+$/.test(str)) {
    const parsed = Number(str.replace(',', '.'));
    if (!Number.isNaN(parsed)) str = Math.round(parsed).toString();
  }
  str = str.replace(/\.0+$/, '');
  if (expectedMinLength > 0 && /^\d+$/.test(str) && str.length < expectedMinLength && str.length >= expectedMinLength - 2) {
    return str.padStart(expectedMinLength, '0');
  }
  return str;
}

function parseDapodikDate(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number' && raw > 10000) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const str = String(raw).trim();
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const ymd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  return str;
}

function normalizeKepegawaian(raw: string): DapodikGtk['statusKepegawaian'] {
  const lower = raw.toLowerCase();
  if (lower.includes('paruh waktu')) return 'PPPK Paruh Waktu';
  if (lower.includes('pppk') || lower.includes('p3k')) return 'PPPK';
  if (lower.includes('cpns')) return 'CPNS';
  if (lower.includes('pns')) return 'PNS';
  if (lower.includes('gty') || lower.includes('pty')) return 'GTY/PTY';
  if (lower.includes('tenaga')) return 'Tenaga Honor Sekolah';
  return 'Guru Honor Sekolah';
}

function normalizeJenisPtk(raw: string): DapodikGtk['jenisPtk'] {
  const lower = raw.toLowerCase().trim();
  if (lower === 'guru') return 'Guru';
  if (lower === 'tenaga kependidikan') return 'Tenaga Kependidikan';
  if (lower.includes('kepala')) return 'Kepala Sekolah';
  if (lower.includes('administrasi') || lower.includes('tu') || lower.includes('tas'))
    return 'Tenaga Administrasi Sekolah';
  if (lower.includes('bk') || lower.includes('konseling')) return 'Guru BK';
  if (lower.includes('pustaka')) return 'Pustakawan';
  if (lower.includes('labor')) return 'Laboran';
  if (lower.includes('penjaga')) return 'Penjaga Sekolah';
  return 'Guru Mapel';
}

function normalizeReligion(raw: string): DapodikGtk['agama'] {
  const lower = raw.toLowerCase();
  if (lower.includes('kristen')) return 'Kristen';
  if (lower.includes('katolik')) return 'Katolik';
  if (lower.includes('hindu')) return 'Hindu';
  if (lower.includes('bud')) return 'Buddha';
  if (lower.includes('kong')) return 'Konghucu';
  return 'Islam';
}

export interface ParsedGtkImport {
  gtkList: DapodikGtk[];
  detectedHeaders: string[];
  headerRowIndex: number;
  skippedRows: number;
}

export async function parseGtkDapodikFile(file: File): Promise<ParsedGtkImport> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File GTK tidak memiliki sheet data yang dapat dibaca.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });

  if (aoa.length === 0) {
    throw new Error('File yang diunggah kosong.');
  }

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const rowStrings = (aoa[i] || []).map((cell) =>
      String(cell ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
    );
    const hasNama = rowStrings.some((h) => h === 'nama' || h === 'nama lengkap' || h === 'nama gtk');
    const hasGtkId = rowStrings.some(
      (h) => h.includes('nuptk') || h === 'nip' || h === 'nik' || h.includes('jenis ptk')
    );
    if (hasNama && hasGtkId) {
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

  // Detect Dapodik dual-row header (e.g., "Keterangan" above "Gelar Depan | Gelar Belakang | Jenjang | ...")
  const hasSubHeaderRow = nextRow.some((cell) => {
    const lower = cell.toLowerCase();
    return (
      lower.includes('gelar depan') ||
      lower.includes('gelar belakang') ||
      lower.includes('jurusan/prodi') ||
      lower.includes('tmt kerja') ||
      lower === 'jjm' ||
      lower === 'total jjm'
    );
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
    nama: findCol((h) => h === 'nama' || h === 'nama lengkap' || h === 'nama gtk'),
    nuptk: findCol((h) => h === 'nuptk'),
    jk: findCol((h) => h === 'jk' || h.includes('kelamin')),
    tempatLahir: findCol((h) => h.includes('tempat lahir')),
    tanggalLahir: findCol((h) => h.includes('tanggal lahir') || h.includes('tgl lahir')),
    nip: findCol((h) => h === 'nip'),
    statusKepegawaian: findCol((h) => h.includes('status kepegawaian') || h.includes('kepegawaian')),
    jenisPtk: findCol((h) => h === 'jenis ptk' || h.includes('jenis ptk')),
    jabatanPtk: findCol((h) => h === 'jabatan ptk' || h.includes('jabatan ptk')),
    agama: findCol((h) => h === 'agama'),
    alamatJalan: findCol((h) => h === 'alamat' || h === 'alamat jalan'),
    rt: findCol((h) => h === 'rt'),
    rw: findCol((h) => h === 'rw'),
    kelurahan: findCol((h) => h.includes('kelurahan') || h.includes('desa')),
    kecamatan: findCol((h) => h.includes('kecamatan')),
    kodePos: findCol((h) => h.includes('kode pos')),
    hp: findCol((h) => h === 'hp' || h.includes('no. hp') || h.includes('telepon')),
    email: findCol((h) => h.includes('mail')),
    tugasTambahan: findCol((h) => h === 'tugas tambahan' || (h.includes('tugas tambahan') && !h.includes('jam'))),
    statusTugas: findCol((h) => h.includes('status tugas')),
    skPengangkatan: findCol((h) => h.includes('sk pengangkatan')),
    tmtPengangkatan: findCol((h) => h.includes('tmt pengangkatan')),
    tmtKerja: findCol((h) => h === 'tmt kerja' || h.includes('tmt kerja')),
    pangkatGolongan: findCol((h) => h.includes('pangkat') || h.includes('golongan')),
    nik: findCol((h) => h === 'nik'),
    noKk: findCol((h) => h === 'no kk' || h === 'no. kk' || h.includes('kartu keluarga')),
    namaIbuKandung: findCol((h) => h.includes('ibu kandung') || h === 'nama ibu'),
    npwp: findCol((h) => h === 'npwp'),
    gelarDepan: findCol((h) => h.includes('gelar depan')),
    gelarBelakang: findCol((h) => h.includes('gelar belakang')),
    jenjang: findCol((h) => h === 'jenjang'),
    jurusanProdi: findCol((h) => h.includes('jurusan')),
    sertifikasi: findCol((h) => h === 'sertifikasi'),
    mengajar: findCol((h) => h === 'mengajar'),
    jamTugasTambahan: findCol((h) => h.includes('jam tugas tambahan')),
    jjm: findCol((h) => h === 'jjm'),
    totalJjm: findCol((h) => h === 'total jjm'),
    jumlahSiswa: findCol((h) => h === 'siswa'),
    kompetensi: findCol((h) => h === 'kompetensi'),
  };

  if (colMap.nama < 0) {
    throw new Error('Kolom "Nama" tidak ditemukan pada file GTK. Gunakan format Unduhan Daftar GTK Dapodik.');
  }

  const gtkList: DapodikGtk[] = [];
  let skippedRows = 0;
  const dataStartRow = headerRowIndex + (hasSubHeaderRow ? 2 : 1);

  for (let r = dataStartRow; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const getRaw = (idx: number) => (idx >= 0 ? row[idx] : '');
    const getStr = (idx: number) => String(getRaw(idx) ?? '').trim();

    const nama = getStr(colMap.nama);
    if (!nama) {
      skippedRows++;
      continue;
    }

    const jkRaw = getStr(colMap.jk).toUpperCase();
    const tmtKerja = parseDapodikDate(getRaw(colMap.tmtKerja));
    const tmtPengangkatan = parseDapodikDate(getRaw(colMap.tmtPengangkatan)) || tmtKerja;
    const baseGtk: DapodikGtk = {
      id: `gtk-imp-${Date.now()}-${r}`,
      nama,
      nuptk: normalizeIdCell(getRaw(colMap.nuptk), 16),
      jk: jkRaw.startsWith('P') ? 'P' : 'L',
      tempatLahir: getStr(colMap.tempatLahir) || 'Surabaya',
      tanggalLahir: parseDapodikDate(getRaw(colMap.tanggalLahir)),
      nip: normalizeIdCell(getRaw(colMap.nip), 18),
      statusKepegawaian: normalizeKepegawaian(getStr(colMap.statusKepegawaian)),
      jenisPtk: normalizeJenisPtk(getStr(colMap.jenisPtk) || getStr(colMap.jabatanPtk)),
      agama: normalizeReligion(getStr(colMap.agama)),
      alamatJalan: getStr(colMap.alamatJalan),
      rt: normalizeIdCell(getRaw(colMap.rt)),
      rw: normalizeIdCell(getRaw(colMap.rw)),
      kelurahan: getStr(colMap.kelurahan),
      kecamatan: getStr(colMap.kecamatan),
      kodePos: normalizeIdCell(getRaw(colMap.kodePos)),
      hp: normalizeIdCell(getRaw(colMap.hp)),
      email: getStr(colMap.email),
      tugasTambahan: getStr(colMap.tugasTambahan),
      statusTugas: getStr(colMap.statusTugas).toLowerCase().includes('non') ? 'Non-Induk' : 'Induk',
      skPengangkatan: getStr(colMap.skPengangkatan),
      tmtPengangkatan,
      pangkatGolongan: getStr(colMap.pangkatGolongan),
      nik: normalizeIdCell(getRaw(colMap.nik), 16),
      noKk: normalizeIdCell(getRaw(colMap.noKk), 16),
      namaIbuKandung: getStr(colMap.namaIbuKandung),
      npwp: normalizeIdCell(getRaw(colMap.npwp)),
      gelarDepan: getStr(colMap.gelarDepan),
      gelarBelakang: getStr(colMap.gelarBelakang),
      jenjang: getStr(colMap.jenjang),
      jurusanProdi: getStr(colMap.jurusanProdi),
      sertifikasi: getStr(colMap.sertifikasi),
      tmtKerja,
      mengajar: getStr(colMap.mengajar),
      jamTugasTambahan: getStr(colMap.jamTugasTambahan),
      jjm: getStr(colMap.jjm),
      totalJjm: getStr(colMap.totalJjm),
      jumlahSiswa: getStr(colMap.jumlahSiswa),
      kompetensi: getStr(colMap.kompetensi),
      jabatanPtk: getStr(colMap.jabatanPtk),
      dukcapilStatus: 'Residu Data',
      dukcapilNotes: '',
      dukcapilCheckedAt: new Date().toISOString(),
    };

    gtkList.push(applyDispendukcapilCheck(baseGtk));
  }

  return {
    gtkList,
    detectedHeaders: rawHeaders.filter(Boolean),
    headerRowIndex,
    skippedRows,
  };
}
