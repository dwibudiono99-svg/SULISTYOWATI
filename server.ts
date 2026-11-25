import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { AgendaEntry, DapodikStudent, ServiceRequest } from './src/types/tu.ts';

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'tu_store.json');

interface ClaimedTokenRecord {
  salt: string;
  hash: string;
  claimedAt: string;
}

interface ServerStore {
  claimedToken: ClaimedTokenRecord | null;
  students: DapodikStudent[];
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

function loadInitialSeeds(): Pick<ServerStore, 'students' | 'requests' | 'agenda'> {
  return {
    students: [
      {
        id: 'pd-001',
        nama: 'Nadia Kusuma Wardhani',
        nipd: '252610114',
        jk: 'P',
        nisn: '0094821735',
        tempatLahir: 'Surabaya',
        tanggalLahir: '2009-08-14',
        nik: '3578065408090002',
        noKk: '3578061204150019',
        noAktaLahir: '3578-LU-18082009-0041',
        agama: 'Islam',
        kewarganegaraan: 'WNI',
        berkebutuhanKhusus: 'Tidak Ada',
        anakKeBerapa: 1,
        alamatJalan: 'Jl. Ketabang Kali No. 22',
        rt: '003',
        rw: '005',
        dusun: '',
        kelurahan: 'Ketabang',
        kecamatan: 'Kec. Genteng',
        kodePos: '60272',
        lintang: '-7,2529',
        bujur: '112,7435',
        jenisTinggal: 'Bersama Orang Tua',
        alatTransportasi: 'Sepeda Motor',
        telepon: '',
        hp: '0812-3490-8812',
        email: 'nadia.wardhani09@sma.belajar.id',
        tinggiBadanCm: 161,
        beratBadanKg: 51,
        lingkarKepalaCm: 54,
        jarakSekolahKm: 1.4,
        waktuTempuhMenit: 10,
        jumlahSaudaraKandung: 1,
        penerimaKps: false,
        noKps: '',
        penerimaKip: false,
        noKip: '',
        namaDiKip: '',
        nomorKks: '',
        layakPip: false,
        alasanLayakPip: '',
        bank: '',
        nomorRekeningBank: '',
        rekeningAtasNama: '',
        namaAyah: 'Hendra Kusuma Wijaya',
        nikAyah: '3578061403780005',
        tahunLahirAyah: '1978',
        pendidikanAyah: 'S1',
        pekerjaanAyah: 'Karyawan Swasta',
        penghasilanAyah: 'Rp 5.000.000 - Rp 20.000.000',
        namaIbu: 'Sri Rahayu Ningsih',
        nikIbu: '3578064809810003',
        tahunLahirIbu: '1981',
        pendidikanIbu: 'S1',
        pekerjaanIbu: 'PNS/TNI/Polri',
        penghasilanIbu: 'Rp 5.000.000 - Rp 20.000.000',
        namaWali: '',
        tahunLahirWali: '',
        pendidikanWali: '',
        pekerjaanWali: '',
        penghasilanWali: '',
        nikWali: '',
        rombelSaatIni: 'XI-F3',
        tingkatKelas: 'XI',
        kurikulum: 'Kurikulum Merdeka',
        jenisPendaftaran: 'Siswa Baru',
        tanggalMasuk: '2025-07-14',
        asalSmp: 'SMP Negeri 1 Surabaya',
        skhun: '',
        noPesertaUn: '',
        noSeriIjazahSmp: 'DN-05/D-SMP/K13/25/0419283',
        statusSiswa: 'Aktif',
        vervalPdSyncAt: '2026-11-20T09:30:00+07:00',
      },
      {
        id: 'pd-002',
        nama: 'Muhammad Farhan Al-Rasyid',
        nipd: '242510089',
        jk: 'L',
        nisn: '0087712409',
        tempatLahir: 'Surabaya',
        tanggalLahir: '2008-03-21',
        nik: '3578092103080004',
        noKk: '3578091502100044',
        noAktaLahir: '3578-LU-02042008-0118',
        agama: 'Islam',
        kewarganegaraan: 'WNI',
        berkebutuhanKhusus: 'Tidak Ada',
        anakKeBerapa: 2,
        alamatJalan: 'Jl. Dharmawangsa Dalam Selatan No. 14',
        rt: '002',
        rw: '004',
        dusun: '',
        kelurahan: 'Airlangga',
        kecamatan: 'Kec. Gubeng',
        kodePos: '60286',
        lintang: '-7,2724',
        bujur: '112,7540',
        jenisTinggal: 'Bersama Orang Tua',
        alatTransportasi: 'Sepeda Motor',
        telepon: '',
        hp: '0821-4098-1173',
        email: 'farhan.rasyid08@sma.belajar.id',
        tinggiBadanCm: 173,
        beratBadanKg: 64,
        lingkarKepalaCm: 56,
        jarakSekolahKm: 3.2,
        waktuTempuhMenit: 15,
        jumlahSaudaraKandung: 2,
        penerimaKps: false,
        noKps: '',
        penerimaKip: false,
        noKip: '',
        namaDiKip: '',
        nomorKks: '',
        layakPip: false,
        alasanLayakPip: '',
        bank: '',
        nomorRekeningBank: '',
        rekeningAtasNama: '',
        namaAyah: 'Ahmad Fauzi Al-Rasyid',
        nikAyah: '3578091105750008',
        tahunLahirAyah: '1975',
        pendidikanAyah: 'S2',
        pekerjaanAyah: 'Wiraswasta',
        penghasilanAyah: 'Rp 5.000.000 - Rp 20.000.000',
        namaIbu: 'Nurul Hidayati',
        nikIbu: '',
        tahunLahirIbu: '1979',
        pendidikanIbu: 'S1',
        pekerjaanIbu: 'Tidak Bekerja',
        penghasilanIbu: 'Tidak Berpenghasilan',
        namaWali: '',
        tahunLahirWali: '',
        pendidikanWali: '',
        pekerjaanWali: '',
        penghasilanWali: '',
        nikWali: '',
        rombelSaatIni: 'XII-MIPA 2',
        tingkatKelas: 'XII',
        kurikulum: 'Kurikulum Merdeka',
        jenisPendaftaran: 'Siswa Baru',
        tanggalMasuk: '2024-07-15',
        asalSmp: 'SMP Negeri 6 Surabaya',
        skhun: '',
        noPesertaUn: '',
        noSeriIjazahSmp: '',
        statusSiswa: 'Aktif',
        vervalPdSyncAt: '2026-11-24T09:15:00+07:00',
      },
      {
        id: 'pd-003',
        nama: 'Clarissa Putri Maharani',
        nipd: '262710042',
        jk: 'P',
        nisn: '0098123456',
        tempatLahir: 'Sidoarjo',
        tanggalLahir: '2010-05-09',
        nik: '3578084905100001',
        noKk: '3578082208120007',
        noAktaLahir: '3515-LU-20052010-0092',
        agama: 'Kristen',
        kewarganegaraan: 'WNI',
        berkebutuhanKhusus: 'Tidak Ada',
        anakKeBerapa: 1,
        alamatJalan: 'Jl. Ambengan Selatan Blok B No. 9',
        rt: '004',
        rw: '002',
        dusun: '',
        kelurahan: 'Pacar Keling',
        kecamatan: 'Kec. Tambaksari',
        kodePos: '60131',
        lintang: '-7,2513',
        bujur: '112,7509',
        jenisTinggal: 'Bersama Orang Tua',
        alatTransportasi: 'Mobil Pribadi',
        telepon: '',
        hp: '0819-0334-7821',
        email: 'clarissa.maharani10@sma.belajar.id',
        tinggiBadanCm: 159,
        beratBadanKg: 48,
        lingkarKepalaCm: 53,
        jarakSekolahKm: 2.1,
        waktuTempuhMenit: 12,
        jumlahSaudaraKandung: 1,
        penerimaKps: false,
        noKps: '',
        penerimaKip: false,
        noKip: '',
        namaDiKip: '',
        nomorKks: '',
        layakPip: false,
        alasanLayakPip: '',
        bank: '',
        nomorRekeningBank: '',
        rekeningAtasNama: '',
        namaAyah: 'Daniel Hartono',
        nikAyah: '3578080907790002',
        tahunLahirAyah: '1979',
        pendidikanAyah: 'S1',
        pekerjaanAyah: 'Wiraswasta',
        penghasilanAyah: 'Rp 5.000.000 - Rp 20.000.000',
        namaIbu: 'Yuliana Sari',
        nikIbu: '3578085211820001',
        tahunLahirIbu: '1982',
        pendidikanIbu: 'S1',
        pekerjaanIbu: 'Karyawan Swasta',
        penghasilanIbu: 'Rp 2.000.000 - Rp 4.999.999',
        namaWali: '',
        tahunLahirWali: '',
        pendidikanWali: '',
        pekerjaanWali: '',
        penghasilanWali: '',
        nikWali: '',
        rombelSaatIni: 'X-E5',
        tingkatKelas: 'X',
        kurikulum: 'Kurikulum Merdeka',
        jenisPendaftaran: 'Siswa Baru',
        tanggalMasuk: '2026-07-13',
        asalSmp: 'SMPK Santa Agnes Surabaya',
        skhun: '',
        noPesertaUn: '',
        noSeriIjazahSmp: 'DN-05/D-SMP/KM/26/0193842',
        statusSiswa: 'Aktif',
        vervalPdSyncAt: '2026-11-18T11:00:00+07:00',
      },
      {
        id: 'pd-004',
        nama: 'Dimas Arya Pratama',
        nipd: '262710018',
        jk: 'L',
        nisn: '0102938475',
        tempatLahir: 'Surabaya',
        tanggalLahir: '2010-01-17',
        nik: '3578041701100003',
        noKk: '3578041103110028',
        noAktaLahir: '3578-LU-25012010-0015',
        agama: 'Islam',
        kewarganegaraan: 'WNI',
        berkebutuhanKhusus: 'Tidak Ada',
        anakKeBerapa: 2,
        alamatJalan: 'Jl. Ngaglik No. 41',
        rt: '001',
        rw: '003',
        dusun: '',
        kelurahan: 'Kapasari',
        kecamatan: 'Kec. Genteng',
        kodePos: '60273',
        lintang: '-7,2415',
        bujur: '112,7513',
        jenisTinggal: 'Bersama Orang Tua',
        alatTransportasi: 'Jalan Kaki',
        telepon: '',
        hp: '0857-3109-4420',
        email: 'dimas.pratama10@sma.belajar.id',
        tinggiBadanCm: 168,
        beratBadanKg: 58,
        lingkarKepalaCm: 54,
        jarakSekolahKm: 0.9,
        waktuTempuhMenit: 10,
        jumlahSaudaraKandung: 2,
        penerimaKps: true,
        noKps: 'KPS-3578-01182',
        penerimaKip: true,
        noKip: 'KIP-3578-009412',
        namaDiKip: 'DIMAS ARYA PRATAMA',
        nomorKks: 'KKS-3578-4410',
        layakPip: true,
        alasanLayakPip: 'Siswa Miskin/Rentan Miskin',
        bank: 'BRI',
        nomorRekeningBank: '0096-01-045821-50-2',
        rekeningAtasNama: 'DIMAS ARYA PRATAMA',
        namaAyah: 'Slamet Riyadi',
        nikAyah: '3578040504760006',
        tahunLahirAyah: '1976',
        pendidikanAyah: 'SMA / Sederajat',
        pekerjaanAyah: 'Pedagang Kecil',
        penghasilanAyah: 'Rp 1.000.000 - Rp 1.999.999',
        namaIbu: 'Mardiyanti',
        nikIbu: '3578044408800004',
        tahunLahirIbu: '1980',
        pendidikanIbu: 'SMP / Sederajat',
        pekerjaanIbu: 'Tidak Bekerja',
        penghasilanIbu: 'Tidak Berpenghasilan',
        namaWali: '',
        tahunLahirWali: '',
        pendidikanWali: '',
        pekerjaanWali: '',
        penghasilanWali: '',
        nikWali: '',
        rombelSaatIni: 'X-E1',
        tingkatKelas: 'X',
        kurikulum: 'Kurikulum Merdeka',
        jenisPendaftaran: 'Siswa Baru',
        tanggalMasuk: '2026-07-13',
        asalSmp: 'SMP Negeri 3 Surabaya',
        skhun: '',
        noPesertaUn: '',
        noSeriIjazahSmp: 'DN-05/D-SMP/KM/26/0084719',
        statusSiswa: 'Aktif',
        vervalPdSyncAt: '2026-11-22T14:20:00+07:00',
      },
      {
        id: 'pd-005',
        nama: 'Salsabila Azzahra Putri',
        nipd: '252610067',
        jk: 'P',
        nisn: '0091128834',
        tempatLahir: 'Gresik',
        tanggalLahir: '2009-11-03',
        nik: '357810431109',
        noKk: '3578100901140033',
        noAktaLahir: '',
        agama: 'Islam',
        kewarganegaraan: 'WNI',
        berkebutuhanKhusus: 'Tidak Ada',
        anakKeBerapa: 3,
        alamatJalan: 'Jl. Karah Indah Blok G No. 12',
        rt: '005',
        rw: '006',
        dusun: '',
        kelurahan: 'Karah',
        kecamatan: 'Kec. Jambangan',
        kodePos: '60232',
        lintang: '-7,3152',
        bujur: '112,7148',
        jenisTinggal: 'Bersama Orang Tua',
        alatTransportasi: 'Angkutan Umum',
        telepon: '',
        hp: '0813-5772-9910',
        email: '',
        tinggiBadanCm: 157,
        beratBadanKg: 47,
        lingkarKepalaCm: 52,
        jarakSekolahKm: 8.5,
        waktuTempuhMenit: 35,
        jumlahSaudaraKandung: 2,
        penerimaKps: false,
        noKps: '',
        penerimaKip: false,
        noKip: '',
        namaDiKip: '',
        nomorKks: '',
        layakPip: false,
        alasanLayakPip: '',
        bank: '',
        nomorRekeningBank: '',
        rekeningAtasNama: '',
        namaAyah: 'Budi Santoso',
        nikAyah: '3578101002740001',
        tahunLahirAyah: '1974',
        pendidikanAyah: 'D3',
        pekerjaanAyah: 'Karyawan Swasta',
        penghasilanAyah: 'Rp 2.000.000 - Rp 4.999.999',
        namaIbu: 'Endang Sulistyowati',
        nikIbu: '3578104206770002',
        tahunLahirIbu: '1977',
        pendidikanIbu: 'SMA / Sederajat',
        pekerjaanIbu: 'Wirausaha',
        penghasilanIbu: 'Rp 1.000.000 - Rp 1.999.999',
        namaWali: '',
        tahunLahirWali: '',
        pendidikanWali: '',
        pekerjaanWali: '',
        penghasilanWali: '',
        nikWali: '',
        rombelSaatIni: 'XI-F1',
        tingkatKelas: 'XI',
        kurikulum: 'Kurikulum Merdeka',
        jenisPendaftaran: 'Pindahan',
        tanggalMasuk: '2026-01-05',
        asalSmp: 'SMP Negeri 1 Gresik',
        skhun: '',
        noPesertaUn: '',
        noSeriIjazahSmp: 'DN-05/D-SMP/K13/25/0221904',
        statusSiswa: 'Aktif',
        vervalPdSyncAt: '2026-11-19T10:15:00+07:00',
      },
      {
        id: 'pd-006',
        nama: 'Kevin Wijaya Kusuma',
        nipd: '242510152',
        jk: 'L',
        nisn: '0086543210',
        tempatLahir: 'Surabaya',
        tanggalLahir: '2008-06-28',
        nik: '3578072806080005',
        noKk: '3578070309110014',
        noAktaLahir: '3578-LU-10072008-0083',
        agama: 'Katolik',
        kewarganegaraan: 'WNI',
        berkebutuhanKhusus: 'Tidak Ada',
        anakKeBerapa: 1,
        alamatJalan: 'Jl. Kusuma Bangsa No. 78',
        rt: '002',
        rw: '001',
        dusun: '',
        kelurahan: 'Kapasari',
        kecamatan: 'Kec. Genteng',
        kodePos: '60273',
        lintang: '-7,2488',
        bujur: '112,7505',
        jenisTinggal: 'Bersama Orang Tua',
        alatTransportasi: 'Sepeda Motor',
        telepon: '',
        hp: '0812-1778-9022',
        email: 'kevin.wijaya08@sma.belajar.id',
        tinggiBadanCm: 178,
        beratBadanKg: 69,
        lingkarKepalaCm: 57,
        jarakSekolahKm: 1.1,
        waktuTempuhMenit: 6,
        jumlahSaudaraKandung: 1,
        penerimaKps: false,
        noKps: '',
        penerimaKip: false,
        noKip: '',
        namaDiKip: '',
        nomorKks: '',
        layakPip: false,
        alasanLayakPip: '',
        bank: '',
        nomorRekeningBank: '',
        rekeningAtasNama: '',
        namaAyah: 'Antonius Wijaya',
        nikAyah: '3578071204770003',
        tahunLahirAyah: '1977',
        pendidikanAyah: 'S1',
        pekerjaanAyah: 'Wiraswasta',
        penghasilanAyah: 'Rp 5.000.000 - Rp 20.000.000',
        namaIbu: 'Maria Magdalena',
        nikIbu: '3578074509800002',
        tahunLahirIbu: '1980',
        pendidikanIbu: 'S1',
        pekerjaanIbu: 'Karyawan Swasta',
        penghasilanIbu: 'Rp 5.000.000 - Rp 20.000.000',
        namaWali: '',
        tahunLahirWali: '',
        pendidikanWali: '',
        pekerjaanWali: '',
        penghasilanWali: '',
        nikWali: '',
        rombelSaatIni: 'XII-IPS 1',
        tingkatKelas: 'XII',
        kurikulum: 'Kurikulum Merdeka',
        jenisPendaftaran: 'Siswa Baru',
        tanggalMasuk: '2024-07-15',
        asalSmp: 'SMP Katolik Angelus Custos',
        skhun: '',
        noPesertaUn: '',
        noSeriIjazahSmp: 'DN-05/D-SMP/K13/24/0512901',
        statusSiswa: 'Aktif',
        vervalPdSyncAt: '2026-11-21T08:40:00+07:00',
      },
      {
        id: 'pd-007',
        nama: 'Bagas Prakoso Putra',
        nipd: '212210093',
        jk: 'L',
        nisn: '0051193842',
        tempatLahir: 'Surabaya',
        tanggalLahir: '2006-09-12',
        nik: '3578061209060007',
        noKk: '3578060405090011',
        noAktaLahir: '3578-LU-20092006-0054',
        agama: 'Islam',
        kewarganegaraan: 'WNI',
        berkebutuhanKhusus: 'Tidak Ada',
        anakKeBerapa: 2,
        alamatJalan: 'Jl. Jagalan Gang VI No. 5',
        rt: '006',
        rw: '004',
        dusun: '',
        kelurahan: 'Peneleh',
        kecamatan: 'Kec. Genteng',
        kodePos: '60274',
        lintang: '-7,2521',
        bujur: '112,7422',
        jenisTinggal: 'Bersama Orang Tua',
        alatTransportasi: 'Sepeda Motor',
        telepon: '',
        hp: '0856-4812-2290',
        email: 'bagas.prakoso06@alumni.sman9sby.sch.id',
        tinggiBadanCm: 172,
        beratBadanKg: 65,
        lingkarKepalaCm: 55,
        jarakSekolahKm: 1.8,
        waktuTempuhMenit: 10,
        jumlahSaudaraKandung: 2,
        penerimaKps: false,
        noKps: '',
        penerimaKip: false,
        noKip: '',
        namaDiKip: '',
        nomorKks: '',
        layakPip: false,
        alasanLayakPip: '',
        bank: '',
        nomorRekeningBank: '',
        rekeningAtasNama: '',
        namaAyah: 'Sukarno Putra',
        nikAyah: '3578061802710004',
        tahunLahirAyah: '1971',
        pendidikanAyah: 'SMA / Sederajat',
        pekerjaanAyah: 'Pensiunan',
        penghasilanAyah: 'Rp 2.000.000 - Rp 4.999.999',
        namaIbu: 'Rukmini Wati',
        nikIbu: '3578065110740002',
        tahunLahirIbu: '1974',
        pendidikanIbu: 'SMA / Sederajat',
        pekerjaanIbu: 'Tidak Bekerja',
        penghasilanIbu: 'Tidak Berpenghasilan',
        namaWali: '',
        tahunLahirWali: '',
        pendidikanWali: '',
        pekerjaanWali: '',
        penghasilanWali: '',
        nikWali: '',
        rombelSaatIni: 'Alumni Angkatan 2024',
        tingkatKelas: 'Alumni',
        kurikulum: 'Kurikulum 2013',
        jenisPendaftaran: 'Siswa Baru',
        tanggalMasuk: '2021-07-12',
        asalSmp: 'SMP Negeri 2 Surabaya',
        skhun: '',
        noPesertaUn: '',
        noSeriIjazahSmp: 'DN-05/D-SMP/K13/21/0118342',
        statusSiswa: 'Lulus',
        vervalPdSyncAt: '2024-06-15T10:00:00+07:00',
      },
    ],
    requests: [
      {
        id: 'TU-2026-0148',
        serviceId: 'surat-aktif',
        serviceTitle: 'Surat Keterangan Siswa Aktif',
        applicantName: 'Nadia Kusuma Wardhani',
        applicantRole: 'Siswa',
        identityNumber: '0094821735',
        classOrCohort: 'XI-F3',
        phone: '0812-3490-8812',
        purpose: 'Pengajuan Beasiswa Prestasi Pemerintah Kota Surabaya Tahun 2026',
        notes: 'Mohon mencantumkan keterangan peringkat paralel semester genap apabila memungkinkan.',
        submittedRequirements: [
          'Kartu Pelajar / Bukti Identitas Siswa (NIS & NISN)',
          'Catatan nama instansi atau tujuan surat yang jelas',
        ],
        status: 'Siap Diambil',
        letterNumber: '421.3/118/101.6.1.9/2026',
        assignedStaff: 'Sulistyowati, S.Pd.',
        createdAt: '2026-11-23T08:15:00+07:00',
        updatedAt: '2026-11-24T13:40:00+07:00',
        estimatedReadyAt: '2026-11-24T14:00:00+07:00',
        timeline: [
          {
            id: 'tl-1',
            timestamp: '2026-11-23T08:15:00+07:00',
            status: 'Diajukan',
            actor: 'Nadia Kusuma Wardhani',
            note: 'Permohonan diajukan melalui portal SIP TU SMAN 9 Surabaya.',
          },
          {
            id: 'tl-2',
            timestamp: '2026-11-23T09:20:00+07:00',
            status: 'Verifikasi Berkas',
            actor: 'Sulistyowati, S.Pd.',
            note: 'Data NISN dan status keaktifan di Dapodik telah diverifikasi.',
          },
          {
            id: 'tl-3',
            timestamp: '2026-11-23T11:05:00+07:00',
            status: 'Menunggu TTD Kepala Sekolah',
            actor: 'Bagian Persuratan TU',
            note: 'Surat bernomor 421.3/118/101.6.1.9/2026 diajukan ke meja Kepala Sekolah.',
          },
          {
            id: 'tl-4',
            timestamp: '2026-11-24T13:40:00+07:00',
            status: 'Siap Diambil',
            actor: 'Sulistyowati, S.Pd.',
            note: 'Dokumen telah ditandatangani & distempel basah. Dapat diambil di Loket 1 Tata Usaha.',
          },
        ],
      },
      {
        id: 'TU-2026-0149',
        serviceId: 'legalisir',
        serviceTitle: 'Legalisir Ijazah, SKL & Rapor',
        applicantName: 'Bagas Prakoso Putra',
        applicantRole: 'Alumni',
        identityNumber: '0051193842',
        classOrCohort: 'Alumni Angkatan 2024',
        phone: '0856-4812-2290',
        purpose: 'Legalisir Ijazah & Transkrip Nilai (8 lembar) untuk Seleksi Rekrutmen BUMN',
        notes: 'Fotokopi sudah disiapkan 8 lembar, akan membawa ijazah asli ke loket pagi ini.',
        submittedRequirements: [
          'Dokumen asli (Ijazah / SKL / Rapor) ditunjukkan saat verifikasi loket',
          'Fotokopi dokumen rapi sesuai jumlah lembar yang dilegalisir (maks. 10 lembar)',
          'Identitas pemohon (KTP / Kartu Pelajar)',
        ],
        status: 'Menunggu TTD Kepala Sekolah',
        letterNumber: '421.3/121/101.6.1.9/2026',
        assignedStaff: 'Hendra Wijaya, A.Md.',
        createdAt: '2026-11-24T08:50:00+07:00',
        updatedAt: '2026-11-24T15:10:00+07:00',
        estimatedReadyAt: '2026-11-26T10:00:00+07:00',
        timeline: [
          {
            id: 'tl-5',
            timestamp: '2026-11-24T08:50:00+07:00',
            status: 'Diajukan',
            actor: 'Bagas Prakoso Putra',
            note: 'Permohonan legalisir 8 lembar Ijazah diajukan online.',
          },
          {
            id: 'tl-6',
            timestamp: '2026-11-24T10:15:00+07:00',
            status: 'Verifikasi Berkas',
            actor: 'Hendra Wijaya, A.Md.',
            note: 'Ijazah asli telah dicocokkan dengan buku induk alumni tahun 2024.',
          },
          {
            id: 'tl-7',
            timestamp: '2026-11-24T15:10:00+07:00',
            status: 'Menunggu TTD Kepala Sekolah',
            actor: 'Hendra Wijaya, A.Md.',
            note: 'Seluruh lembar fotokopi telah dibubuhi cap legalisir, menunggu pengesahan Kepala Sekolah.',
          },
        ],
      },
      {
        id: 'TU-2026-0150',
        serviceId: 'surat-tugas',
        serviceTitle: 'Surat Tugas & Administrasi Kepegawaian',
        applicantName: 'Dra. Ratna Dwi Anggraini, M.Pd.',
        applicantRole: 'Guru / Tendik',
        identityNumber: '197804122005012014',
        classOrCohort: 'Guru Bahasa Indonesia',
        phone: '0813-3019-4451',
        purpose: 'Surat Tugas Mengikuti Workshop Kurikulum Merdeka MGMP Kota Surabaya di SMAN 5 Surabaya',
        notes: 'Pelaksanaan hari Kamis, 26 November 2026 pukul 08.00 – 15.00 WIB.',
        submittedRequirements: [
          'Nota dinas / surat undangan rapat, diklat, atau MGMP dari instansi pengundang',
          'Data NIP / NUPTK dan golongan/jabatan pemohon',
          'Jadwal dan lokasi penugasan resmi',
        ],
        status: 'Proses Pengetikan',
        letterNumber: '800/123/101.6.1.9/2026',
        assignedStaff: 'Sulistyowati, S.Pd.',
        createdAt: '2026-11-24T10:30:00+07:00',
        updatedAt: '2026-11-25T07:45:00+07:00',
        estimatedReadyAt: '2026-11-25T13:00:00+07:00',
        timeline: [
          {
            id: 'tl-8',
            timestamp: '2026-11-24T10:30:00+07:00',
            status: 'Diajukan',
            actor: 'Dra. Ratna Dwi Anggraini, M.Pd.',
            note: 'Pengajuan Surat Tugas MGMP berdasarkan undangan No. 042/MGMP-BI/XI/2026.',
          },
          {
            id: 'tl-9',
            timestamp: '2026-11-25T07:45:00+07:00',
            status: 'Proses Pengetikan',
            actor: 'Sulistyowati, S.Pd.',
            note: 'Draf surat tugas dan SPPD sedang disusun dengan nomor 800/123/101.6.1.9/2026.',
          },
        ],
      },
      {
        id: 'TU-2026-0151',
        serviceId: 'perbaikan-data',
        serviceTitle: 'Perbaikan Data Pokok (Dapodik & NISN)',
        applicantName: 'Muhammad Farhan Al-Rasyid',
        applicantRole: 'Siswa',
        identityNumber: '0087712409',
        classOrCohort: 'XII-MIPA 2',
        phone: '0821-4098-1173',
        purpose: 'Perbaikan tanda hubung pada nama siswa di sistem VervalPD agar sinkron dengan Akta Kelahiran untuk SNPMB 2027',
        notes: 'Di Dapodik tertulis Al Rasyid tanpa tanda hubung, sedangkan Akta & KK menggunakan Al-Rasyid.',
        submittedRequirements: [
          'Fotokopi Akta Kelahiran asli yang jelas terbaca',
          'Fotokopi Kartu Keluarga (KK) terbaru tervalidasi Dukcapil',
        ],
        status: 'Perlu Perbaikan',
        assignedStaff: 'Rizky Pratama, S.Kom.',
        createdAt: '2026-11-22T13:10:00+07:00',
        updatedAt: '2026-11-24T09:15:00+07:00',
        estimatedReadyAt: '2026-11-26T15:00:00+07:00',
        revisionNote: 'Mohon melampirkan scan fotokopi Ijazah SMP asli karena perubahan nama memerlukan lampiran ijazah jenjang sebelumnya di VervalPD.',
        timeline: [
          {
            id: 'tl-10',
            timestamp: '2026-11-22T13:10:00+07:00',
            status: 'Diajukan',
            actor: 'Muhammad Farhan Al-Rasyid',
            note: 'Permohonan VervalPD diajukan untuk sinkronisasi nama.',
          },
          {
            id: 'tl-11',
            timestamp: '2026-11-24T09:15:00+07:00',
            status: 'Perlu Perbaikan',
            actor: 'Rizky Pratama, S.Kom.',
            note: 'Kekurangan berkas: fotokopi Ijazah SMP belum disertakan saat verifikasi operator Dapodik.',
          },
        ],
      },
      {
        id: 'TU-2026-0152',
        serviceId: 'rekomendasi',
        serviceTitle: 'Surat Rekomendasi & Pengantar Lomba',
        applicantName: 'Clarissa Putri Maharani',
        applicantRole: 'Siswa',
        identityNumber: '0098123456',
        classOrCohort: 'X-E5',
        phone: '0819-0334-7821',
        purpose: 'Surat Rekomendasi Sekolah untuk Lomba Debat Bahasa Inggris Tingkat SMA se-Jawa Timur di Universitas Airlangga',
        notes: 'Tim terdiri dari 3 siswa kelas X dan XI dengan pembina Ibu Rina Kartika, S.Pd.',
        submittedRequirements: [
          'Poster / Surat Undangan resmi penyelenggara kegiatan atau beasiswa',
          'Persetujuan guru pembina ekstrakurikuler atau wali kelas',
          'Data lengkap peserta (Nama, Kelas, NISN)',
        ],
        status: 'Diajukan',
        assignedStaff: 'Sulistyowati, S.Pd.',
        createdAt: '2026-11-25T07:30:00+07:00',
        updatedAt: '2026-11-25T07:30:00+07:00',
        estimatedReadyAt: '2026-11-26T11:00:00+07:00',
        timeline: [
          {
            id: 'tl-12',
            timestamp: '2026-11-25T07:30:00+07:00',
            status: 'Diajukan',
            actor: 'Clarissa Putri Maharani',
            note: 'Permohonan surat rekomendasi lomba diterima sistem antrean TU.',
          },
        ],
      },
      {
        id: 'TU-2026-0141',
        serviceId: 'izin-kegiatan',
        serviceTitle: 'Surat Izin & Dispensasi Kegiatan',
        applicantName: 'Tim Basket Putra SMAN 9 Surabaya',
        applicantRole: 'Siswa',
        identityNumber: '0086543210',
        classOrCohort: 'XI-F1 / XI-F4 / XII-MIPA',
        phone: '0812-1778-9022',
        purpose: 'Dispensasi Mengikuti Turnamen Basket Antar-SMA DBL East Java Series',
        notes: '12 pemain dan 2 ofisial siswa, jadwal bertanding tanggal 20 November 2026.',
        submittedRequirements: [
          'Surat tugas / undangan resmi kegiatan dari panitia atau dinas',
          'Daftar nama peserta dan pendamping lengkap beserta kelas',
          'Rentang tanggal dan jam pelaksanaan kegiatan',
        ],
        status: 'Selesai',
        letterNumber: '421.3/112/101.6.1.9/2026',
        assignedStaff: 'Sulistyowati, S.Pd.',
        createdAt: '2026-11-18T08:00:00+07:00',
        updatedAt: '2026-11-19T14:20:00+07:00',
        estimatedReadyAt: '2026-11-19T12:00:00+07:00',
        timeline: [
          {
            id: 'tl-13',
            timestamp: '2026-11-18T08:00:00+07:00',
            status: 'Diajukan',
            actor: 'Tim Basket Putra SMAN 9 Surabaya',
            note: 'Berkas pengajuan dispensasi disampaikan ke loket TU.',
          },
          {
            id: 'tl-14',
            timestamp: '2026-11-19T14:20:00+07:00',
            status: 'Selesai',
            actor: 'Sulistyowati, S.Pd.',
            note: 'Surat dispensasi No. 421.3/112/101.6.1.9/2026 telah diambil oleh ketua tim.',
          },
        ],
      },
    ],
    agenda: [
      {
        id: 'ag-1',
        type: 'Surat Masuk',
        agendaNumber: 'SM/2026/0384',
        letterNumber: '420/6112/101.6/2026',
        letterDate: '2026-11-20',
        recordedDate: '2026-11-21',
        counterparty: 'Cabang Dinas Pendidikan Wilayah Sidoarjo & Surabaya',
        subject: 'Undangan Rapat Koordinasi Persiapan Pelaksanaan Asesmen Sumatif Akhir Semester Ganjil',
        classification: 'Penting',
        disposition: 'Diteruskan ke Waka Kurikulum & Kepala Sekolah untuk penugasan hadir.',
      },
      {
        id: 'ag-2',
        type: 'Surat Keluar',
        agendaNumber: 'SK/2026/0219',
        letterNumber: '421.3/118/101.6.1.9/2026',
        letterDate: '2026-11-24',
        recordedDate: '2026-11-24',
        counterparty: 'Dinas Pendidikan Kota Surabaya (Cq. Bagian Beasiswa)',
        subject: 'Surat Keterangan Siswa Aktif a.n. Nadia Kusuma Wardhani (XI-F3)',
        classification: 'Biasa',
        disposition: 'Diarsipkan pada ordner Surat Keterangan Siswa 2026.',
        relatedTicketId: 'TU-2026-0148',
      },
      {
        id: 'ag-3',
        type: 'Surat Masuk',
        agendaNumber: 'SM/2026/0385',
        letterNumber: '089/UN3.14/KM/2026',
        letterDate: '2026-11-22',
        recordedDate: '2026-11-23',
        counterparty: 'Fakultas Ilmu Budaya Universitas Airlangga',
        subject: 'Permohonan Delegasi Lomba Debat Bahasa Inggris Tingkat SMA se-Jawa Timur',
        classification: 'Biasa',
        disposition: 'Disposisi ke Waka Kesiswaan dan Pembina English Club.',
      },
      {
        id: 'ag-4',
        type: 'Surat Keluar',
        agendaNumber: 'SK/2026/0220',
        letterNumber: '421.3/112/101.6.1.9/2026',
        letterDate: '2026-11-19',
        recordedDate: '2026-11-19',
        counterparty: 'Bapak/Ibu Guru Mata Pelajaran & Panitia DBL East Java',
        subject: 'Surat Dispensasi Kegiatan Turnamen Basket Putra SMAN 9 Surabaya',
        classification: 'Segera',
        disposition: 'Tembusan Waka Kesiswaan dan Piket KBM.',
        relatedTicketId: 'TU-2026-0141',
      },
      {
        id: 'ag-5',
        type: 'Surat Masuk',
        agendaNumber: 'SM/2026/0386',
        letterNumber: '005/3421/101.1/2026',
        letterDate: '2026-11-24',
        recordedDate: '2026-11-25',
        counterparty: 'Dinas Pendidikan Provinsi Jawa Timur',
        subject: 'Edaran Pemutakhiran Data Dapodik Semester Ganjil Tahun Pelajaran 2026/2027',
        classification: 'Segera',
        disposition: 'Segera ditindaklanjuti oleh Operator Dapodik & Koordinator TU.',
      },
    ],
  };
}

function readStore(): ServerStore {
  if (!fs.existsSync(STORE_PATH)) {
    const seeds = loadInitialSeeds();
    const initial: ServerStore = {
      claimedToken: null,
      students: seeds.students,
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
    return {
      claimedToken: parsed.claimedToken ?? null,
      students: Array.isArray(parsed.students) ? parsed.students : seeds.students,
      requests: Array.isArray(parsed.requests) ? parsed.requests : seeds.requests,
      agenda: Array.isArray(parsed.agenda) ? parsed.agenda : seeds.agenda,
    };
  } catch {
    const seeds = loadInitialSeeds();
    return {
      claimedToken: null,
      students: seeds.students,
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

function toPublicRequest(req: ServiceRequest): ServiceRequest {
  return {
    ...req,
    identityNumber: maskIdentityNumber(req.identityNumber),
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
  app.use(express.json({ limit: '5mb' }));

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

  // Public Pemohon Routes (masked PII, no student database access)
  app.get('/api/requests/public', (_req: Request, res: Response) => {
    const store = readStore();
    res.json(store.requests.map(toPublicRequest));
  });

  app.get('/api/requests/track', (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    if (!q) {
      res.status(400).json({ error: 'Parameter pencarian wajib diisi.' });
      return;
    }
    const store = readStore();
    const matches = store.requests
      .filter(
        (item) =>
          item.id.toLowerCase() === q ||
          item.identityNumber.toLowerCase() === q
      )
      .map(toPublicRequest);
    res.json(matches);
  });

  app.post('/api/requests', (req: Request, res: Response) => {
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
      typeof body?.serviceTitle !== 'string'
    ) {
      res.status(400).json({ error: 'Data pengajuan permohonan tidak lengkap.' });
      return;
    }

    const store = readStore();
    const nowIso = new Date().toISOString();
    const nextNumber = 153 + store.requests.length;
    const ticketId = `TU-2026-${String(nextNumber).padStart(4, '0')}`;

    const newReq: ServiceRequest = {
      id: ticketId,
      serviceId: body.serviceId,
      serviceTitle: body.serviceTitle,
      applicantName: body.applicantName.trim(),
      applicantRole: body.applicantRole || 'Siswa',
      identityNumber: body.identityNumber.trim(),
      classOrCohort: (body.classOrCohort || '-').trim(),
      phone: body.phone.trim(),
      purpose: body.purpose.trim(),
      notes: (body.notes || '').trim(),
      submittedRequirements: Array.isArray(body.submittedRequirements)
        ? body.submittedRequirements.filter((x): x is string => typeof x === 'string')
        : [],
      status: 'Diajukan',
      assignedStaff: 'Sulistyowati, S.Pd.',
      createdAt: nowIso,
      updatedAt: nowIso,
      estimatedReadyAt:
        typeof body.estimatedReadyAt === 'string'
          ? body.estimatedReadyAt
          : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          id: `tl-${Date.now()}`,
          timestamp: nowIso,
          status: 'Diajukan',
          actor: body.applicantName.trim(),
          note: `Permohonan ${body.serviceTitle} diajukan secara daring melalui SIP TU SMAN 9 Surabaya.`,
        },
      ],
    };

    store.requests.unshift(newReq);
    writeStore(store);

    res.status(201).json(toPublicRequest(newReq));
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
        counterparty: `${updated.applicantName} (${updated.classOrCohort})`,
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
