import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DapodikGtk } from '../types/tu';
import {
  exportGtkWorkbook,
  GTK_DAPODIK_HEADERS,
  gtkListToCsv,
  padankanNikDispendukcapil,
  ParsedGtkImport,
  parseGtkDapodikFile,
} from '../utils/gtkDapodikValidation';
import { ImportMergeMode } from './DapodikImportExportModal';

interface GtkImportExportModalProps {
  open: boolean;
  initialTab?: 'import' | 'export';
  gtkList: DapodikGtk[];
  isDatabaseLocked?: boolean;
  tahunPelajaran?: string;
  onClose: () => void;
  onConfirmImport: (imported: DapodikGtk[], mode: ImportMergeMode) => Promise<boolean | void> | void;
}

export function GtkImportExportModal({
  open,
  initialTab = 'import',
  gtkList,
  isDatabaseLocked = true,
  tahunPelajaran = '2026/2027',
  onClose,
  onConfirmImport,
}: GtkImportExportModalProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>(initialTab);
  const [mergeMode, setMergeMode] = useState<ImportMergeMode>('upsert');
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedGtkImport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      if (isDatabaseLocked && mergeMode === 'replace') {
        setMergeMode('upsert');
      }
    }
  }, [open, initialTab, isDatabaseLocked, mergeMode]);

  const previewStats = useMemo(() => {
    if (!parsedResult) return null;
    let padan = 0;
    let residu = 0;
    let invalid = 0;
    for (const g of parsedResult.gtkList) {
      if (g.dukcapilStatus === 'Padan Dispendukcapil') padan++;
      else if (g.dukcapilStatus === 'Residu Data') residu++;
      else invalid++;
    }
    return { total: parsedResult.gtkList.length, padan, residu, invalid };
  }, [parsedResult]);

  if (!open) return null;

  const processFile = async (file: File) => {
    setErrorMsg('');
    setParsing(true);
    setFileName(file.name);
    try {
      const result = await parseGtkDapodikFile(file);
      if (result.gtkList.length === 0) {
        setErrorMsg('Tidak ditemukan baris data GTK pada file yang diunggah.');
        setParsedResult(null);
      } else {
        setParsedResult(result);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal memproses file GTK. Pastikan format .xlsx, .xls, atau .csv sesuai Daftar GTK Dapodik.'
      );
      setParsedResult(null);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handleExportCsv = () => {
    const csv = gtkListToCsv(gtkList);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dapodik-gtk-sman9sby-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/60" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Upload, Ekspor & Padan NIK Dispendukcapil Database GTK Dapodik"
        className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">
              Upload & Ekspor Database GTK Dapodik — Padan NIK Dispendukcapil
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Unggah berkas Excel/CSV Daftar GTK Dapodik. Sistem langsung memadankan struktur NIK (kode wilayah, tanggal lahir & jenis kelamin) dengan aturan Dispendukcapil.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup modal upload GTK"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-6 py-2">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'import'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Upload & Uji Padan NIK GTK</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'export'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ekspor & Unduh Template ({gtkList.length} GTK)</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'import' ? (
            <div className="space-y-5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  dragging
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-300 bg-slate-50/70 hover:border-slate-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileSpreadsheet className="mx-auto h-9 w-9 text-slate-500" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {parsing
                    ? 'Membaca Daftar GTK & memadankan NIK dengan aturan Dispendukcapil...'
                    : fileName
                      ? `File terpilih: ${fileName}`
                      : 'Tarik & letakkan file Excel / CSV Daftar GTK Dapodik di sini'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Mendukung .xlsx, .xls, dan .csv. Kolom NUPTK, NIP, NIK, No KK, dan Nama Ibu Kandung otomatis divalidasi terhadap tanggal lahir & jenis kelamin NIK Dukcapil.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Pilih File GTK dari Komputer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportGtkWorkbook(gtkList, true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Unduh Template GTK (.xlsx)</span>
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
                >
                  {errorMsg}
                </div>
              )}

              {parsedResult && previewStats && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">GTK Terbaca</p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
                        {previewStats.total}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Padan Dispendukcapil</p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-emerald-700">
                        {previewStats.padan}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Residu Data</p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-amber-700">
                        {previewStats.residu}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tidak Padan NIK</p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-red-700">
                        {previewStats.invalid}
                      </p>
                    </div>
                  </div>

                  {/* Opsi Penggabungan */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800">
                        Metode Penggabungan ke Database GTK (TP {tahunPelajaran}):
                      </p>
                      <span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        <span>Terkunci TP {tahunPelajaran} & Terlacak Mutasi</span>
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Data hasil impor dikunci ke Database GTK Tahun Pelajaran {tahunPelajaran}. Perubahan, penambahan, atau pengurangan GTK terekam di Pelacakan Keluar Masuk Data.
                    </p>
                    <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {(
                        [
                          {
                            id: 'upsert',
                            title: 'Gabung & Perbarui (Disarankan)',
                            desc: 'Cocokkan berdasarkan NIK, NIP, atau NUPTK dan perbarui datanya.',
                          },
                          {
                            id: 'append',
                            title: 'Tambahkan Semua Baru',
                            desc: 'Tambahkan seluruh baris GTK tanpa menimpa data lama.',
                          },
                          {
                            id: 'replace',
                            title: isDatabaseLocked
                              ? 'Ganti Penuh (Terkunci)'
                              : 'Ganti Seluruh Database GTK',
                            desc: isDatabaseLocked
                              ? `Dinonaktifkan saat dikunci ke TP ${tahunPelajaran} agar data lama tidak terhapus massal.`
                              : 'Ganti penuh daftar GTK dengan file unggahan baru.',
                          },
                        ] as const
                      ).map((opt) => {
                        const isBlocked = opt.id === 'replace' && isDatabaseLocked;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={isBlocked}
                            onClick={() => !isBlocked && setMergeMode(opt.id)}
                            className={`rounded-lg border p-3 text-left transition-colors ${
                              isBlocked
                                ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-60'
                                : mergeMode === opt.id
                                  ? 'border-blue-600 bg-blue-50/70'
                                  : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-xs font-semibold text-slate-900">{opt.title}</div>
                            <div className="mt-0.5 text-[11px] leading-snug text-slate-600">
                              {opt.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-64 overflow-auto rounded-lg border border-slate-300 bg-white">
                    <table className="w-max min-w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
                        <tr>
                          <th className="border-b border-r border-slate-300 px-2.5 py-2 font-semibold">No</th>
                          <th className="border-b border-r border-slate-300 px-2.5 py-2 font-semibold">Padan Dispendukcapil</th>
                          <th className="border-b border-r border-slate-300 px-2.5 py-2 font-semibold">Nama GTK</th>
                          <th className="border-b border-r border-slate-300 px-2.5 py-2 font-semibold">NIK (16 Digit)</th>
                          <th className="border-b border-r border-slate-300 px-2.5 py-2 font-semibold">Wilayah & Tgl Lahir NIK</th>
                          <th className="border-b border-r border-slate-300 px-2.5 py-2 font-semibold">Nama Ibu Kandung</th>
                          <th className="border-b border-slate-300 px-2.5 py-2 font-semibold">NIP / NUPTK</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono text-[11px] tabular-nums">
                        {parsedResult.gtkList.slice(0, 50).map((g, idx) => {
                          const res = padankanNikDispendukcapil(g);
                          return (
                            <tr key={g.id} className="hover:bg-slate-50">
                              <td className="border-r border-slate-200 px-2.5 py-1.5 text-right text-slate-500">
                                {idx + 1}
                              </td>
                              <td className="border-r border-slate-200 px-2.5 py-1.5 font-sans">
                                {res.status === 'Padan Dispendukcapil' ? (
                                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                    <CheckCircle2 className="h-3 w-3" /> Padan
                                  </span>
                                ) : res.status === 'Residu Data' ? (
                                  <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                                    <AlertTriangle className="h-3 w-3" /> Residu
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-medium text-red-700">
                                    <XCircle className="h-3 w-3" /> Tidak Padan
                                  </span>
                                )}
                              </td>
                              <td className="border-r border-slate-200 px-2.5 py-1.5 font-sans font-medium text-slate-900 whitespace-nowrap">
                                {g.nama} ({g.jk})
                              </td>
                              <td className="border-r border-slate-200 px-2.5 py-1.5">
                                {g.nik || '—'}
                              </td>
                              <td className="border-r border-slate-200 px-2.5 py-1.5 font-sans text-slate-600">
                                {res.decodedRegion} · {res.decodedBirthAndGender}
                              </td>
                              <td className="border-r border-slate-200 px-2.5 py-1.5 font-sans">
                                {g.namaIbuKandung || '—'}
                              </td>
                              <td className="px-2.5 py-1.5">
                                {g.nip || g.nuptk || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Ekspor Excel GTK (.xlsx)
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Mengunduh seluruh {gtkList.length} data GTK format Dapodik (NIK, No KK, NIP, NUPTK diformat teks agar presisi).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => exportGtkWorkbook(gtkList, false)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Unduh Excel (.xlsx)</span>
                  </button>
                </div>

                <div className="flex flex-col justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Ekspor Data CSV (.csv)
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Format CSV UTF-8 BOM untuk rekapitulasi kepegawaian TU maupun VervalPTK.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Unduh CSV (.csv)</span>
                  </button>
                </div>

                <div className="flex flex-col justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Template Daftar GTK (.xlsx)
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Unduh lembar kerja Excel kosong berisi 27 kolom standar Daftar GTK Dapodik & Dukcapil.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => exportGtkWorkbook(gtkList, true)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Unduh Template GTK</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-semibold text-slate-900">
                  Struktur Kolom Daftar GTK Dapodik yang Didukung:
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 sm:grid-cols-3 md:grid-cols-4">
                  {GTK_DAPODIK_HEADERS.map((col, idx) => (
                    <div key={col} className="truncate font-mono">
                      <span className="text-slate-400">{String(idx + 1).padStart(2, '0')}.</span>{' '}
                      <span className="font-sans text-slate-800">{col}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <span className="text-xs text-slate-500">
            Validasi Dispendukcapil: NIK 16 digit, kode wilayah, kesesuaian DDMMYY & JK (+40 wanita), No KK 16 digit, Nama Ibu Kandung.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Tutup
            </button>
            {activeTab === 'import' && parsedResult && (
              <button
                type="button"
                disabled={savingImport}
                onClick={async () => {
                  if (savingImport) return;
                  setSavingImport(true);
                  setErrorMsg('');
                  try {
                    const res = await onConfirmImport(parsedResult.gtkList, mergeMode);
                    if (res !== false) {
                      setParsedResult(null);
                      setFileName('');
                      onClose();
                    } else {
                      setErrorMsg('Gagal menyimpan ke repositori GTK. Silakan coba lagi.');
                    }
                  } finally {
                    setSavingImport(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:bg-blue-400"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {savingImport
                    ? 'Menyimpan ke Repositori...'
                    : `Impor ${parsedResult.gtkList.length} GTK ke Database`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
