import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Pencil,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { SCHOOL_INFO, TU_SERVICE_CATALOG } from '../config/schoolConfig';
import {
  ApplicantRole,
  RequestParticipant,
  RequestStatus,
  ServiceCategoryId,
  ServiceRequest,
  UserMode,
} from '../types/tu';
import { formatTanggalIndonesia, generateOfficialLetterNumber } from '../utils/formatters';
import { StatusIndicator } from './StatusIndicator';

export interface EditRequestPayload {
  serviceId: ServiceCategoryId;
  serviceTitle: string;
  applicantName: string;
  applicantRole: ApplicantRole;
  identityNumber: string;
  classOrCohort: string;
  phone: string;
  purpose: string;
  notes: string;
  participants: RequestParticipant[];
}

interface RequestDetailDrawerProps {
  request: ServiceRequest | null;
  userMode: UserMode;
  totalLettersCount: number;
  initialEditMode?: boolean;
  onClose: () => void;
  onUpdateStatus: (
    requestId: string,
    newStatus: RequestStatus,
    letterNumber: string,
    staffNote: string,
    addToAgenda: boolean
  ) => void;
  onEditRequest: (requestId: string, payload: EditRequestPayload) => Promise<boolean>;
  onDeleteRequest: (requestId: string) => Promise<boolean>;
  onOpenPrintForRequest: (request: ServiceRequest, docType: 'surat' | 'tanda-terima') => void;
}

const ALL_STATUSES: RequestStatus[] = [
  'Diajukan',
  'Verifikasi Berkas',
  'Proses Pengetikan',
  'Menunggu TTD Kepala Sekolah',
  'Siap Diambil',
  'Selesai',
  'Perlu Perbaikan',
];

const ROLES: ApplicantRole[] = ['Siswa', 'Alumni', 'Guru / Tendik', 'Orang Tua / Wali'];

function newParticipantId(): string {
  return `ps-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function RequestDetailDrawer({
  request,
  userMode,
  totalLettersCount,
  initialEditMode = false,
  onClose,
  onUpdateStatus,
  onEditRequest,
  onDeleteRequest,
  onOpenPrintForRequest,
}: RequestDetailDrawerProps) {
  const [nextStatus, setNextStatus] = useState<RequestStatus>('Verifikasi Berkas');
  const [letterNumber, setLetterNumber] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [addToAgenda, setAddToAgenda] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editError, setEditError] = useState('');

  // State form edit ajuan
  const [editServiceId, setEditServiceId] = useState<ServiceCategoryId>('surat-aktif');
  const [editApplicantRole, setEditApplicantRole] = useState<ApplicantRole>('Siswa');
  const [editApplicantName, setEditApplicantName] = useState('');
  const [editIdentityNumber, setEditIdentityNumber] = useState('');
  const [editClassOrCohort, setEditClassOrCohort] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editParticipants, setEditParticipants] = useState<RequestParticipant[]>([]);

  useEffect(() => {
    if (request) {
      setNextStatus(request.status);
      setLetterNumber(request.letterNumber ?? '');
      setStaffNote('');
      setAddToAgenda(false);

      setEditServiceId(request.serviceId);
      setEditApplicantRole(request.applicantRole);
      setEditApplicantName(request.applicantName);
      setEditIdentityNumber(request.identityNumber);
      setEditClassOrCohort(request.classOrCohort);
      setEditPhone(request.phone || '');
      setEditPurpose(request.purpose);
      setEditNotes(request.notes || '');
      setEditParticipants(
        Array.isArray(request.participants)
          ? request.participants.map((p) => ({ ...p }))
          : []
      );
      setEditError('');
      setConfirmDeleteOpen(false);
      setIsEditing(userMode === 'petugas' && initialEditMode);
    }
  }, [request, initialEditMode, userMode]);

  if (!request) return null;

  const groupParticipants =
    Array.isArray(request.participants) && request.participants.length > 1
      ? request.participants
      : null;

  const handleStaffUpdate = (e: FormEvent) => {
    e.preventDefault();
    onUpdateStatus(request.id, nextStatus, letterNumber.trim(), staffNote.trim(), addToAgenda);
    setStaffNote('');
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSavingEdit) return;

    const cleanedParticipants = editParticipants
      .map((p) => ({
        id: p.id || newParticipantId(),
        nama: p.nama.trim(),
        identityNumber: p.identityNumber.trim() || '-',
        classOrCohort: p.classOrCohort.trim() || '-',
        roleLabel: p.roleLabel?.trim() || 'Peserta',
      }))
      .filter((p) => p.nama.length > 0);

    const effectiveName = editApplicantName.trim() || cleanedParticipants[0]?.nama || '';
    const effectiveIdentity =
      editIdentityNumber.trim() || cleanedParticipants[0]?.identityNumber || '';
    const effectiveClass =
      editClassOrCohort.trim() || cleanedParticipants[0]?.classOrCohort || '-';

    if (!effectiveName || !effectiveIdentity || !editPurpose.trim()) {
      setEditError('Nama Pemohon, NIS/NISN/NIP, dan Keperluan Surat wajib diisi.');
      return;
    }

    const serviceObj =
      TU_SERVICE_CATALOG.find((s) => s.id === editServiceId) ?? TU_SERVICE_CATALOG[0];

    setEditError('');
    setIsSavingEdit(true);
    try {
      const ok = await onEditRequest(request.id, {
        serviceId: serviceObj.id,
        serviceTitle: serviceObj.title,
        applicantName: effectiveName,
        applicantRole: editApplicantRole,
        identityNumber: effectiveIdentity,
        classOrCohort: effectiveClass,
        phone: editPhone.trim(),
        purpose: editPurpose.trim(),
        notes: editNotes.trim(),
        participants: cleanedParticipants.length > 1 ? cleanedParticipants : [],
      });
      if (ok) {
        setIsEditing(false);
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const ok = await onDeleteRequest(request.id);
      if (ok) {
        setConfirmDeleteOpen(false);
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const updateEditParticipant = (
    id: string,
    field: keyof Omit<RequestParticipant, 'id'>,
    value: string
  ) => {
    setEditParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const moveEditParticipant = (idx: number, delta: -1 | 1) => {
    setEditParticipants((prev) => {
      const target = idx + delta;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-950/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detail permohonan ${request.id}`}
        className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
      >
        {/* Header Drawer */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-blue-700">{request.id}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Masuk {formatTanggalIndonesia(request.createdAt)}</span>
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">
              {request.serviceTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup detail permohonan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Drawer */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Bar Aksi Edit & Hapus Ajuan untuk Petugas TU */}
          {userMode === 'petugas' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-xs font-medium text-slate-600">
                  Pengelolaan Ajuan Surat (Petugas TU)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing((v) => !v);
                      setConfirmDeleteOpen(false);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      isEditing
                        ? 'border-blue-700 bg-blue-700 text-white'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isEditing ? 'Tutup Form Edit' : 'Edit Ajuan Surat'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Hapus Ajuan</span>
                  </button>
                </div>
              </div>

              {confirmDeleteOpen && (
                <div
                  role="alert"
                  className="flex flex-col justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-4 sm:flex-row sm:items-center"
                >
                  <div className="text-xs text-red-900">
                    <p className="font-semibold">
                      Hapus permanen ajuan surat {request.id} ({request.applicantName})?
                    </p>
                    <p className="mt-0.5 text-red-700">
                      Data ajuan dan riwayat status pada tiket ini akan dihapus dari sistem TU.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(false)}
                      disabled={isDeleting}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConfirmDelete()}
                      disabled={isDeleting}
                      className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:bg-red-400"
                    >
                      {isDeleting ? 'Menghapus...' : 'Ya, Hapus Ajuan'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Edit Ajuan Surat */}
          {userMode === 'petugas' && isEditing ? (
            <form
              onSubmit={handleSaveEdit}
              className="space-y-4 rounded-xl border border-blue-300 bg-blue-50/40 p-4"
            >
              <div className="flex items-center justify-between border-b border-blue-200 pb-2.5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Edit Data Ajuan Surat ({request.id})
                </h3>
              </div>

              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="edit-service" className="block text-xs font-medium text-slate-700">
                    Jenis Layanan
                  </label>
                  <select
                    id="edit-service"
                    value={editServiceId}
                    onChange={(e) => setEditServiceId(e.target.value as ServiceCategoryId)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                  >
                    {TU_SERVICE_CATALOG.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} — {item.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-role" className="block text-xs font-medium text-slate-700">
                    Status Pemohon
                  </label>
                  <select
                    id="edit-role"
                    value={editApplicantRole}
                    onChange={(e) => setEditApplicantRole(e.target.value as ApplicantRole)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-name" className="block text-xs font-medium text-slate-700">
                    Nama Pemohon Utama
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    required
                    value={editApplicantName}
                    onChange={(e) => setEditApplicantName(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="edit-identity" className="block text-xs font-medium text-slate-700">
                    NISN / NIS / NIP
                  </label>
                  <input
                    id="edit-identity"
                    type="text"
                    required
                    value={editIdentityNumber}
                    onChange={(e) => setEditIdentityNumber(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="edit-class" className="block text-xs font-medium text-slate-700">
                    Kelas / Rombel / Jabatan
                  </label>
                  <input
                    id="edit-class"
                    type="text"
                    value={editClassOrCohort}
                    onChange={(e) => setEditClassOrCohort(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="edit-phone" className="block text-xs font-medium text-slate-700">
                    Nomor WhatsApp
                  </label>
                  <input
                    id="edit-phone"
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="edit-purpose" className="block text-xs font-medium text-slate-700">
                    Keperluan Surat / Kegiatan
                  </label>
                  <input
                    id="edit-purpose"
                    type="text"
                    required
                    value={editPurpose}
                    onChange={(e) => setEditPurpose(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="edit-notes" className="block text-xs font-medium text-slate-700">
                    Catatan Pemohon
                  </label>
                  <textarea
                    id="edit-notes"
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Editor Tabel Peserta Berkelompok */}
              <div className="space-y-2 border-t border-blue-200 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Tabel Peserta Berkelompok ({editParticipants.length} Orang)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditParticipants((prev) => {
                        const base =
                          prev.length === 0 && editApplicantName.trim()
                            ? [
                                {
                                  id: newParticipantId(),
                                  nama: editApplicantName.trim(),
                                  identityNumber: editIdentityNumber.trim() || '-',
                                  classOrCohort: editClassOrCohort.trim() || '-',
                                  roleLabel: 'Ketua Tim',
                                },
                              ]
                            : prev;
                        return [
                          ...base,
                          {
                            id: newParticipantId(),
                            nama: '',
                            identityNumber: '',
                            classOrCohort: '',
                            roleLabel: 'Peserta',
                          },
                        ];
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    <span>Tambah Peserta</span>
                  </button>
                </div>

                {editParticipants.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
                    <table className="w-full min-w-[560px] border-collapse text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100 font-semibold text-slate-800">
                          <th className="w-8 px-2 py-1.5 text-center">No</th>
                          <th className="px-2 py-1.5">Nama</th>
                          <th className="w-28 px-2 py-1.5">NISN / NIP</th>
                          <th className="w-24 px-2 py-1.5">Kelas / Jabatan</th>
                          <th className="w-24 px-2 py-1.5">Peran</th>
                          <th className="w-20 px-2 py-1.5 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {editParticipants.map((p, idx) => (
                          <tr key={p.id}>
                            <td className="px-2 py-1 text-center font-mono text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="px-1 py-1">
                              <input
                                type="text"
                                value={p.nama}
                                onChange={(e) =>
                                  updateEditParticipant(p.id, 'nama', e.target.value)
                                }
                                className="h-7 w-full rounded border border-slate-200 px-1.5 text-[11px]"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                type="text"
                                value={p.identityNumber}
                                onChange={(e) =>
                                  updateEditParticipant(p.id, 'identityNumber', e.target.value)
                                }
                                className="h-7 w-full rounded border border-slate-200 px-1.5 font-mono text-[11px]"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                type="text"
                                value={p.classOrCohort}
                                onChange={(e) =>
                                  updateEditParticipant(p.id, 'classOrCohort', e.target.value)
                                }
                                className="h-7 w-full rounded border border-slate-200 px-1.5 text-[11px]"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                type="text"
                                value={p.roleLabel || ''}
                                onChange={(e) =>
                                  updateEditParticipant(p.id, 'roleLabel', e.target.value)
                                }
                                className="h-7 w-full rounded border border-slate-200 px-1.5 text-[11px]"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => moveEditParticipant(idx, -1)}
                                  disabled={idx === 0}
                                  className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                >
                                  <ArrowUp className="h-3 w-3" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveEditParticipant(idx, 1)}
                                  disabled={idx === editParticipants.length - 1}
                                  className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                >
                                  <ArrowDown className="h-3 w-3" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditParticipants((prev) =>
                                      prev.filter((item) => item.id !== p.id)
                                    )
                                  }
                                  className="rounded p-1 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:bg-blue-400"
                >
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isSavingEdit ? 'Menyimpan...' : 'Simpan Edit Ajuan'}</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Status Saat Ini & Catatan Revisi */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">Status Terkini</span>
                  <StatusIndicator status={request.status} />
                </div>
                {request.letterNumber && (
                  <div className="mt-2.5 flex items-center justify-between gap-4 border-t border-slate-200 pt-2.5 text-xs">
                    <span className="text-slate-500">Nomor Surat Resmi</span>
                    <span className="font-mono font-semibold text-slate-900">{request.letterNumber}</span>
                  </div>
                )}
                {request.status === 'Perlu Perbaikan' && request.revisionNote && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800">
                    <strong className="block font-semibold">Catatan Revisi Petugas:</strong>
                    {request.revisionNote}
                  </div>
                )}
              </div>

              {/* Data Pemohon */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Informasi Pemohon
                </h3>
                <dl className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-2.5 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Nama Lengkap</dt>
                    <dd className="font-medium text-slate-900">{request.applicantName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Peran & Kelas/Unit</dt>
                    <dd className="text-slate-800">
                      {request.applicantRole} · {request.classOrCohort}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">NISN / NIS / NIP</dt>
                    <dd className="font-mono text-slate-900 tabular-nums">{request.identityNumber}</dd>
                  </div>
                  {request.phone && (
                    <div>
                      <dt className="text-xs text-slate-500">WhatsApp</dt>
                      <dd className="font-mono text-slate-900 tabular-nums">{request.phone}</dd>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Keperluan Surat</dt>
                    <dd className="mt-0.5 text-slate-900">{request.purpose}</dd>
                  </div>
                  {request.notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-slate-500">Catatan Pemohon</dt>
                      <dd className="mt-0.5 text-slate-700">{request.notes}</dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Tabel Daftar Peserta Berkelompok */}
              {groupParticipants && (
                <section>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Users className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                      <span>Daftar Peserta Berkelompok ({groupParticipants.length} Orang)</span>
                    </h3>
                  </div>
                  <div className="mt-2.5 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[460px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100 font-semibold text-slate-700">
                          <th className="w-10 border-r border-slate-200 px-2.5 py-2 text-center">No</th>
                          <th className="border-r border-slate-200 px-2.5 py-2">Nama Lengkap</th>
                          <th className="border-r border-slate-200 px-2.5 py-2">NISN / NIP</th>
                          <th className="border-r border-slate-200 px-2.5 py-2">Kelas / Jabatan</th>
                          <th className="px-2.5 py-2">Peran</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {groupParticipants.map((p, idx) => (
                          <tr key={p.id}>
                            <td className="border-r border-slate-200 px-2.5 py-2 text-center font-mono tabular-nums text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="border-r border-slate-200 px-2.5 py-2 font-medium text-slate-900">
                              {p.nama}
                            </td>
                            <td className="border-r border-slate-200 px-2.5 py-2 font-mono tabular-nums text-slate-700">
                              {p.identityNumber}
                            </td>
                            <td className="border-r border-slate-200 px-2.5 py-2 text-slate-700">
                              {p.classOrCohort}
                            </td>
                            <td className="px-2.5 py-2 text-slate-600">{p.roleLabel || 'Peserta'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}

          {/* Berkas Checklist */}
          {userMode === 'petugas' && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Kelengkapan Berkas Dikonfirmasi
              </h3>
              {request.submittedRequirements.length > 0 ? (
                <ul className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-3">
                  {request.submittedRequirements.map((req) => (
                    <li key={req} className="flex items-start gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  Belum ada berkas yang ditandai siap oleh pemohon.
                </p>
              )}
            </section>
          )}

          {/* Riwayat Proses */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Riwayat Proses Pelayanan
            </h3>
            <ol className="mt-3 space-y-4 border-t border-slate-100 pt-3">
              {[...request.timeline].reverse().map((event) => (
                <li key={event.id} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">{event.status}</span>
                      <span className="font-mono text-xs tabular-nums text-slate-400">
                        {formatTanggalIndonesia(event.timestamp, true)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{event.note}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Oleh: {event.actor}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Panel Petugas TU */}
          {userMode === 'petugas' && (
            <form
              onSubmit={handleStaffUpdate}
              className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Tindak Lanjut Petugas TU ({SCHOOL_INFO.staffName})
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="staff-status" className="block text-xs font-medium text-slate-700">
                    Ubah Status Layanan
                  </label>
                  <select
                    id="staff-status"
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as RequestStatus)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {ALL_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="staff-letter-no" className="block text-xs font-medium text-slate-700">
                    Nomor Surat Keluar
                  </label>
                  <div className="mt-1 flex gap-1.5">
                    <input
                      id="staff-letter-no"
                      type="text"
                      value={letterNumber}
                      onChange={(e) => setLetterNumber(e.target.value)}
                      placeholder="421.3/..."
                      className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setLetterNumber(generateOfficialLetterNumber(totalLettersCount))}
                      title="Buat nomor surat otomatis"
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      <span>Isi</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="staff-note" className="block text-xs font-medium text-slate-700">
                  Catatan Proses / Keterangan Revisi
                </label>
                <textarea
                  id="staff-note"
                  rows={2}
                  value={staffNote}
                  onChange={(e) => setStaffNote(e.target.value)}
                  placeholder="Contoh: Berkas lengkap, surat sudah ditandatangani Kepala Sekolah dan siap diambil di Loket 1."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={addToAgenda}
                  onChange={(e) => setAddToAgenda(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700"
                />
                <span>Catat otomatis ke Buku Agenda Surat Keluar TU</span>
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                <Save className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Simpan Perubahan Status</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            onClick={() => onOpenPrintForRequest(request, 'tanda-terima')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Cetak Tanda Terima</span>
          </button>

          {userMode === 'petugas' && (
            <button
              type="button"
              onClick={() => onOpenPrintForRequest(request, 'surat')}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Pratinjau Draf Surat Resmi</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
