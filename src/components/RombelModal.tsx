import { School, Trash2, User, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DapodikGtk, DapodikRombel } from '../types/tu';
import { formatPtkDisplayName } from '../utils/gtkDapodikValidation';
import { normalizeRombelRecord } from '../utils/rombelDapodikUtils';

interface RombelModalProps {
  rombel: DapodikRombel | null;
  isCreating: boolean;
  gtkList: DapodikGtk[];
  onClose: () => void;
  onSave: (rombel: DapodikRombel, isNew: boolean) => void;
  onDelete: (id: string) => void;
}

const EMPTY_ROMBEL: DapodikRombel = {
  id: '',
  namaRombel: '',
  tingkatKelas: '10',
  jumlahL: 0,
  jumlahP: 0,
  jumlahTotal: 0,
  waliKelasId: '',
  waliKelasNama: '',
  kurikulum: 'KURIKULUM SMA MERDEKA',
  ruangan: '',
};

export function RombelModal({
  rombel,
  isCreating,
  gtkList,
  onClose,
  onSave,
  onDelete,
}: RombelModalProps) {
  const [form, setForm] = useState<DapodikRombel>(EMPTY_ROMBEL);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    if (isCreating) {
      setForm({ ...EMPTY_ROMBEL, id: `rombel-${Date.now()}` });
    } else if (rombel) {
      setForm(normalizeRombelRecord({ ...EMPTY_ROMBEL, ...rombel }, gtkList));
    }
  }, [rombel, isCreating, gtkList]);

  const sortedGtk = useMemo(
    () =>
      [...gtkList].sort((a, b) =>
        a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
      ),
    [gtkList]
  );

  const selectedGtk = useMemo(() => {
    if (form.waliKelasId) {
      const byId = gtkList.find((g) => g.id === form.waliKelasId);
      if (byId) return byId;
    }
    const cleanWali = form.waliKelasNama.trim().toUpperCase();
    if (!cleanWali) return undefined;
    return gtkList.find((g) => g.nama.trim().toUpperCase() === cleanWali);
  }, [form.waliKelasId, form.waliKelasNama, gtkList]);

  if (!isCreating && !rombel) return null;

  const computedTotal = Math.max(0, Number(form.jumlahL) || 0) + Math.max(0, Number(form.jumlahP) || 0);

  const handleSelectWaliGtk = (gtkId: string) => {
    if (!gtkId) {
      setForm((prev) => ({ ...prev, waliKelasId: '' }));
      return;
    }
    const found = gtkList.find((g) => g.id === gtkId);
    if (found) {
      setForm((prev) => ({
        ...prev,
        waliKelasId: found.id,
        waliKelasNama: found.nama.trim().toUpperCase(),
      }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.namaRombel.trim()) return;
    const normalized = normalizeRombelRecord(
      {
        ...form,
        jumlahTotal: computedTotal,
      },
      gtkList
    );
    onSave(normalized, isCreating);
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/60" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isCreating ? 'Tambah Rombongan Belajar' : `Setting Rombel ${form.namaRombel}`}
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <School className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {isCreating
                  ? 'Tambah Rombongan Belajar & Wali Kelas'
                  : `Setting Rombel ${form.namaRombel}`}
              </h2>
              <p className="text-xs text-slate-500">
                Atur ruang kelas, jumlah peserta didik L/P, kurikulum, dan penetapan Wali Kelas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup modal rombel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Pratinjau Wali Kelas */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 uppercase">
              <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {selectedGtk?.fotoDataUrl ? (
                  <img
                    src={selectedGtk.fotoDataUrl}
                    alt={form.waliKelasNama}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <User className="h-5 w-5" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500">WALI KELAS TERPILIH</p>
                <p className="truncate text-sm font-semibold text-slate-900">
                  {selectedGtk
                    ? formatPtkDisplayName(selectedGtk)
                    : form.waliKelasNama || 'BELUM DITETAPKAN'}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-600">
                  {selectedGtk
                    ? `${selectedGtk.jabatanPtk || selectedGtk.jenisPtk} · ${selectedGtk.statusKepegawaian}${
                        selectedGtk.nip ? ` · NIP ${selectedGtk.nip}` : ''
                      }`
                    : 'PILIH GURU DARI DATABASE PTK ATAU KETIK NAMA WALI KELAS'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Nama Rombel *
                </label>
                <input
                  type="text"
                  required
                  value={form.namaRombel}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, namaRombel: e.target.value.toUpperCase() }))
                  }
                  placeholder="CONTOH: X-1 / XI-A1"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Tingkat Kelas *
                </label>
                <select
                  value={form.tingkatKelas}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      tingkatKelas: e.target.value as DapodikRombel['tingkatKelas'],
                    }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900"
                >
                  <option value="10">Tingkat 10 (Kelas X)</option>
                  <option value="11">Tingkat 11 (Kelas XI)</option>
                  <option value="12">Tingkat 12 (Kelas XII)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Ruangan *</label>
                <input
                  type="text"
                  value={form.ruangan}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, ruangan: e.target.value.toUpperCase() }))
                  }
                  placeholder="CONTOH: X-1 / XII-D3"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Pilih Wali Kelas (Database GTK SMAN 9)
                </label>
                <select
                  value={selectedGtk?.id || ''}
                  onChange={(e) => handleSelectWaliGtk(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs uppercase text-slate-900"
                >
                  <option value="">-- PILIH DARI DAFTAR PTK --</option>
                  {sortedGtk.map((g) => (
                    <option key={g.id} value={g.id}>
                      {formatPtkDisplayName(g)} ({g.jabatanPtk || g.jenisPtk})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Nama Wali Kelas (Tercetak di Dapodik) *
                </label>
                <input
                  type="text"
                  required
                  value={form.waliKelasNama}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      waliKelasId: '',
                      waliKelasNama: e.target.value.toUpperCase(),
                    }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">Siswa Laki-laki (L)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={form.jumlahL}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, jumlahL: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs tabular-nums text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Siswa Perempuan (P)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={form.jumlahP}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, jumlahP: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs tabular-nums text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Total Siswa</label>
                <div className="mt-1 flex h-9 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 font-mono text-xs font-semibold tabular-nums text-slate-900">
                  {computedTotal} SISWA
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Kurikulum</label>
                <input
                  type="text"
                  value={form.kurikulum}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, kurikulum: e.target.value.toUpperCase() }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs uppercase text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
            <div>
              {!isCreating && (
                confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(form.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    <span>Konfirmasi Hapus Rombel</span>
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
                )
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
                Simpan Setting Rombel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
