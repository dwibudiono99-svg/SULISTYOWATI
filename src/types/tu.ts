export type ServiceCategoryId =
  | 'surat-aktif'
  | 'legalisir'
  | 'mutasi'
  | 'rekomendasi'
  | 'izin-kegiatan'
  | 'perbaikan-data'
  | 'surat-tugas';

export type ApplicantRole = 'Siswa' | 'Alumni' | 'Guru / Tendik' | 'Orang Tua / Wali';

export type RequestStatus =
  | 'Diajukan'
  | 'Verifikasi Berkas'
  | 'Proses Pengetikan'
  | 'Menunggu TTD Kepala Sekolah'
  | 'Siap Diambil'
  | 'Selesai'
  | 'Perlu Perbaikan';

export type AgendaType = 'Surat Masuk' | 'Surat Keluar';

export type LetterClassification = 'Biasa' | 'Penting' | 'Segera';

export type WorkspaceTab =
  | 'beranda'
  | 'ajukan'
  | 'antrean'
  | 'dapodik'
  | 'gtk'
  | 'rombel'
  | 'agenda'
  | 'cetak';

export type UserMode = 'pemohon' | 'petugas';

export type StudentGender = 'L' | 'P';

export type StudentStatus = 'Aktif' | 'Mutasi Keluar' | 'Lulus' | 'Mengundurkan Diri';

export type DapodikValidationLevel = 'Valid' | 'Residu' | 'Invalid';

export interface DapodikStudent {
  id: string;
  // 1. Identitas Peserta Didik
  nama: string;
  nipd: string;
  jk: StudentGender;
  nisn: string;
  tempatLahir: string;
  tanggalLahir: string;
  nik: string;
  noKk: string;
  noAktaLahir: string;
  agama: 'Islam' | 'Kristen' | 'Katolik' | 'Hindu' | 'Buddha' | 'Konghucu';
  kewarganegaraan: 'WNI' | 'WNA';
  berkebutuhanKhusus: string;
  anakKeBerapa: number;
  // 2. Alamat & Periodik & Kesejahteraan
  alamatJalan: string;
  rt: string;
  rw: string;
  dusun: string;
  kelurahan: string;
  kecamatan: string;
  kodePos: string;
  lintang: string;
  bujur: string;
  jenisTinggal: 'Bersama Orang Tua' | 'Wali' | 'Kos' | 'Asrama' | 'Panti Asuhan';
  alatTransportasi: 'Jalan Kaki' | 'Sepeda' | 'Sepeda Motor' | 'Angkutan Umum' | 'Mobil Pribadi';
  telepon: string;
  hp: string;
  email: string;
  tinggiBadanCm: number;
  beratBadanKg: number;
  lingkarKepalaCm: number;
  jarakSekolahKm: number;
  waktuTempuhMenit: number;
  jumlahSaudaraKandung: number;
  penerimaKps: boolean;
  noKps: string;
  penerimaKip: boolean;
  noKip: string;
  namaDiKip: string;
  nomorKks: string;
  layakPip: boolean;
  alasanLayakPip: string;
  bank: string;
  nomorRekeningBank: string;
  rekeningAtasNama: string;
  // 3. Data Orang Tua / Wali
  namaAyah: string;
  nikAyah: string;
  tahunLahirAyah: string;
  pendidikanAyah: string;
  pekerjaanAyah: string;
  penghasilanAyah: string;
  namaIbu: string; // Wajib di Dapodik (kunci VervalPD)
  nikIbu: string;
  tahunLahirIbu: string;
  pendidikanIbu: string;
  pekerjaanIbu: string;
  penghasilanIbu: string;
  namaWali: string;
  tahunLahirWali: string;
  pendidikanWali: string;
  pekerjaanWali: string;
  penghasilanWali: string;
  nikWali: string;
  // 4. Registrasi & Rombel
  rombelSaatIni: string;
  tingkatKelas: 'X' | 'XI' | 'XII' | 'Alumni';
  kurikulum: 'Kurikulum Merdeka' | 'Kurikulum 2013';
  jenisPendaftaran: 'Siswa Baru' | 'Pindahan';
  tanggalMasuk: string;
  asalSmp: string;
  skhun: string;
  noPesertaUn: string;
  noSeriIjazahSmp: string;
  statusSiswa: StudentStatus;
  vervalPdSyncAt: string;
}

export interface DapodikValidationResult {
  level: DapodikValidationLevel;
  invalidFields: string[];
  warningFields: string[];
}

export interface ServiceCatalogItem {
  id: ServiceCategoryId;
  code: string;
  title: string;
  shortTitle: string;
  slaDays: number;
  targetAudience: string;
  description: string;
  requirements: string[];
  samplePurposes: string[];
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  status: RequestStatus;
  actor: string;
  note: string;
}

export interface RequestParticipant {
  id: string;
  nama: string;
  identityNumber: string;
  classOrCohort: string;
  roleLabel?: string;
}

export interface ServiceRequest {
  id: string;
  serviceId: ServiceCategoryId;
  serviceTitle: string;
  applicantName: string;
  applicantRole: ApplicantRole;
  identityNumber: string;
  classOrCohort: string;
  phone: string;
  purpose: string;
  notes: string;
  participants?: RequestParticipant[];
  submittedRequirements: string[];
  status: RequestStatus;
  letterNumber?: string;
  assignedStaff: string;
  createdAt: string;
  updatedAt: string;
  estimatedReadyAt: string;
  revisionNote?: string;
  timeline: TimelineEvent[];
}

export interface AgendaEntry {
  id: string;
  type: AgendaType;
  agendaNumber: string;
  letterNumber: string;
  letterDate: string;
  recordedDate: string;
  counterparty: string;
  subject: string;
  classification: LetterClassification;
  disposition: string;
  relatedTicketId?: string;
}

export type KopSuratMode = 'custom' | 'upload-banner';

export type KopDividerStyle = 'double' | 'thick-thin' | 'single';

export interface KopSuratConfig {
  showKopSurat: boolean;
  mode: KopSuratMode;
  bannerImageDataUrl: string;
  leftLogoDataUrl: string;
  rightLogoDataUrl: string;
  provinceLine: string;
  departmentLine: string;
  schoolNameLine: string;
  addressLine: string;
  contactLine: string;
  websiteLine: string;
  dividerStyle: KopDividerStyle;
  cityName: string;
  principalTitle: string;
  principalName: string;
  principalNip: string;
}

export interface ReportingPortalConfig {
  isOpen: boolean;
  closedMessage: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TuStaffOperator {
  gtkId: string;
  nama: string;
  nip: string;
  jabatan: string;
  fotoDataUrl?: string;
  isActive: boolean;
  updatedAt: string;
}

export interface TuStaffConfig {
  isEnabled: boolean;
  activeGtkId: string | null;
  activeStaffName: string;
  activeStaffNip: string;
  activeStaffRole: string;
  activeStaffPhoto: string;
  deactivatedReason: string;
  operators: TuStaffOperator[];
  updatedAt: string;
  updatedBy: string;
}

export interface PublicTuStaffInfo {
  isEnabled: boolean;
  activeStaffName: string;
  activeStaffRole: string;
  activeStaffPhoto: string;
  deactivatedReason: string;
  updatedAt: string;
}

export type DukcapilMatchStatus = 'Padan Dispendukcapil' | 'Residu Data' | 'Tidak Padan NIK';

export interface DapodikGtk {
  id: string;
  nama: string;
  nuptk: string;
  jk: StudentGender;
  tempatLahir: string;
  tanggalLahir: string;
  nip: string;
  statusKepegawaian:
    | 'PNS'
    | 'PPPK'
    | 'PPPK Paruh Waktu'
    | 'CPNS'
    | 'GTY/PTY'
    | 'Guru Honor Sekolah'
    | 'Tenaga Honor Sekolah';
  jenisPtk:
    | 'Guru'
    | 'Guru Mapel'
    | 'Guru BK'
    | 'Kepala Sekolah'
    | 'Tenaga Kependidikan'
    | 'Tenaga Administrasi Sekolah'
    | 'Pustakawan'
    | 'Laboran'
    | 'Penjaga Sekolah';
  agama: 'Islam' | 'Kristen' | 'Katolik' | 'Hindu' | 'Buddha' | 'Konghucu';
  alamatJalan: string;
  rt: string;
  rw: string;
  kelurahan: string;
  kecamatan: string;
  kodePos: string;
  hp: string;
  email: string;
  tugasTambahan: string;
  statusTugas: 'Induk' | 'Non-Induk';
  skPengangkatan: string;
  tmtPengangkatan: string;
  pangkatGolongan: string;
  nik: string;
  noKk: string;
  namaIbuKandung: string;
  npwp: string;
  fotoDataUrl?: string;
  gelarDepan?: string;
  gelarBelakang?: string;
  jenjang?: string;
  jurusanProdi?: string;
  sertifikasi?: string;
  tmtKerja?: string;
  mengajar?: string;
  jamTugasTambahan?: string;
  jjm?: string;
  totalJjm?: string;
  jumlahSiswa?: string;
  kompetensi?: string;
  jabatanPtk?: string;
  dukcapilStatus: DukcapilMatchStatus;
  dukcapilNotes: string;
  dukcapilCheckedAt: string;
}

export interface DapodikRombel {
  id: string;
  namaRombel: string;
  tingkatKelas: '10' | '11' | '12';
  jumlahL: number;
  jumlahP: number;
  jumlahTotal: number;
  waliKelasId?: string;
  waliKelasNama: string;
  kurikulum: string;
  ruangan: string;
  updatedAt?: string;
}
