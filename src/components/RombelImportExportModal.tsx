import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { DapodikGtk, DapodikRombel } from '../types/tu';
import {
  exportRombelWorkbook,
  ParsedRombelImport,
  parseRombelDapodikFile,
  rombelListToCsv,
} from '../utils/rombelDapodikUtils';
import { ImportMergeMode } from './DapodikImportExportModal';

interface RombelImportExportModalProps {
  open: boolean;
  initialTab: 'import' | 'export';
  rombels: DapodikRombel[];
  gtkList: DapodikGtk[];
  onClose: () => void;
  onConfirmImport: (imported: DapodikRombel[], mode: ImportMergeMode) => Promise<boolean | void> | void;
}

export function RombelImportExportModal({
  open,
  initialTab,
  rombels,
  gtkList,
  onClose,
  onConfirmImport,
}: RombelImportExportModalProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>(initialTab);
  const [mergeMode, setMergeMode] = useState<ImportMergeMode>('upsert');
  const [parsing, setParsing] = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedRombelImport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => {
    if (!parsedResult) return null;
    const totalRombel = parsedResult.rombels.length;
    const totalSiswa = parsedResult.rombels.reduce((acc, r) => acc + r.jumlahTotal, 0);
    return { totalRombel, totalSiswa };
  }, [parsedResult]);

  if (!open) return null;

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setFileName(file.name);
    setParsing(true);
    try {
      const result = await parseRombelDapodikFile(file, gtkList);
      if (result.rombels.length === 0) {
        setErrorMsg('Tidak ada baris rombongan belajar yang ditemukan di file ini.');
        setParsedResult(null);
      } else {
        setParsedResult(result);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membaca file Rombel.');
      setParsedResult(null);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadCsv = () => {
    const csv = rombelListToCsv(rombels);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rombel-wali-kelas-sman9sby-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/60" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Impor dan Ekspor Rombongan Belajar Dapodik"
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Impor & Ekspor Rombongan Belajar Dapodik
              </h2>
              <p className="text-xs text-slate-500">
                Mendukung format 2 baris header Dapodik (Jumlah Siswa: L / P / Total, Wali Kelas, Kurikulum, Ruangan).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-6 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`inline-flex items-center gap-2 rounded-t-lg border border-b-0 px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'import'
                ? 'border-slate-200 bg-white text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Upload Excel Rombel</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`inline-flex items-center gap-2 rounded-t-lg border border-b-0 px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'export'
                ? 'border-slate-200 bg-white text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ekspor & Template ({rombels.length} Rombel)</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'import' ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => void handleFileChange(e)}
                  className="hidden"
                />
                <Upload className="mx-auto h-8 w-8 text-blue-700" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  Pilih File Rombongan Belajar Dapodik (.xlsx / .xls / .csv)
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Otomatis memetakan Wali Kelas dengan Database PTK SMAN 9 Surabaya.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    disabled={parsing}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{parsing ? 'Membaca File...' : 'Pilih File Rombel'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportRombelWorkbook(rombels, true)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Unduh Template</span>
                  </button>
                </div>
                {fileName && (
                  <p className="mt-3 font-mono text-xs text-slate-600">File terpilih: {fileName}</p>
                )}
              </div>

              {errorMsg && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                  {errorMsg}
                </div>
              )}

              {parsedResult && summary && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      <span>
                        Terdeteksi {summary.totalRombel} rombel · Total {summary.totalSiswa} siswa
                      </span>
                    </div>
                    <select
                      value={mergeMode}
                      onChange={(e) => setMergeMode(e.target.value as ImportMergeMode)}
                      aria-label="Mode impor rombel"
                      className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                    >
                      <option value="upsert">Perbarui Rombel Sama & Tambah Baru</option>
                      <option value="replace">Ganti Seluruh Daftar Rombel</option>
                      <option value="append">Tambahkan Sebagai Baris Baru</option>
                    </select>
                  </div>

                  <div className="max-h-60 overflow-auto rounded-lg border border-slate-300">
                    <table className="w-full border-collapse text-left text-xs uppercase">
                      <thead className="sticky top-0 bg-slate-100 text-slate-700">
                        <tr>
                          <th className="border-b border-r border-slate-300 px-2.5 py-2">Rombel</th>
                          <th className="border-b border-r border-slate-300 px-2.5 py-2">Tingkat</th>
                          <th className="border-b border-r border-slate-300 px-2.5 py-2">L / P / Total</th>
                          <th className="border-b border-r border-slate-300 px-2.5 py-2">Wali Kelas</th>
                          <th className="border-b border-slate-300 px-2.5 py-2">Ruangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono text-[11px] tabular-nums">
                        {parsedResult.rombels.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="border-r border-slate-200 px-2.5 py-1.5 font-sans font-semibold text-slate-900">
                              {r.namaRombel}
                            </td>
                            <td className="border-r border-slate-200 px-2.5 py-1.5">{r.tingkatKelas}</td>
                            <td className="border-r border-slate-200 px-2.5 py-1.5">
                              {r.jumlahL} / {r.jumlahP} / {r.jumlahTotal}
                            </td>
                            <td className="border-r border-slate-200 px-2.5 py-1.5 font-sans text-slate-800">
                              {r.waliKelasNama}
                            </td>
                            <td className="px-2.5 py-1.5 font-sans">{r.ruangan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 p-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Ekspor Excel (.xlsx)</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Mengunduh daftar {rombels.length} rombel lengkap dengan sub-kolom L/P/Total dan Wali Kelas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => exportRombelWorkbook(rombels, false)}
                  className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Unduh Excel Rombel (.xlsx)</span>
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-200 p-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Ekspor CSV (.csv)</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Format CSV UTF-8 BOM untuk arsip administrasi maupun olah spreadsheet.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Unduh CSV Rombel (.csv)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-100"
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
                  const res = await onConfirmImport(parsedResult.rombels, mergeMode);
                  if (res !== false) {
                    setParsedResult(null);
                    setFileName('');
                    onClose();
                  } else {
                    setErrorMsg('Gagal menyimpan ke repositori Rombel. Silakan coba lagi.');
                  }
                } finally {
                  setSavingImport(false);
                }
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 disabled:bg-blue-400"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {savingImport
                  ? 'Menyimpan ke Repositori...'
                  : `Simpan ${parsedResult.rombels.length} Rombel`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
