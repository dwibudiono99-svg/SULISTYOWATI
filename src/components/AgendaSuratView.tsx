import { Plus, Printer, Search, Sparkles, Trash2, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { AgendaEntry, AgendaType, LetterClassification, UserMode } from '../types/tu';
import { findDuplicateAgenda } from '../utils/deduplicationUtils';
import { formatTanggalIndonesia } from '../utils/formatters';

interface AgendaSuratViewProps {
  entries: AgendaEntry[];
  userMode: UserMode;
  onAddEntry: (entry: AgendaEntry) => void;
  onDeleteEntry: (id: string) => void;
  onOpenReportPrint?: () => void;
  onOpenDeduplicate?: () => void;
}

export function AgendaSuratView({
  entries,
  userMode,
  onAddEntry,
  onDeleteEntry,
  onOpenReportPrint,
  onOpenDeduplicate,
}: AgendaSuratViewProps) {
  const [typeFilter, setTypeFilter] = useState<'ALL' | AgendaType>('ALL');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const [type, setType] = useState<AgendaType>('Surat Masuk');
  const [letterNumber, setLetterNumber] = useState('');
  const [letterDate, setLetterDate] = useState('2026-11-25');
  const [counterparty, setCounterparty] = useState('');
  const [subject, setSubject] = useState('');
  const [classification, setClassification] = useState<LetterClassification>('Biasa');
  const [disposition, setDisposition] = useState('');

  const duplicateGroupsCount = useMemo(
    () => findDuplicateAgenda(entries, 'all').length,
    [entries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...entries]
      .filter((item) => {
        if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
        if (!q) return true;
        return (
          item.agendaNumber.toLowerCase().includes(q) ||
          item.letterNumber.toLowerCase().includes(q) ||
          item.counterparty.toLowerCase().includes(q) ||
          item.subject.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.recordedDate.localeCompare(a.recordedDate));
  }, [entries, typeFilter, query]);

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!letterNumber.trim() || !counterparty.trim() || !subject.trim()) return;

    const prefix = type === 'Surat Masuk' ? 'SM' : 'SK';
    const seq = entries.filter((item) => item.type === type).length + (type === 'Surat Masuk' ? 387 : 221);
    const today = new Date().toISOString().slice(0, 10);

    const newEntry: AgendaEntry = {
      id: `ag-${Date.now()}`,
      type,
      agendaNumber: `${prefix}/2026/${String(seq).padStart(4, '0')}`,
      letterNumber: letterNumber.trim(),
      letterDate,
      recordedDate: today,
      counterparty: counterparty.trim(),
      subject: subject.trim(),
      classification,
      disposition: disposition.trim() || 'Diarsipkan oleh Staf Tata Usaha.',
    };

    onAddEntry(newEntry);
    setLetterNumber('');
    setCounterparty('');
    setSubject('');
    setDisposition('');
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['ALL', 'Surat Masuk', 'Surat Keluar'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTypeFilter(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  typeFilter === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'ALL' ? 'Semua Agenda' : tab}
              </button>
            ))}
          </div>

          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nomor agenda, nomor surat, instansi, atau perihal..."
              aria-label="Cari buku agenda surat"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {userMode === 'petugas' && onOpenDeduplicate && (
            <button
              type="button"
              onClick={onOpenDeduplicate}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap shrink-0 ${
                duplicateGroupsCount > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
              <span>
                Hapus Duplikat{duplicateGroupsCount > 0 ? ` (${duplicateGroupsCount})` : ''}
              </span>
            </button>
          )}
          {onOpenReportPrint && (
            <button
              type="button"
              onClick={onOpenReportPrint}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Cetak Laporan</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Catat Agenda Surat</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="px-4 py-3">No. Agenda</th>
              <th className="px-4 py-3">Jenis & Sifat</th>
              <th className="px-4 py-3">Nomor & Tgl Surat</th>
              <th className="px-4 py-3">Asal / Tujuan Instansi</th>
              <th className="px-4 py-3">Perihal & Disposisi</th>
              {userMode === 'petugas' && <th className="px-4 py-3 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                  {entry.agendaNumber}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-xs font-semibold text-slate-800">{entry.type}</div>
                  <div
                    className={`mt-0.5 text-xs ${
                      entry.classification === 'Segera'
                        ? 'font-medium text-red-700'
                        : entry.classification === 'Penting'
                          ? 'font-medium text-amber-700'
                          : 'text-slate-500'
                    }`}
                  >
                    Sifat: {entry.classification}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-mono text-xs text-slate-900">{entry.letterNumber}</div>
                  <div className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                    {formatTanggalIndonesia(entry.letterDate)}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-slate-800 max-w-[200px]">
                  {entry.counterparty}
                </td>
                <td className="px-4 py-3 max-w-[280px]">
                  <div className="text-xs font-medium text-slate-900">{entry.subject}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Disposisi: {entry.disposition}
                  </div>
                </td>
                {userMode === 'petugas' && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Hapus agenda ${entry.agendaNumber}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setModalOpen(false)}
            aria-hidden="true"
          />
          <form
            onSubmit={handleCreate}
            role="dialog"
            aria-modal="true"
            aria-label="Catat agenda surat baru"
            className="relative z-10 w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                Catat Buku Agenda Surat TU
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ag-type" className="block text-xs font-medium text-slate-700">
                  Jenis Surat
                </label>
                <select
                  id="ag-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as AgendaType)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm"
                >
                  <option value="Surat Masuk">Surat Masuk</option>
                  <option value="Surat Keluar">Surat Keluar</option>
                </select>
              </div>
              <div>
                <label htmlFor="ag-class" className="block text-xs font-medium text-slate-700">
                  Sifat Surat
                </label>
                <select
                  id="ag-class"
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as LetterClassification)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm"
                >
                  <option value="Biasa">Biasa</option>
                  <option value="Penting">Penting</option>
                  <option value="Segera">Segera</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ag-no" className="block text-xs font-medium text-slate-700">
                  Nomor Surat
                </label>
                <input
                  id="ag-no"
                  type="text"
                  required
                  value={letterNumber}
                  onChange={(e) => setLetterNumber(e.target.value)}
                  placeholder="421.3/125/101.6.1.9/2026"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs"
                />
              </div>
              <div>
                <label htmlFor="ag-date" className="block text-xs font-medium text-slate-700">
                  Tanggal Surat
                </label>
                <input
                  id="ag-date"
                  type="date"
                  required
                  value={letterDate}
                  onChange={(e) => setLetterDate(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label htmlFor="ag-counterparty" className="block text-xs font-medium text-slate-700">
                {type === 'Surat Masuk' ? 'Asal Instansi / Pengirim' : 'Tujuan Instansi / Penerima'}
              </label>
              <input
                id="ag-counterparty"
                type="text"
                required
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Contoh: Dinas Pendidikan Provinsi Jawa Timur"
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="ag-subject" className="block text-xs font-medium text-slate-700">
                Perihal Surat
              </label>
              <input
                id="ag-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ringkasan isi atau perihal surat"
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="ag-disposition" className="block text-xs font-medium text-slate-700">
                Disposisi / Catatan Arsip
              </label>
              <textarea
                id="ag-disposition"
                rows={2}
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
                placeholder="Contoh: Diteruskan ke Waka Kesiswaan atau diarsipkan di ordner 2026."
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Simpan ke Buku Agenda
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
