import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  Save,
  ShieldAlert,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  DapodikStudent,
  ServiceCategoryId,
  StudentGender,
  StudentStatus,
  UserMode,
} from '../types/tu';
import { validateDapodikStudent } from '../utils/dapodikValidation';

interface DapodikStudentModalProps {
  student: DapodikStudent | null;
  isCreating: boolean;
  userMode: UserMode;
  onClose: () => void;
  onSave: (student: DapodikStudent, isNew: boolean) => void;
  onDelete: (id: string) => void;
  onCreateLetterFromStudent: (student: DapodikStudent, serviceId: ServiceCategoryId) => void;
}

type ModalTab = 'identitas' | 'alamat' | 'ortu' | 'registrasi';

const EMPTY_STUDENT: DapodikStudent = {
  id: '',
  nama: '',
  nipd: '',
  jk: 'L',
  nisn: '',
  tempatLahir: 'Surabaya',
  tanggalLahir: '2010-01-01',
  nik: '',
  noKk: '',
  noAktaLahir: '',
  agama: 'Islam',
  kewarganegaraan: 'WNI',
  berkebutuhanKhusus: 'Tidak Ada',
  anakKeBerapa: 1,
  alamatJalan: '',
  rt: '001',
  rw: '001',
  dusun: '',
  kelurahan: '',
  kecamatan: 'Kec. Genteng',
  kodePos: '60272',
  lintang: '',
  bujur: '',
  jenisTinggal: 'Bersama Orang Tua',
  alatTransportasi: 'Sepeda Motor',
  telepon: '',
  hp: '',
  email: '',
  tinggiBadanCm: 165,
  beratBadanKg: 55,
  lingkarKepalaCm: 54,
  jarakSekolahKm: 2,
  waktuTempuhMenit: 15,
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
  namaAyah: '',
  nikAyah: '',
  tahunLahirAyah: '',
  pendidikanAyah: 'S1',
  pekerjaanAyah: 'Karyawan Swasta',
  penghasilanAyah: 'Rp 2.000.000 - Rp 4.999.999',
  namaIbu: '',
  nikIbu: '',
  tahunLahirIbu: '',
  pendidikanIbu: 'SMA / Sederajat',
  pekerjaanIbu: 'Tidak Bekerja',
  penghasilanIbu: 'Tidak Berpenghasilan',
  namaWali: '',
  tahunLahirWali: '',
  pendidikanWali: '',
  pekerjaanWali: '',
  penghasilanWali: '',
  nikWali: '',
  rombelSaatIni: 'X-1',
  tingkatKelas: 'X',
  kurikulum: 'Kurikulum Merdeka',
  jenisPendaftaran: 'Siswa Baru',
  tanggalMasuk: '2026-07-13',
  asalSmp: '',
  skhun: '',
  noPesertaUn: '',
  noSeriIjazahSmp: '',
  statusSiswa: 'Aktif',
  vervalPdSyncAt: new Date().toISOString(),
};

const EDUCATION_OPTIONS = [
  'Tidak Sekolah',
  'SD / Sederajat',
  'SMP / Sederajat',
  'SMA / Sederajat',
  'D1',
  'D2',
  'D3',
  'D4 / S1',
  'S1',
  'S2',
  'S3',
];

const INCOME_OPTIONS = [
  'Tidak Berpenghasilan',
  'Kurang dari Rp 500.000',
  'Rp 500.000 - Rp 999.999',
  'Rp 1.000.000 - Rp 1.999.999',
  'Rp 2.000.000 - Rp 4.999.999',
  'Rp 5.000.000 - Rp 20.000.000',
  'Lebih dari Rp 20.000.000',
];

export function DapodikStudentModal({
  student,
  isCreating,
  userMode,
  onClose,
  onSave,
  onDelete,
  onCreateLetterFromStudent,
}: DapodikStudentModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('identitas');
  const [form, setForm] = useState<DapodikStudent>(EMPTY_STUDENT);

  useEffect(() => {
    if (isCreating) {
      setForm({
        ...EMPTY_STUDENT,
        id: `pd-${Date.now()}`,
        vervalPdSyncAt: new Date().toISOString(),
      });
      setActiveTab('identitas');
    } else if (student) {
      setForm(student);
      setActiveTab('identitas');
    }
  }, [student, isCreating]);

  const validation = useMemo(() => validateDapodikStudent(form), [form]);

  if (!isCreating && !student) return null;

  const canEdit = userMode === 'petugas' || isCreating;

  const updateField = <K extends keyof DapodikStudent>(key: K, value: DapodikStudent[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(
      {
        ...form,
        vervalPdSyncAt: new Date().toISOString(),
      },
      isCreating
    );
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/60"
        onClick={onClose}
        aria-hidden="true"
      />

      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={isCreating ? 'Tambah Peserta Didik Dapodik' : `Detail Dapodik ${form.nama}`}
        className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-800">
                {form.nipd || 'NIPD Baru'}
              </span>
              <span aria-hidden="true">·</span>
              <span>NISN: <strong className="font-mono text-slate-800">{form.nisn || '—'}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Rombel: <strong className="text-slate-800">{form.rombelSaatIni || '—'}</strong></span>
              <span aria-hidden="true">·</span>
              {validation.level === 'Valid' ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Valid Dapodik</span>
                </span>
              ) : validation.level === 'Residu' ? (
                <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Residu ({validation.warningFields.length})</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-red-700">
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Invalid ({validation.invalidFields.length})</span>
                </span>
              )}
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">
              {isCreating ? 'Tambah Peserta Didik Baru (Aturan Dapodik)' : form.nama}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup modal data siswa"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-6 py-2">
          {(
            [
              { id: 'identitas', label: '1. Identitas & NIK' },
              { id: 'alamat', label: '2. Alamat & Periodik' },
              { id: 'ortu', label: '3. Orang Tua / Wali' },
              { id: 'registrasi', label: '4. Registrasi & Validasi' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Peringatan Validasi Ringkas */}
          {(validation.invalidFields.length > 0 || validation.warningFields.length > 0) && (
            <div
              className={`mb-5 rounded-lg border p-3.5 text-xs ${
                validation.invalidFields.length > 0
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {validation.invalidFields.length > 0
                    ? 'Terdapat data wajib Dapodik yang belum valid:'
                    : 'Catatan Residu / Kelengkapan VervalPD:'}
                </span>
              </div>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                {validation.invalidFields.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
                {validation.warningFields.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'identitas' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700">
                  Nama Lengkap (Sesuai Akta Kelahiran / Ijazah SMP) *
                </label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={form.nama}
                  onChange={(e) => updateField('nama', e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Jenis Kelamin *
                </label>
                <select
                  disabled={!canEdit}
                  value={form.jk}
                  onChange={(e) => updateField('jk', e.target.value as StudentGender)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  NIPD / NIS Sekolah
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.nipd}
                  onChange={(e) => updateField('nipd', e.target.value)}
                  placeholder="262710001"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-700">
                    NISN (10 Digit) *
                  </label>
                  <span className="font-mono text-[11px] text-slate-400">
                    {form.nisn.trim().length}/10
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={10}
                  disabled={!canEdit}
                  value={form.nisn}
                  onChange={(e) => updateField('nisn', e.target.value.replace(/\D/g, ''))}
                  placeholder="0094821735"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-700">
                    NIK Peserta Didik (16 Digit) *
                  </label>
                  <span className="font-mono text-[11px] text-slate-400">
                    {form.nik.trim().length}/16
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={16}
                  disabled={!canEdit}
                  value={form.nik}
                  onChange={(e) => updateField('nik', e.target.value.replace(/\D/g, ''))}
                  placeholder="357806xxxxxxxxxx"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-700">
                    Nomor Kartu Keluarga (16 Digit) *
                  </label>
                  <span className="font-mono text-[11px] text-slate-400">
                    {form.noKk.trim().length}/16
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={16}
                  disabled={!canEdit}
                  value={form.noKk}
                  onChange={(e) => updateField('noKk', e.target.value.replace(/\D/g, ''))}
                  placeholder="357806xxxxxxxxxx"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Tempat Lahir *
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.tempatLahir}
                  onChange={(e) => updateField('tempatLahir', e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Tanggal Lahir *
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={form.tanggalLahir}
                  onChange={(e) => updateField('tanggalLahir', e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  No. Registrasi Akta Lahir
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.noAktaLahir}
                  onChange={(e) => updateField('noAktaLahir', e.target.value)}
                  placeholder="3578-LU-xxxxxxxx-xxxx"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Agama *</label>
                <select
                  disabled={!canEdit}
                  value={form.agama}
                  onChange={(e) =>
                    updateField('agama', e.target.value as DapodikStudent['agama'])
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                >
                  <option value="Islam">Islam</option>
                  <option value="Kristen">Kristen</option>
                  <option value="Katolik">Katolik</option>
                  <option value="Hindu">Hindu</option>
                  <option value="Buddha">Buddha</option>
                  <option value="Konghucu">Konghucu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Kewarganegaraan & Anak Ke-
                </label>
                <div className="mt-1 flex gap-2">
                  <select
                    disabled={!canEdit}
                    value={form.kewarganegaraan}
                    onChange={(e) =>
                      updateField('kewarganegaraan', e.target.value as 'WNI' | 'WNA')
                    }
                    className="h-9 flex-1 rounded-lg border border-slate-300 px-2.5 text-sm disabled:bg-slate-50"
                  >
                    <option value="WNI">WNI</option>
                    <option value="WNA">WNA</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    disabled={!canEdit}
                    value={form.anakKeBerapa}
                    onChange={(e) => updateField('anakKeBerapa', Number(e.target.value) || 1)}
                    aria-label="Anak ke berapa"
                    className="h-9 w-20 rounded-lg border border-slate-300 px-2.5 font-mono text-sm disabled:bg-slate-50"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'alamat' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700">
                  Alamat Jalan (Sesuai KK)
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.alamatJalan}
                  onChange={(e) => updateField('alamatJalan', e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">RT</label>
                  <input
                    type="text"
                    maxLength={3}
                    disabled={!canEdit}
                    value={form.rt}
                    onChange={(e) => updateField('rt', e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">RW</label>
                  <input
                    type="text"
                    maxLength={3}
                    disabled={!canEdit}
                    value={form.rw}
                    onChange={(e) => updateField('rw', e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Desa / Kelurahan
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.kelurahan}
                  onChange={(e) => updateField('kelurahan', e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Kecamatan</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.kecamatan}
                  onChange={(e) => updateField('kecamatan', e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Kode Pos</label>
                <input
                  type="text"
                  maxLength={5}
                  disabled={!canEdit}
                  value={form.kodePos}
                  onChange={(e) => updateField('kodePos', e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Jenis Tinggal</label>
                <select
                  disabled={!canEdit}
                  value={form.jenisTinggal}
                  onChange={(e) =>
                    updateField('jenisTinggal', e.target.value as DapodikStudent['jenisTinggal'])
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                >
                  <option value="Bersama Orang Tua">Bersama Orang Tua</option>
                  <option value="Wali">Wali</option>
                  <option value="Kos">Kos</option>
                  <option value="Asrama">Asrama</option>
                  <option value="Panti Asuhan">Panti Asuhan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Alat Transportasi
                </label>
                <select
                  disabled={!canEdit}
                  value={form.alatTransportasi}
                  onChange={(e) =>
                    updateField(
                      'alatTransportasi',
                      e.target.value as DapodikStudent['alatTransportasi']
                    )
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                >
                  <option value="Jalan Kaki">Jalan Kaki</option>
                  <option value="Sepeda">Sepeda</option>
                  <option value="Sepeda Motor">Sepeda Motor</option>
                  <option value="Angkutan Umum">Angkutan Umum</option>
                  <option value="Mobil Pribadi">Mobil Pribadi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">No. HP / WhatsApp</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.hp}
                  onChange={(e) => updateField('hp', e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700">
                  Email (Akun belajar.id)
                </label>
                <input
                  type="email"
                  disabled={!canEdit}
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="nama.siswa@sma.belajar.id"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Tinggi (cm) / Berat (kg) / Jarak (km)
                </label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    disabled={!canEdit}
                    value={form.tinggiBadanCm}
                    onChange={(e) => updateField('tinggiBadanCm', Number(e.target.value) || 0)}
                    aria-label="Tinggi badan cm"
                    className="h-9 rounded-lg border border-slate-300 px-2 font-mono text-xs disabled:bg-slate-50"
                  />
                  <input
                    type="number"
                    disabled={!canEdit}
                    value={form.beratBadanKg}
                    onChange={(e) => updateField('beratBadanKg', Number(e.target.value) || 0)}
                    aria-label="Berat badan kg"
                    className="h-9 rounded-lg border border-slate-300 px-2 font-mono text-xs disabled:bg-slate-50"
                  />
                  <input
                    type="number"
                    step="0.1"
                    disabled={!canEdit}
                    value={form.jarakSekolahKm}
                    onChange={(e) => updateField('jarakSekolahKm', Number(e.target.value) || 0)}
                    aria-label="Jarak ke sekolah km"
                    className="h-9 rounded-lg border border-slate-300 px-2 font-mono text-xs disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="sm:col-span-3 flex flex-wrap items-center gap-6 border-t border-slate-100 pt-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={form.penerimaKip}
                    onChange={(e) => updateField('penerimaKip', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>Penerima KIP (Kartu Indonesia Pintar)</span>
                </label>
                {form.penerimaKip && (
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.noKip}
                    onChange={(e) => updateField('noKip', e.target.value)}
                    placeholder="Nomor KIP"
                    className="h-8 rounded-lg border border-slate-300 px-2.5 font-mono text-xs"
                  />
                )}
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={form.layakPip}
                    onChange={(e) => updateField('layakPip', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>Layak PIP</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'ortu' && (
            <div className="space-y-6">
              {/* Ibu Kandung (Prioritas VervalPD) */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Data Ibu Kandung (Wajib Kunci VervalPD)
                </h3>
                <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Nama Ibu Kandung *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!canEdit}
                      value={form.namaIbu}
                      onChange={(e) => updateField('namaIbu', e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      NIK Ibu (16 Digit)
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      disabled={!canEdit}
                      value={form.nikIbu}
                      onChange={(e) => updateField('nikIbu', e.target.value.replace(/\D/g, ''))}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Pendidikan Terakhir
                    </label>
                    <select
                      disabled={!canEdit}
                      value={form.pendidikanIbu}
                      onChange={(e) => updateField('pendidikanIbu', e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                    >
                      {EDUCATION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Pekerjaan Ibu</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.pekerjaanIbu}
                      onChange={(e) => updateField('pekerjaanIbu', e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Penghasilan Bulanan Ibu
                    </label>
                    <select
                      disabled={!canEdit}
                      value={form.penghasilanIbu}
                      onChange={(e) => updateField('penghasilanIbu', e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                    >
                      {INCOME_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Ayah */}
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Data Ayah Kandung
                </h3>
                <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Nama Ayah</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.namaAyah}
                      onChange={(e) => updateField('namaAyah', e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      NIK Ayah (16 Digit)
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      disabled={!canEdit}
                      value={form.nikAyah}
                      onChange={(e) => updateField('nikAyah', e.target.value.replace(/\D/g, ''))}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Pendidikan Terakhir
                    </label>
                    <select
                      disabled={!canEdit}
                      value={form.pendidikanAyah}
                      onChange={(e) => updateField('pendidikanAyah', e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                    >
                      {EDUCATION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Pekerjaan Ayah</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.pekerjaanAyah}
                      onChange={(e) => updateField('pekerjaanAyah', e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Penghasilan Bulanan Ayah
                    </label>
                    <select
                      disabled={!canEdit}
                      value={form.penghasilanAyah}
                      onChange={(e) => updateField('penghasilanAyah', e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                    >
                      {INCOME_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'registrasi' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Tingkat Kelas
                </label>
                <select
                  disabled={!canEdit}
                  value={form.tingkatKelas}
                  onChange={(e) =>
                    updateField('tingkatKelas', e.target.value as DapodikStudent['tingkatKelas'])
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                >
                  <option value="X">Kelas X</option>
                  <option value="XI">Kelas XI</option>
                  <option value="XII">Kelas XII</option>
                  <option value="Alumni">Alumni / Lulus</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Rombongan Belajar (Rombel) *
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.rombelSaatIni}
                  onChange={(e) => updateField('rombelSaatIni', e.target.value)}
                  placeholder="Contoh: XI-F3"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Status Registrasi</label>
                <select
                  disabled={!canEdit}
                  value={form.statusSiswa}
                  onChange={(e) => updateField('statusSiswa', e.target.value as StudentStatus)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Mutasi Keluar">Mutasi Keluar</option>
                  <option value="Lulus">Lulus</option>
                  <option value="Mengundurkan Diri">Mengundurkan Diri</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Jenis Pendaftaran
                </label>
                <select
                  disabled={!canEdit}
                  value={form.jenisPendaftaran}
                  onChange={(e) =>
                    updateField(
                      'jenisPendaftaran',
                      e.target.value as 'Siswa Baru' | 'Pindahan'
                    )
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                >
                  <option value="Siswa Baru">Siswa Baru</option>
                  <option value="Pindahan">Pindahan (Mutasi Masuk)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Tanggal Masuk Sekolah
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={form.tanggalMasuk}
                  onChange={(e) => updateField('tanggalMasuk', e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Kurikulum</label>
                <select
                  disabled={!canEdit}
                  value={form.kurikulum}
                  onChange={(e) =>
                    updateField('kurikulum', e.target.value as DapodikStudent['kurikulum'])
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                >
                  <option value="Kurikulum Merdeka">Kurikulum Merdeka</option>
                  <option value="Kurikulum 2013">Kurikulum 2013</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700">
                  Sekolah Asal (SMP / MTs) *
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.asalSmp}
                  onChange={(e) => updateField('asalSmp', e.target.value)}
                  placeholder="Contoh: SMP Negeri 1 Surabaya"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  No. Seri Ijazah SMP/MTs
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.noSeriIjazahSmp}
                  onChange={(e) => updateField('noSeriIjazahSmp', e.target.value)}
                  placeholder="DN-05/D-SMP/..."
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs disabled:bg-slate-50"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {!isCreating && (
              <>
                <button
                  type="button"
                  onClick={() => onCreateLetterFromStudent(form, 'surat-aktif')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  <FilePlus2 className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                  <span>Ajukan Surat Aktif</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCreateLetterFromStudent(form, 'perbaikan-data')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                  <span>Ajukan VervalPD</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isCreating && userMode === 'petugas' && (
              <button
                type="button"
                onClick={() => onDelete(form.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Hapus</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              Tutup
            </button>
            {canEdit && (
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isCreating ? 'Simpan ke Database Dapodik' : 'Simpan Perubahan'}</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
