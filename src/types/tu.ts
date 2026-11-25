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

export type WorkspaceTab = 'beranda' | 'ajukan' | 'antrean' | 'dapodik' | 'agenda' | 'cetak';

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
