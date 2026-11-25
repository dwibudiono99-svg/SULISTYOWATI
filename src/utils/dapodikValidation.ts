import * as XLSX from 'xlsx';
import { DapodikStudent, DapodikValidationResult } from '../types/tu';

const DIGITS_ONLY = /^\d+$/;

export const DAPODIK_EXCEL_HEADERS = [
  'No',
  'Nama',
  'NIPD',
  'JK',
  'NISN',
  'Tempat Lahir',
  'Tanggal Lahir',
  'NIK',
  'Agama',
  'Alamat',
  'RT',
  'RW',
  'Dusun',
  'Kelurahan',
  'Kecamatan',
  'Kode Pos',
  'Jenis Tinggal',
  'Alat Transportasi',
  'Telepon',
  'HP',
  'E-Mail',
  'SKHUN',
  'Penerima KPS',
  'No. KPS',
  'Nama Ayah',
  'Tahun Lahir',
  'Jenjang Pendidikan',
  'Pekerjaan',
  'Penghasilan',
  'NIK Ayah',
  'Nama Ibu',
  'Tahun Lahir',
  'Jenjang Pendidikan',
  'Pekerjaan',
  'Penghasilan',
  'NIK Ibu',
  'Nama Wali',
  'Tahun Lahir',
  'Jenjang Pendidikan',
  'Pekerjaan',
  'Penghasilan',
  'NIK Wali',
  'Rombel Saat Ini',
  'No Peserta Ujian Nasional',
  'No Seri Ijazah',
  'Penerima KIP',
  'Nomor KIP',
  'Nama di KIP',
  'Nomor KKS',
  'No Registrasi Akta Lahir',
  'Bank',
  'Nomor Rekening Bank',
  'Rekening Atas Nama',
  'Layak PIP (usulan dari sekolah)',
  'Alasan Layak PIP',
  'Kebutuhan Khusus',
  'Sekolah Asal',
  'Anak ke-berapa',
  'Lintang',
  'Bujur',
  'No KK',
  'Berat Badan',
  'Tinggi Badan',
  'Lingkar Kepala',
  'Jml. Saudara Kandung',
  'Jarak Rumah ke Sekolah (KM)',
] as const;

export function isValid16DigitId(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 16 && DIGITS_ONLY.test(trimmed);
}

export function isValid10DigitNisn(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 10 && DIGITS_ONLY.test(trimmed);
}

export function validateDapodikStudent(student: DapodikStudent): DapodikValidationResult {
  const invalidFields: string[] = [];
  const warningFields: string[] = [];

  if (!student.nama.trim() || student.nama.trim().length < 3) {
    invalidFields.push('Nama Lengkap sesuai Akta/Ijazah wajib diisi.');
  }
  if (!isValid10DigitNisn(student.nisn)) {
    invalidFields.push('NISN harus tepat 10 digit angka.');
  }
  if (!isValid16DigitId(student.nik)) {
    invalidFields.push('NIK Peserta Didik harus tepat 16 digit angka (aturan Dukcapil).');
  }
  if (!isValid16DigitId(student.noKk)) {
    invalidFields.push('Nomor Kartu Keluarga (KK) harus tepat 16 digit angka.');
  }
  if (!student.tempatLahir.trim() || !student.tanggalLahir.trim()) {
    invalidFields.push('Tempat dan Tanggal Lahir wajib dilengkapi.');
  }
  if (!student.namaIbu.trim()) {
    invalidFields.push('Nama Ibu Kandung wajib diisi sebagai kunci padan VervalPD.');
  }
  if (student.statusSiswa === 'Aktif' && !student.rombelSaatIni.trim()) {
    invalidFields.push('Rombongan Belajar (Kelas) wajib ditetapkan untuk siswa aktif.');
  }
  if (!student.asalSmp.trim()) {
    invalidFields.push('Sekolah Asal (SMP/MTs) wajib diisi.');
  }

  if (!student.noAktaLahir.trim()) {
    warningFields.push('Nomor Registrasi Akta Kelahiran belum diisi.');
  }
  if (student.nikIbu.trim() && !isValid16DigitId(student.nikIbu)) {
    warningFields.push('NIK Ibu Kandung tidak 16 digit.');
  } else if (!student.nikIbu.trim()) {
    warningFields.push('NIK Ibu Kandung belum dilengkapi.');
  }
  if (student.namaAyah.trim() && !isValid16DigitId(student.nikAyah)) {
    warningFields.push('NIK Ayah belum dilengkapi 16 digit.');
  }
  if (!student.alamatJalan.trim() || !student.rt.trim() || !student.rw.trim()) {
    warningFields.push('Alamat Jalan atau RT/RW belum lengkap.');
  }
  if (!student.email.trim()) {
    warningFields.push('Email / Akun belajar.id siswa belum tercatat.');
  }
  if (!student.noSeriIjazahSmp.trim()) {
    warningFields.push('Nomor Seri Ijazah SMP/MTs belum diinput.');
  }

  const level =
    invalidFields.length > 0
      ? 'Invalid'
      : warningFields.length > 0
        ? 'Residu'
        : 'Valid';

  return { level, invalidFields, warningFields };
}

function formatDapodikDateDisplay(iso: string): string {
  if (!iso) return '';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function studentToDapodikRowArray(student: DapodikStudent, index: number): (string | number)[] {
  return [
    index + 1,
    student.nama,
    student.nipd,
    student.jk,
    student.nisn,
    student.tempatLahir,
    formatDapodikDateDisplay(student.tanggalLahir),
    student.nik,
    student.agama,
    student.alamatJalan,
    student.rt,
    student.rw,
    student.dusun,
    student.kelurahan,
    student.kecamatan,
    student.kodePos,
    student.jenisTinggal,
    student.alatTransportasi,
    student.telepon,
    student.hp,
    student.email,
    student.skhun,
    student.penerimaKps ? 'Ya' : 'Tidak',
    student.noKps,
    student.namaAyah,
    student.tahunLahirAyah,
    student.pendidikanAyah,
    student.pekerjaanAyah,
    student.penghasilanAyah,
    student.nikAyah,
    student.namaIbu,
    student.tahunLahirIbu,
    student.pendidikanIbu,
    student.pekerjaanIbu,
    student.penghasilanIbu,
    student.nikIbu,
    student.namaWali,
    student.tahunLahirWali,
    student.pendidikanWali,
    student.pekerjaanWali,
    student.penghasilanWali,
    student.nikWali,
    student.rombelSaatIni,
    student.noPesertaUn,
    student.noSeriIjazahSmp,
    student.penerimaKip ? 'Ya' : 'Tidak',
    student.noKip,
    student.namaDiKip,
    student.nomorKks,
    student.noAktaLahir,
    student.bank,
    student.nomorRekeningBank,
    student.rekeningAtasNama,
    student.layakPip ? 'Ya' : 'Tidak',
    student.alasanLayakPip,
    student.berkebutuhanKhusus,
    student.asalSmp,
    student.anakKeBerapa,
    student.lintang,
    student.bujur,
    student.noKk,
    student.beratBadanKg,
    student.tinggiBadanCm,
    student.lingkarKepalaCm,
    student.jumlahSaudaraKandung,
    student.jarakSekolahKm,
  ];
}

export function studentsToDapodikCsv(students: DapodikStudent[]): string {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = students.map((s, idx) =>
    studentToDapodikRowArray(s, idx).map(escapeCell).join(',')
  );

  return '\uFEFF' + [DAPODIK_EXCEL_HEADERS.join(','), ...rows].join('\n');
}

export function exportDapodikWorkbook(students: DapodikStudent[], templateOnly = false): void {
  const aoa: (string | number)[][] = [
    [...DAPODIK_EXCEL_HEADERS],
    ...(templateOnly
      ? []
      : students.map((student, idx) => studentToDapodikRowArray(student, idx))),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set column widths and force text type ('s') on long numeric IDs so Excel never turns them into E+ notation
  const textColIndices = new Set([2, 4, 7, 10, 11, 15, 18, 19, 23, 29, 35, 41, 46, 48, 51, 60]);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = 1; r <= range.e.r; r++) {
    for (const c of textColIndices) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && cell.v !== undefined && cell.v !== '') {
        cell.t = 's';
        cell.v = String(cell.v);
        cell.z = '@';
      }
    }
  }

  ws['!cols'] = DAPODIK_EXCEL_HEADERS.map((h) => ({
    wch: Math.max(h.length + 3, 14),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Peserta Didik');
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = templateOnly
    ? `template-dapodik-66-kolom-sman9sby.xlsx`
    : `dapodik-peserta-didik-sman9sby-${dateTag}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function normalizeIdCell(raw: unknown, expectedMinLength = 0): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  if (!str) return '';

  // Handle localized scientific notation e.g. "3,095E+09" or "3.095E+09"
  if (/^\d+([.,]\d+)?[eE][+-]?\d+$/.test(str)) {
    const parsed = Number(str.replace(',', '.'));
    if (!Number.isNaN(parsed)) {
      str = Math.round(parsed).toString();
    }
  }

  // Strip trailing .0 from Excel float cells
  str = str.replace(/\.0+$/, '');

  if (expectedMinLength === 10 && /^\d{8,9}$/.test(str)) {
    return str.padStart(10, '0');
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
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const ymd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  return str;
}

function normalizeReligion(raw: string): DapodikStudent['agama'] {
  const lower = raw.toLowerCase();
  if (lower.includes('kristen')) return 'Kristen';
  if (lower.includes('katolik')) return 'Katolik';
  if (lower.includes('hindu')) return 'Hindu';
  if (lower.includes('bud')) return 'Buddha';
  if (lower.includes('kong')) return 'Konghucu';
  return 'Islam';
}

function normalizeLiving(raw: string): DapodikStudent['jenisTinggal'] {
  const lower = raw.toLowerCase();
  if (lower.includes('wali')) return 'Wali';
  if (lower.includes('kos')) return 'Kos';
  if (lower.includes('asrama')) return 'Asrama';
  if (lower.includes('panti')) return 'Panti Asuhan';
  return 'Bersama Orang Tua';
}

function normalizeTransport(raw: string): DapodikStudent['alatTransportasi'] {
  const lower = raw.toLowerCase();
  if (lower.includes('jalan')) return 'Jalan Kaki';
  if (lower.includes('motor')) return 'Sepeda Motor';
  if (lower.includes('sepeda')) return 'Sepeda';
  if (lower.includes('mobil')) return 'Mobil Pribadi';
  return 'Angkutan Umum';
}

function parseYesNo(raw: unknown): boolean {
  const str = String(raw ?? '').trim().toLowerCase();
  return str === 'ya' || str === 'true' || str === '1';
}

function inferTingkatKelas(rombel: string): DapodikStudent['tingkatKelas'] {
  const upper = rombel.trim().toUpperCase();
  if (upper.startsWith('XII')) return 'XII';
  if (upper.startsWith('XI')) return 'XI';
  if (upper.includes('ALUMNI') || upper.includes('LULUS')) return 'Alumni';
  return 'X';
}

export interface ParsedDapodikImport {
  students: DapodikStudent[];
  detectedHeaders: string[];
  headerRowIndex: number;
  skippedRows: number;
}

export async function parseDapodikFile(file: File): Promise<ParsedDapodikImport> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File tidak memiliki sheet data yang dapat dibaca.');
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

  // Scan top 15 rows to locate the Dapodik header row containing "Nama" and ("NIPD" or "NISN" or "NIK")
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const rowStrings = (aoa[i] || []).map((cell) => String(cell ?? '').trim().toLowerCase());
    const hasNama = rowStrings.some((h) => h === 'nama' || h === 'nama lengkap');
    const hasId = rowStrings.some(
      (h) => h.includes('nipd') || h.includes('nisn') || h === 'nik'
    );
    if (hasNama && hasId) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = (aoa[headerRowIndex] || []).map((cell) => String(cell ?? '').trim());
  const normalizedHeaders = rawHeaders.map((h) => h.toLowerCase());

  // Build occurrence-aware column lookup (Ayah=0, Ibu=1, Wali=2 for repeated headers)
  const findCol = (predicate: (h: string) => boolean, occurrence = 0): number => {
    let seen = 0;
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (predicate(normalizedHeaders[i])) {
        if (seen === occurrence) return i;
        seen++;
      }
    }
    return -1;
  };

  const colMap = {
    nama: findCol((h) => h === 'nama' || h === 'nama lengkap'),
    nipd: findCol((h) => h.includes('nipd') || h === 'nis'),
    jk: findCol((h) => h === 'jk' || h.includes('kelamin')),
    nisn: findCol((h) => h === 'nisn'),
    tempatLahir: findCol((h) => h.includes('tempat lahir')),
    tanggalLahir: findCol((h) => h.includes('tanggal lahir') || h.includes('tgl lahir')),
    nik: findCol((h) => h === 'nik'),
    agama: findCol((h) => h === 'agama'),
    alamat: findCol((h) => h === 'alamat' || h === 'alamat jalan'),
    rt: findCol((h) => h === 'rt'),
    rw: findCol((h) => h === 'rw'),
    dusun: findCol((h) => h === 'dusun'),
    kelurahan: findCol((h) => h.includes('kelurahan') || h.includes('desa')),
    kecamatan: findCol((h) => h.includes('kecamatan')),
    kodePos: findCol((h) => h.includes('kode pos')),
    jenisTinggal: findCol((h) => h.includes('jenis tinggal')),
    alatTransportasi: findCol((h) => h.includes('transport')),
    telepon: findCol((h) => h === 'telepon'),
    hp: findCol((h) => h === 'hp' || h.includes('no. hp')),
    email: findCol((h) => h.includes('mail')),
    skhun: findCol((h) => h === 'skhun'),
    penerimaKps: findCol((h) => h.includes('penerima kps')),
    noKps: findCol((h) => h.includes('no. kps') || h.includes('no kps')),

    namaAyah: findCol((h) => h.includes('nama ayah')),
    tahunLahirAyah: findCol((h) => h.includes('tahun lahir'), 0),
    pendidikanAyah: findCol((h) => h.includes('jenjang pendidikan') || h.includes('pendidikan'), 0),
    pekerjaanAyah: findCol((h) => h.includes('pekerjaan'), 0),
    penghasilanAyah: findCol((h) => h.includes('penghasilan'), 0),
    nikAyah: findCol((h) => h.includes('nik ayah')),

    namaIbu: findCol((h) => h.includes('nama ibu')),
    tahunLahirIbu: findCol((h) => h.includes('tahun lahir'), 1),
    pendidikanIbu: findCol((h) => h.includes('jenjang pendidikan') || h.includes('pendidikan'), 1),
    pekerjaanIbu: findCol((h) => h.includes('pekerjaan'), 1),
    penghasilanIbu: findCol((h) => h.includes('penghasilan'), 1),
    nikIbu: findCol((h) => h.includes('nik ibu')),

    namaWali: findCol((h) => h.includes('nama wali')),
    tahunLahirWali: findCol((h) => h.includes('tahun lahir'), 2),
    pendidikanWali: findCol((h) => h.includes('jenjang pendidikan') || h.includes('pendidikan'), 2),
    pekerjaanWali: findCol((h) => h.includes('pekerjaan'), 2),
    penghasilanWali: findCol((h) => h.includes('penghasilan'), 2),
    nikWali: findCol((h) => h.includes('nik wali')),

    rombel: findCol((h) => h.includes('rombel')),
    noPesertaUn: findCol((h) => h.includes('peserta ujian')),
    noSeriIjazah: findCol((h) => h.includes('seri ijazah')),
    penerimaKip: findCol((h) => h.includes('penerima kip')),
    nomorKip: findCol((h) => h.includes('nomor kip') || h.includes('no kip')),
    namaDiKip: findCol((h) => h.includes('nama di kip')),
    nomorKks: findCol((h) => h.includes('nomor kks')),
    noAktaLahir: findCol((h) => h.includes('akta lahir')),
    bank: findCol((h) => h === 'bank'),
    nomorRekening: findCol((h) => h.includes('rekening bank') || h.includes('nomor rekening')),
    rekeningAtasNama: findCol((h) => h.includes('atas nama')),
    layakPip: findCol((h) => h.includes('layak pip')),
    alasanLayakPip: findCol((h) => h.includes('alasan layak')),
    kebutuhanKhusus: findCol((h) => h.includes('kebutuhan khusus')),
    sekolahAsal: findCol((h) => h.includes('sekolah asal') || h.includes('asal smp')),
    anakKe: findCol((h) => h.includes('anak ke')),
    lintang: findCol((h) => h === 'lintang'),
    bujur: findCol((h) => h === 'bujur'),
    noKk: findCol((h) => h === 'no kk' || h === 'no. kk'),
    beratBadan: findCol((h) => h.includes('berat badan')),
    tinggiBadan: findCol((h) => h.includes('tinggi badan')),
    lingkarKepala: findCol((h) => h.includes('lingkar kepala')),
    jmlSaudara: findCol((h) => h.includes('saudara')),
    jarakRumah: findCol((h) => h.includes('jarak rumah')),
  };

  if (colMap.nama < 0) {
    throw new Error('Kolom "Nama" tidak ditemukan pada file unggahan. Gunakan format header Dapodik.');
  }

  const students: DapodikStudent[] = [];
  let skippedRows = 0;

  for (let r = headerRowIndex + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const getRaw = (idx: number) => (idx >= 0 ? row[idx] : '');
    const getStr = (idx: number) => String(getRaw(idx) ?? '').trim();

    const nama = getStr(colMap.nama);
    if (!nama) {
      skippedRows++;
      continue;
    }

    const rombel = getStr(colMap.rombel) || 'X-1';
    const jkRaw = getStr(colMap.jk).toUpperCase();

    students.push({
      id: `pd-imp-${Date.now()}-${r}`,
      nama,
      nipd: normalizeIdCell(getRaw(colMap.nipd)),
      jk: jkRaw.startsWith('P') ? 'P' : 'L',
      nisn: normalizeIdCell(getRaw(colMap.nisn), 10),
      tempatLahir: getStr(colMap.tempatLahir) || 'Surabaya',
      tanggalLahir: parseDapodikDate(getRaw(colMap.tanggalLahir)),
      nik: normalizeIdCell(getRaw(colMap.nik), 16),
      noKk: normalizeIdCell(getRaw(colMap.noKk), 16),
      noAktaLahir: getStr(colMap.noAktaLahir),
      agama: normalizeReligion(getStr(colMap.agama)),
      kewarganegaraan: 'WNI',
      berkebutuhanKhusus: getStr(colMap.kebutuhanKhusus) || 'Tidak Ada',
      anakKeBerapa: Number(getRaw(colMap.anakKe)) || 1,
      alamatJalan: getStr(colMap.alamat),
      rt: normalizeIdCell(getRaw(colMap.rt)),
      rw: normalizeIdCell(getRaw(colMap.rw)),
      dusun: getStr(colMap.dusun),
      kelurahan: getStr(colMap.kelurahan),
      kecamatan: getStr(colMap.kecamatan),
      kodePos: normalizeIdCell(getRaw(colMap.kodePos)),
      lintang: getStr(colMap.lintang),
      bujur: getStr(colMap.bujur),
      jenisTinggal: normalizeLiving(getStr(colMap.jenisTinggal)),
      alatTransportasi: normalizeTransport(getStr(colMap.alatTransportasi)),
      telepon: normalizeIdCell(getRaw(colMap.telepon)),
      hp: normalizeIdCell(getRaw(colMap.hp)),
      email: getStr(colMap.email),
      tinggiBadanCm: Number(getRaw(colMap.tinggiBadan)) || 0,
      beratBadanKg: Number(getRaw(colMap.beratBadan)) || 0,
      lingkarKepalaCm: Number(getRaw(colMap.lingkarKepala)) || 0,
      jarakSekolahKm: Number(String(getRaw(colMap.jarakRumah) ?? '0').replace(',', '.')) || 0,
      waktuTempuhMenit: 15,
      jumlahSaudaraKandung: Number(getRaw(colMap.jmlSaudara)) || 0,
      penerimaKps: parseYesNo(getRaw(colMap.penerimaKps)),
      noKps: getStr(colMap.noKps),
      penerimaKip: parseYesNo(getRaw(colMap.penerimaKip)),
      noKip: getStr(colMap.nomorKip),
      namaDiKip: getStr(colMap.namaDiKip),
      nomorKks: getStr(colMap.nomorKks),
      layakPip: parseYesNo(getRaw(colMap.layakPip)),
      alasanLayakPip: getStr(colMap.alasanLayakPip),
      bank: getStr(colMap.bank),
      nomorRekeningBank: normalizeIdCell(getRaw(colMap.nomorRekening)),
      rekeningAtasNama: getStr(colMap.rekeningAtasNama),
      namaAyah: getStr(colMap.namaAyah),
      nikAyah: normalizeIdCell(getRaw(colMap.nikAyah), 16),
      tahunLahirAyah: normalizeIdCell(getRaw(colMap.tahunLahirAyah)),
      pendidikanAyah: getStr(colMap.pendidikanAyah) || 'SMA / Sederajat',
      pekerjaanAyah: getStr(colMap.pekerjaanAyah),
      penghasilanAyah: getStr(colMap.penghasilanAyah),
      namaIbu: getStr(colMap.namaIbu),
      nikIbu: normalizeIdCell(getRaw(colMap.nikIbu), 16),
      tahunLahirIbu: normalizeIdCell(getRaw(colMap.tahunLahirIbu)),
      pendidikanIbu: getStr(colMap.pendidikanIbu) || 'SMA / Sederajat',
      pekerjaanIbu: getStr(colMap.pekerjaanIbu),
      penghasilanIbu: getStr(colMap.penghasilanIbu),
      namaWali: getStr(colMap.namaWali),
      tahunLahirWali: normalizeIdCell(getRaw(colMap.tahunLahirWali)),
      pendidikanWali: getStr(colMap.pendidikanWali),
      pekerjaanWali: getStr(colMap.pekerjaanWali),
      penghasilanWali: getStr(colMap.penghasilanWali),
      nikWali: normalizeIdCell(getRaw(colMap.nikWali), 16),
      rombelSaatIni: rombel,
      tingkatKelas: inferTingkatKelas(rombel),
      kurikulum: 'Kurikulum Merdeka',
      jenisPendaftaran: 'Siswa Baru',
      tanggalMasuk: '2026-07-13',
      asalSmp: getStr(colMap.sekolahAsal),
      skhun: getStr(colMap.skhun),
      noPesertaUn: normalizeIdCell(getRaw(colMap.noPesertaUn)),
      noSeriIjazahSmp: getStr(colMap.noSeriIjazah),
      statusSiswa: inferTingkatKelas(rombel) === 'Alumni' ? 'Lulus' : 'Aktif',
      vervalPdSyncAt: new Date().toISOString(),
    });
  }

  return {
    students,
    detectedHeaders: rawHeaders.filter(Boolean),
    headerRowIndex,
    skippedRows,
  };
}
