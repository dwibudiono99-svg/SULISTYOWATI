import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FilePlus2,
  ShieldCheck,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DapodikGtk } from '../types/tu';
import {
  applyDispendukcapilCheck,
  formatPtkDisplayName,
  normalizeGtkProfileUppercase,
  padankanNikDispendukcapil,
} from '../utils/gtkDapodikValidation';
import { processPtkPhotoFile } from '../utils/ptkPhotoHelper';

interface GtkDetailModalProps {
  gtk: DapodikGtk | null;
  isCreating: boolean;
  onClose: () => void;
  onSave: (gtk: DapodikGtk, isNew: boolean) => void;
  onDelete: (id: string) => void;
  onCreateLetterFromGtk: (gtk: DapodikGtk) => void;
}

const EMPTY_GTK: DapodikGtk = {
  id: '',
  nama: '',
  nuptk: '',
  jk: 'L',
  tempatLahir: 'Surabaya',
  tanggalLahir: '',
  nip: '',
  statusKepegawaian: 'PNS',
  jenisPtk: 'Guru',
  agama: 'Islam',
  alamatJalan: '',
  rt: '',
  rw: '',
  kelurahan: '',
  kecamatan: '',
  kodePos: '',
  hp: '',
  email: '',
  tugasTambahan: '',
  statusTugas: 'Induk',
  skPengangkatan: '',
  tmtPengangkatan: '',
  pangkatGolongan: '',
  nik: '',
  noKk: '',
  namaIbuKandung: '',
  npwp: '',
  fotoDataUrl: '',
  gelarDepan: '',
  gelarBelakang: '',
  jenjang: 'S1',
  jurusanProdi: '',
  sertifikasi: '',
  tmtKerja: '',
  mengajar: '',
  jamTugasTambahan: '',
  jjm: '',
  totalJjm: '',
  jumlahSiswa: '',
  kompetensi: '',
  jabatanPtk: '',
  dukcapilStatus: 'Residu Data',
  dukcapilNotes: '',
  dukcapilCheckedAt: '',
};

function getInitials(name: string): string {
  const parts = name
    .replace(/,.*$/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'PTK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function GtkDetailModal({
  gtk,
  isCreating,
  onClose,
  onSave,
  onDelete,
  onCreateLetterFromGtk,
}: GtkDetailModalProps) {
  const [form, setForm] = useState<DapodikGtk>(EMPTY_GTK);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfirmDelete(false);
    setPhotoError('');
    if (isCreating) {
      setForm(normalizeGtkProfileUppercase({ ...EMPTY_GTK, id: `gtk-${Date.now()}` }));
    } else if (gtk) {
      setForm(normalizeGtkProfileUppercase({ ...EMPTY_GTK, ...gtk }));
    }
  }, [gtk, isCreating]);

  const liveCheck = useMemo(() => padankanNikDispendukcapil(form), [form]);
  const displayName = useMemo(
    () => (form.nama.trim() ? formatPtkDisplayName(form) : 'PTK BARU SMAN 9 SURABAYA'),
    [form]
  );

  if (!isCreating && !gtk) return null;

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (!file) return;

    setPhotoError('');
    setUploadingPhoto(true);
    try {
      const dataUrl = await processPtkPhotoFile(file);
      setForm((prev) => ({ ...prev, fotoDataUrl: dataUrl }));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Gagal mengunggah foto PTK.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) return;
    onSave(applyDispendukcapilCheck(form), isCreating);
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/60" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isCreating ? 'Tambah Profil PTK Dapodik' : `Profil PTK ${displayName}`}
        className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="uppercase">
            <h2 className="text-base font-semibold text-slate-900">
              {isCreating ? 'TAMBAH PROFIL PTK BARU (DAPODIK)' : `PROFIL PTK — ${displayName}`}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {form.jabatanPtk || form.jenisPtk} · {form.statusKepegawaian}
              {form.nip ? ` · NIP ${form.nip}` : form.nuptk ? ` · NUPTK ${form.nuptk}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup modal profil PTK"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Kartu Profil Atas + Menu Upload Foto PTK */}
            <div className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-white">
                  {form.fotoDataUrl ? (
                    <img
                      src={form.fotoDataUrl}
                      alt={`Foto ${displayName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 text-slate-500">
                      <User className="h-7 w-7 text-slate-400" aria-hidden="true" />
                      <span className="mt-1 font-mono text-xs font-semibold">
                        {getInitials(form.nama)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="uppercase">
                    <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                    <p className="text-xs text-slate-600">
                      {form.jabatanPtk || form.jenisPtk} · {form.statusKepegawaian}
                    </p>
                    {form.mengajar && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        MENGAJAR: {form.mengajar}
                        {form.totalJjm ? ` (${form.totalJjm} JJM)` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => void handlePhotoUpload(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => photoInputRef.current?.click()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
                    >
                      <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {uploadingPhoto
                          ? 'Memproses Foto...'
                          : form.fotoDataUrl
                            ? 'Ganti Foto PTK'
                            : 'Upload Foto PTK'}
                      </span>
                    </button>
                    {form.fotoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, fotoDataUrl: '' }))}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-50 whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Hapus Foto</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Format JPG, PNG, atau WEBP (maks. 5 MB). Otomatis dioptimalkan untuk kartu profil PTK.
                  </p>
                  {photoError && (
                    <p role="alert" className="text-xs font-medium text-rose-700">
                      {photoError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Panel Diagnosa Padan NIK Dispendukcapil Langsung */}
            <div
              className={`rounded-xl border p-4 ${
                liveCheck.status === 'Padan Dispendukcapil'
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : liveCheck.status === 'Residu Data'
                    ? 'border-amber-200 bg-amber-50/70'
                    : 'border-rose-200 bg-rose-50/70'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {liveCheck.status === 'Padan Dispendukcapil' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      <span className="text-emerald-900">Status Dispendukcapil: Padan</span>
                    </>
                  ) : liveCheck.status === 'Residu Data' ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
                      <span className="text-amber-900">Status Dispendukcapil: Residu Data</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-rose-700" aria-hidden="true" />
                      <span className="text-rose-900">Status Dispendukcapil: Tidak Padan NIK</span>
                    </>
                  )}
                </div>
                <span className="font-mono text-[11px] text-slate-600">
                  Kode Wilayah: {liveCheck.decodedRegion}
                </span>
              </div>

              <p className="mt-1.5 text-xs text-slate-700">
                Pembacaan NIK Dukcapil:{' '}
                <strong className="font-mono">{liveCheck.decodedBirthAndGender}</strong>
              </p>

              {(liveCheck.invalidFields.length > 0 || liveCheck.warningFields.length > 0) && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                  {liveCheck.invalidFields.map((msg) => (
                    <li key={msg} className="font-medium text-rose-800">
                      {msg}
                    </li>
                  ))}
                  {liveCheck.warningFields.map((msg) => (
                    <li key={msg} className="text-amber-800">
                      {msg}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Identitas Kependudukan (Kunci Padan Dispendukcapil) */}
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                <span>Identitas & Kependudukan Dispendukcapil</span>
              </h3>
              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Lengkap PTK (Tanpa Gelar) *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nama}
                    onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value.toUpperCase() }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Jenis Kelamin</label>
                  <select
                    value={form.jk}
                    onChange={(e) => setForm((p) => ({ ...p, jk: e.target.value as 'L' | 'P' }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs uppercase text-slate-900"
                  >
                    <option value="L">L — LAKI-LAKI</option>
                    <option value="P">P — PEREMPUAN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    NIK (16 Digit KTP/KK) *
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={form.nik}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, nik: e.target.value.replace(/\D/g, '') }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nomor Kartu Keluarga (16 Digit)
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={form.noKk}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, noKk: e.target.value.replace(/\D/g, '') }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Ibu Kandung (VervalPTK)
                  </label>
                  <input
                    type="text"
                    value={form.namaIbuKandung}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, namaIbuKandung: e.target.value.toUpperCase() }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Tempat Lahir</label>
                  <input
                    type="text"
                    value={form.tempatLahir}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, tempatLahir: e.target.value.toUpperCase() }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Tanggal Lahir (Dapodik)
                  </label>
                  <input
                    type="date"
                    value={form.tanggalLahir}
                    onChange={(e) => setForm((p) => ({ ...p, tanggalLahir: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">NPWP</label>
                  <input
                    type="text"
                    value={form.npwp}
                    onChange={(e) => setForm((p) => ({ ...p, npwp: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Kualifikasi Akademik & Sertifikasi */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Kualifikasi Akademik & Sertifikasi (Dapodik)
              </h3>
              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Gelar Depan</label>
                  <input
                    type="text"
                    value={form.gelarDepan || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, gelarDepan: e.target.value.toUpperCase() }))
                    }
                    placeholder="CONTOH: DRA / DRS"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Gelar Belakang</label>
                  <input
                    type="text"
                    value={form.gelarBelakang || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, gelarBelakang: e.target.value.toUpperCase() }))
                    }
                    placeholder="CONTOH: S.PD, M.PD"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Jenjang</label>
                  <input
                    type="text"
                    value={form.jenjang || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, jenjang: e.target.value.toUpperCase() }))
                    }
                    placeholder="S1 / S2 / D3 / SMA"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Jurusan / Prodi</label>
                  <input
                    type="text"
                    value={form.jurusanProdi || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, jurusanProdi: e.target.value.toUpperCase() }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Sertifikasi</label>
                  <input
                    type="text"
                    value={form.sertifikasi || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, sertifikasi: e.target.value.toUpperCase() }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Kompetensi</label>
                  <input
                    type="text"
                    value={form.kompetensi || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, kompetensi: e.target.value.toUpperCase() }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Kepegawaian & Beban Mengajar (JJM) */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Kepegawaian, Jabatan PTK & Beban Jam (JJM)
              </h3>
              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">NIP (18 Digit)</label>
                  <input
                    type="text"
                    maxLength={18}
                    value={form.nip}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, nip: e.target.value.replace(/\D/g, '') }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">NUPTK (16 Digit)</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={form.nuptk}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, nuptk: e.target.value.replace(/\D/g, '') }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">TMT Kerja</label>
                  <input
                    type="date"
                    value={form.tmtKerja || form.tmtPengangkatan}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        tmtKerja: e.target.value,
                        tmtPengangkatan: e.target.value,
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Status Kepegawaian
                  </label>
                  <select
                    value={form.statusKepegawaian}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        statusKepegawaian: e.target.value as DapodikGtk['statusKepegawaian'],
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs uppercase text-slate-900"
                  >
                    <option value="PNS">PNS</option>
                    <option value="PPPK">PPPK</option>
                    <option value="PPPK Paruh Waktu">PPPK PARUH WAKTU</option>
                    <option value="CPNS">CPNS</option>
                    <option value="GTY/PTY">GTY/PTY</option>
                    <option value="Guru Honor Sekolah">GURU HONOR SEKOLAH</option>
                    <option value="Tenaga Honor Sekolah">TENAGA HONOR SEKOLAH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Jenis PTK</label>
                  <select
                    value={form.jenisPtk}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, jenisPtk: e.target.value as DapodikGtk['jenisPtk'] }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs uppercase text-slate-900"
                  >
                    <option value="Guru">GURU</option>
                    <option value="Kepala Sekolah">KEPALA SEKOLAH</option>
                    <option value="Tenaga Kependidikan">TENAGA KEPENDIDIKAN</option>
                    <option value="Guru Mapel">GURU MAPEL</option>
                    <option value="Guru BK">GURU BK</option>
                    <option value="Tenaga Administrasi Sekolah">TENAGA ADMINISTRASI SEKOLAH</option>
                    <option value="Pustakawan">PUSTAKAWAN</option>
                    <option value="Laboran">LABORAN</option>
                    <option value="Penjaga Sekolah">PENJAGA SEKOLAH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Jabatan PTK</label>
                  <input
                    type="text"
                    value={form.jabatanPtk || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, jabatanPtk: e.target.value.toUpperCase() }))
                    }
                    placeholder="CONTOH: GURU KIMIA / PUSTAKAWAN"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">Tugas Tambahan</label>
                  <input
                    type="text"
                    value={form.tugasTambahan}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, tugasTambahan: e.target.value.toUpperCase() }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Jumlah Siswa</label>
                  <input
                    type="text"
                    value={form.jumlahSiswa || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, jumlahSiswa: e.target.value.toUpperCase() }))
                    }
                    placeholder="CONTOH: 171 SISWA"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-700">
                    Mata Pelajaran / Mengajar
                  </label>
                  <input
                    type="text"
                    value={form.mengajar || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, mengajar: e.target.value.toUpperCase() }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Jam Tugas Tambahan
                  </label>
                  <input
                    type="text"
                    value={form.jamTugasTambahan || ''}
                    onChange={(e) => setForm((p) => ({ ...p, jamTugasTambahan: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">JJM Mengajar</label>
                  <input
                    type="text"
                    value={form.jjm || ''}
                    onChange={(e) => setForm((p) => ({ ...p, jjm: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Total JJM</label>
                  <input
                    type="text"
                    value={form.totalJjm || ''}
                    onChange={(e) => setForm((p) => ({ ...p, totalJjm: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nomor HP / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={form.hp}
                    onChange={(e) => setForm((p) => ({ ...p, hp: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Email belajar.id / Pribadi
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
            <div className="flex items-center gap-2">
              {!isCreating && (
                <>
                  <button
                    type="button"
                    onClick={() => onCreateLetterFromGtk(form)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Buat Surat Tugas</span>
                  </button>
                  {confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(form.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      <span>Konfirmasi Hapus</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Hapus</span>
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Simpan Profil PTK
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
