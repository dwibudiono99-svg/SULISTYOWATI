import {
  BackupSettingsConfig,
  KopSuratConfig,
  ReportingPortalConfig,
  ServiceCatalogItem,
  TuStaffConfig,
} from '../types/tu';

export const SCHOOL_INFO = {
  province: 'PEMERINTAH PROVINSI JAWA TIMUR',
  department: 'DINAS PENDIDIKAN',
  name: 'SMA NEGERI 9 SURABAYA',
  shortName: 'SMAN 9 Surabaya',
  address: 'Jalan Wijayakusuma Nomor 48, Ketabang, Genteng, Surabaya, Jawa Timur 60272',
  phone: '(031) 5342608',
  fax: '(031) 5477817',
  npsn: '20532263',
  email: 'smanixsurabaya@gmail.com',
  website: 'https://sman9sby.sch.id',
  publicPortalUrl: 'https://ais-pre-ragqtjuelmbea42z537m6f-73250755094.asia-southeast1.run.app',
  serviceHours: 'Senin – Kamis 07.00 – 15.30 WIB · Jumat 07.00 – 14.30 WIB',
  campusImage: '/src/assets/images/sman9_campus_facade_1795598581053.jpg',
  staffAvatar: '/src/assets/images/tu_staff_avatar_1795598580710.jpg',
  staffName: 'Sulistyowati, S.Pd.',
  staffRole: 'Koordinator Pelayanan Tata Usaha',
};

export const DEFAULT_KOP_SURAT_CONFIG: KopSuratConfig = {
  showKopSurat: true,
  mode: 'custom',
  bannerImageDataUrl: '',
  leftLogoDataUrl: '/assets/logo-jatim-sman9.png',
  rightLogoDataUrl: '',
  provinceLine: SCHOOL_INFO.province,
  departmentLine: SCHOOL_INFO.department,
  schoolNameLine: SCHOOL_INFO.name,
  addressLine: SCHOOL_INFO.address,
  contactLine: `Telepon ${SCHOOL_INFO.phone} - Faksimili ${SCHOOL_INFO.fax}`,
  websiteLine: `Laman : sman9sby.sch.id  Surel : ${SCHOOL_INFO.email}, NPSN : ${SCHOOL_INFO.npsn}`,
  dividerStyle: 'thick-thin',
  cityName: 'Surabaya',
  principalTitle: 'Kepala Sekolah,',
  principalName: 'TRI KURNIAWATI, S.Pd., M.M., M.Pd.',
  principalNip: '197203251997032003',
};

export const DEFAULT_REPORTING_PORTAL_CONFIG: ReportingPortalConfig = {
  isOpen: true,
  closedMessage:
    'Pelayanan pengajuan permohonan Tata Usaha secara daring sedang ditutup sementara (di luar jam kerja loket atau pemeliharaan berkas). Silakan pantau tiket berjalan atau ajukan kembali saat loket dibuka.',
  updatedAt: '2026-11-25T07:00:00+07:00',
  updatedBy: 'Sulistyowati, S.Pd.',
};

export const DEFAULT_TU_STAFF_CONFIG: TuStaffConfig = {
  isEnabled: true,
  activeGtkId: null,
  activeStaffName: SCHOOL_INFO.staffName,
  activeStaffNip: '',
  activeStaffRole: SCHOOL_INFO.staffRole,
  activeStaffPhoto: SCHOOL_INFO.staffAvatar,
  deactivatedReason: '',
  operators: [],
  updatedAt: '2026-11-25T07:00:00+07:00',
  updatedBy: SCHOOL_INFO.staffName,
};

export const DEFAULT_BACKUP_SETTINGS_CONFIG: BackupSettingsConfig = {
  targetEmail: SCHOOL_INFO.email,
  ccEmail: '',
  subjectPrefix: '[Backup SIP TU SMAN 9 Surabaya]',
  defaultScope: 'all',
  includeAttachmentFormat: 'json',
  lastBackupAt: '',
  lastBackupBy: '',
  lastEmailSentAt: '',
  lastEmailRecipient: '',
  updatedAt: '2026-11-25T07:00:00+07:00',
  updatedBy: SCHOOL_INFO.staffName,
};

export const TU_SERVICE_CATALOG: ServiceCatalogItem[] = [
  {
    id: 'surat-aktif',
    code: 'TU-01',
    title: 'Surat Keterangan Siswa Aktif',
    shortTitle: 'Siswa Aktif',
    slaDays: 1,
    targetAudience: 'Siswa & Orang Tua',
    description:
      'Penerbitan surat resmi keterangan masih aktif bersekolah untuk keperluan beasiswa, tunjangan gaji orang tua, KIP, atau administrasi perbankan.',
    requirements: [
      'Kartu Pelajar / Bukti Identitas Siswa (NIS & NISN)',
      'Fotokopi Kartu Keluarga (jika untuk tunjangan orang tua / instansi)',
      'Catatan nama instansi atau tujuan surat yang jelas',
    ],
    samplePurposes: [
      'Pengajuan Beasiswa Prestasi Pemerintah Kota Surabaya',
      'Kelengkapan Tunjangan Anak ASN Orang Tua',
      'Pembukaan Rekening Pelajar / PIP',
    ],
  },
  {
    id: 'legalisir',
    code: 'TU-02',
    title: 'Legalisir Ijazah, SKL & Rapor',
    shortTitle: 'Legalisir Dokumen',
    slaDays: 2,
    targetAudience: 'Alumni & Siswa',
    description:
      'Pengesahan fotokopi Ijazah, Surat Keterangan Lulus (SKL), atau Rapor oleh Kepala SMA Negeri 9 Surabaya untuk pendaftaran kuliah maupun melamar kerja.',
    requirements: [
      'Dokumen asli (Ijazah / SKL / Rapor) ditunjukkan saat verifikasi loket',
      'Fotokopi dokumen rapi sesuai jumlah lembar yang dilegalisir (maks. 10 lembar)',
      'Identitas pemohon (KTP / Kartu Pelajar)',
    ],
    samplePurposes: [
      'Pendaftaran SNBP / SNBT / Jalur Mandiri Perguruan Tinggi',
      'Seleksi CPNS / TNI / Polri / Rekrutmen BUMN',
      'Persyaratan Melamar Pekerjaan',
    ],
  },
  {
    id: 'mutasi',
    code: 'TU-03',
    title: 'Surat Keterangan Pindah Sekolah (Mutasi)',
    shortTitle: 'Mutasi Siswa',
    slaDays: 3,
    targetAudience: 'Siswa & Orang Tua',
    description:
      'Pengurusan berkas mutasi keluar termasuk Surat Keterangan Pindah, penarikan akun Dapodik, dan pengesahan rapor semester berjalan.',
    requirements: [
      'Surat Permohonan Mutasi bermaterai dari Orang Tua / Wali',
      'Surat Keterangan Diterima dari sekolah tujuan',
      'Buku Rapor asli lengkap sampai semester terakhir',
      'Surat Bebas Tanggungan Perpustakaan & Laboratorium',
    ],
    samplePurposes: [
      'Kepindahan domisili tugas orang tua ke luar kota',
      'Pindah satuan pendidikan antar SMA Negeri di Jawa Timur',
    ],
  },
  {
    id: 'rekomendasi',
    code: 'TU-04',
    title: 'Surat Rekomendasi & Pengantar Lomba',
    shortTitle: 'Rekomendasi',
    slaDays: 1,
    targetAudience: 'Siswa & Pembina',
    description:
      'Surat rekomendasi resmi sekolah untuk mengikuti kompetisi akademik/non-akademik, seleksi pertukaran pelajar, atau beasiswa prestasi.',
    requirements: [
      'Poster / Surat Undangan resmi penyelenggara kegiatan atau beasiswa',
      'Persetujuan guru pembina ekstrakurikuler atau wali kelas',
      'Data lengkap peserta (Nama, Kelas, NISN)',
    ],
    samplePurposes: [
      'Rekomendasi Olimpiade Sains Nasional (OSN) / Lomba Karya Ilmiah',
      'Rekomendasi Seleksi Paskibraka / Duta Pelajar Kota Surabaya',
    ],
  },
  {
    id: 'izin-kegiatan',
    code: 'TU-05',
    title: 'Surat Izin & Dispensasi Kegiatan',
    shortTitle: 'Dispensasi',
    slaDays: 1,
    targetAudience: 'Siswa & Guru',
    description:
      'Penerbitan surat dispensasi pembelajaran bagi siswa maupun izin tugas luar bagi guru/tenaga kependidikan yang mewakili sekolah.',
    requirements: [
      'Surat tugas / undangan resmi kegiatan dari panitia atau dinas',
      'Daftar nama peserta dan pendamping lengkap beserta kelas',
      'Rentang tanggal dan jam pelaksanaan kegiatan',
    ],
    samplePurposes: [
      'Dispensasi pertandingan DBL / Kejuaraan Provinsi',
      'Dispensasi pelatihan delegasi OSIS / MPK tingkat kota',
    ],
  },
  {
    id: 'perbaikan-data',
    code: 'TU-06',
    title: 'Perbaikan Data Pokok (Dapodik & NISN)',
    shortTitle: 'Verval Data',
    slaDays: 3,
    targetAudience: 'Siswa & Alumni',
    description:
      'Pengajuan verifikasi dan validasi (VervalPD) perbaikan kesalahan penulisan nama, tanggal lahir, NIK, atau nama orang tua pada sistem Dapodik dan NISN.',
    requirements: [
      'Fotokopi Akta Kelahiran asli yang jelas terbaca',
      'Fotokopi Kartu Keluarga (KK) terbaru tervalidasi Dukcapil',
      'Fotokopi Ijazah jenjang sebelumnya (SMP/MTs)',
    ],
    samplePurposes: [
      'Penyesuaian ejaan nama pada NISN sesuai Akta Kelahiran untuk SNPMB',
      'Pemutakhiran NIK dan data kependudukan di Dapodik',
    ],
  },
  {
    id: 'surat-tugas',
    code: 'TU-07',
    title: 'Surat Tugas & Administrasi Kepegawaian',
    shortTitle: 'Kepegawaian',
    slaDays: 1,
    targetAudience: 'Guru / Tendik',
    description:
      'Layanan penerbitan Surat Tugas kedinasan, SPPD, surat keterangan aktif mengajar, dan pengesahan berkas kepegawaian ASN / PPPK / GTT.',
    requirements: [
      'Nota dinas / surat undangan rapat, diklat, atau MGMP dari instansi pengundang',
      'Data NIP / NUPTK dan golongan/jabatan pemohon',
      'Jadwal dan lokasi penugasan resmi',
    ],
    samplePurposes: [
      'Surat Tugas Kegiatan MGMP SMA Kota Surabaya',
      'Surat Keterangan Aktif Mengajar untuk Pemberkasan TPG',
    ],
  },
];
