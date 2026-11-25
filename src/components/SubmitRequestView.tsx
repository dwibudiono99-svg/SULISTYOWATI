import { CheckSquare, ClipboardList, Database, Send, Square } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { SCHOOL_INFO, TU_SERVICE_CATALOG } from '../data/tuCatalog';
import { ApplicantRole, DapodikStudent, ServiceCategoryId, ServiceRequest, UserMode } from '../types/tu';
import { generateTicketCode } from '../utils/formatters';

interface SubmitRequestViewProps {
  initialServiceId: ServiceCategoryId;
  existingCount: number;
  userMode: UserMode;
  students: DapodikStudent[];
  prefillStudent?: DapodikStudent | null;
  onSubmitNewRequest: (request: ServiceRequest) => void;
}

const ROLES: ApplicantRole[] = ['Siswa', 'Alumni', 'Guru / Tendik', 'Orang Tua / Wali'];

export function SubmitRequestView({
  initialServiceId,
  existingCount,
  userMode,
  students,
  prefillStudent,
  onSubmitNewRequest,
}: SubmitRequestViewProps) {
  const [serviceId, setServiceId] = useState<ServiceCategoryId>(initialServiceId);
  const [applicantRole, setApplicantRole] = useState<ApplicantRole>('Siswa');
  const [applicantName, setApplicantName] = useState('');
  const [identityNumber, setIdentityNumber] = useState('');
  const [classOrCohort, setClassOrCohort] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [checkedReqs, setCheckedReqs] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [selectedDapodikId, setSelectedDapodikId] = useState('');

  useEffect(() => {
    setServiceId(initialServiceId);
  }, [initialServiceId]);

  const applyDapodikStudent = (student: DapodikStudent) => {
    setSelectedDapodikId(student.id);
    setApplicantRole(student.statusSiswa === 'Lulus' ? 'Alumni' : 'Siswa');
    setApplicantName(student.nama);
    setIdentityNumber(student.nisn || student.nipd);
    setClassOrCohort(student.rombelSaatIni);
    setPhone(student.hp);
  };

  useEffect(() => {
    if (prefillStudent) {
      applyDapodikStudent(prefillStudent);
    }
  }, [prefillStudent]);

  const selectedService =
    TU_SERVICE_CATALOG.find((s) => s.id === serviceId) ?? TU_SERVICE_CATALOG[0];

  useEffect(() => {
    setCheckedReqs([]);
  }, [serviceId]);

  const toggleRequirement = (req: string) => {
    setCheckedReqs((prev) =>
      prev.includes(req) ? prev.filter((item) => item !== req) : [...prev, req]
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !identityNumber.trim() || !phone.trim() || !purpose.trim()) {
      setFormError(
        'Mohon lengkapi Nama Lengkap, NIS/NISN/NIP, Nomor WhatsApp, dan Keperluan Permohonan.'
      );
      return;
    }

    const now = new Date();
    const readyDate = new Date(now.getTime() + selectedService.slaDays * 24 * 60 * 60 * 1000);
    const ticketId = generateTicketCode(existingCount);

    const newRequest: ServiceRequest = {
      id: ticketId,
      serviceId: selectedService.id,
      serviceTitle: selectedService.title,
      applicantName: applicantName.trim(),
      applicantRole,
      identityNumber: identityNumber.trim(),
      classOrCohort: classOrCohort.trim() || '-',
      phone: phone.trim(),
      purpose: purpose.trim(),
      notes: notes.trim(),
      submittedRequirements: checkedReqs,
      status: 'Diajukan',
      assignedStaff: SCHOOL_INFO.staffName,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      estimatedReadyAt: readyDate.toISOString(),
      timeline: [
        {
          id: `tl-${Date.now()}`,
          timestamp: now.toISOString(),
          status: 'Diajukan',
          actor: applicantName.trim(),
          note: `Permohonan ${selectedService.title} diajukan secara daring melalui SIP TU SMAN 9 Surabaya.`,
        },
      ],
    };

    setFormError('');
    setApplicantName('');
    setIdentityNumber('');
    setClassOrCohort('');
    setPhone('');
    setPurpose('');
    setNotes('');
    setCheckedReqs([]);
    setSelectedDapodikId('');

    onSubmitNewRequest(newRequest);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8"
      >
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Formulir Permohonan Pelayanan Tata Usaha
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Isi data pemohon secara akurat sesuai dokumen kependudukan atau Dapodik SMAN 9 Surabaya.
          </p>
        </div>

        {/* Ambil Cepat dari Database Dapodik (Hanya Mode Petugas TU terautentikasi) */}
        {userMode === 'petugas' && students.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Database className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
              <span>Isi Otomatis dari Database Siswa Dapodik (Mode Petugas TU)</span>
            </div>
            <select
              value={selectedDapodikId}
              onChange={(e) => {
                const found = students.find((s) => s.id === e.target.value);
                if (found) applyDapodikStudent(found);
                else setSelectedDapodikId('');
              }}
              aria-label="Pilih siswa dari database Dapodik"
              className="mt-2 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
            >
              <option value="">-- Pilih siswa/alumni dari Database Dapodik --</option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.nama} · NISN {st.nisn} ({st.rombelSaatIni})
                </option>
              ))}
            </select>
          </div>
        )}

        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {formError}
          </div>
        )}

        {/* Pilihan Jenis Layanan */}
        <div>
          <label htmlFor="service-select" className="block text-sm font-medium text-slate-800">
            Jenis Layanan Administrasi
          </label>
          <select
            id="service-select"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value as ServiceCategoryId)}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            {TU_SERVICE_CATALOG.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.title} (Estimasi {item.slaDays} hari kerja)
              </option>
            ))}
          </select>
        </div>

        {/* Status Pemohon */}
        <div>
          <span className="block text-sm font-medium text-slate-800">Status Pemohon</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setApplicantRole(role)}
                className={`h-10 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  applicantRole === role
                    ? 'border-blue-700 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Data Identitas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="applicant-name" className="block text-sm font-medium text-slate-800">
              Nama Lengkap Pemohon / Siswa
            </label>
            <input
              id="applicant-name"
              type="text"
              required
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              placeholder="Sesuai Ijazah / Akta Kelahiran"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="identity-number" className="block text-sm font-medium text-slate-800">
              {applicantRole === 'Guru / Tendik' ? 'NIP / NUPTK' : 'NISN / NIS'}
            </label>
            <input
              id="identity-number"
              type="text"
              required
              value={identityNumber}
              onChange={(e) => setIdentityNumber(e.target.value)}
              placeholder={applicantRole === 'Guru / Tendik' ? 'Contoh: 197804122005012014' : 'Contoh: 0094821735'}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="class-cohort" className="block text-sm font-medium text-slate-800">
              {applicantRole === 'Alumni'
                ? 'Tahun Lulus / Angkatan'
                : applicantRole === 'Guru / Tendik'
                  ? 'Mata Pelajaran / Unit Tugas'
                  : 'Kelas Saat Ini'}
            </label>
            <input
              id="class-cohort"
              type="text"
              value={classOrCohort}
              onChange={(e) => setClassOrCohort(e.target.value)}
              placeholder={
                applicantRole === 'Alumni'
                  ? 'Contoh: Alumni 2024'
                  : applicantRole === 'Guru / Tendik'
                    ? 'Contoh: Guru Matematika'
                    : 'Contoh: XI-F3'
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="phone-number" className="block text-sm font-medium text-slate-800">
              Nomor WhatsApp Aktif
            </label>
            <input
              id="phone-number"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 0812-3456-7890"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Keperluan */}
        <div>
          <label htmlFor="purpose-input" className="block text-sm font-medium text-slate-800">
            Keperluan & Tujuan Instansi Surat
          </label>
          <input
            id="purpose-input"
            type="text"
            required
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Tuliskan tujuan penggunaan surat atau dokumen secara jelas"
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">Contoh cepat:</span>
            {selectedService.samplePurposes.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setPurpose(sample)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {/* Checklist Berkas Persyaratan */}
        <div>
          <span className="block text-sm font-medium text-slate-800">
            Konfirmasi Kesiapan Berkas Persyaratan
          </span>
          <p className="mt-0.5 text-xs text-slate-500">
            Centang berkas yang sudah Anda siapkan untuk verifikasi di Loket Tata Usaha.
          </p>
          <div className="mt-2.5 space-y-2">
            {selectedService.requirements.map((req) => {
              const checked = checkedReqs.includes(req);
              return (
                <button
                  key={req}
                  type="button"
                  onClick={() => toggleRequirement(req)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors ${
                    checked
                      ? 'border-blue-200 bg-blue-50/70 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {checked ? (
                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                  ) : (
                    <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  )}
                  <span>{req}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Catatan Tambahan */}
        <div>
          <label htmlFor="notes-input" className="block text-sm font-medium text-slate-800">
            Catatan Tambahan untuk Petugas TU (Opsional)
          </label>
          <textarea
            id="notes-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Misal: jumlah lembar legalisir, ejaan nama orang tua, atau jadwal pengambilan yang diinginkan."
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
          >
            <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Kirim Permohonan Layanan</span>
          </button>
        </div>
      </form>

      {/* Panel Informasi Layanan */}
      <aside className="space-y-4 lg:col-span-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
            <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Ringkasan Standar Layanan</span>
          </div>

          <h3 className="mt-2 text-base font-semibold text-slate-900">
            {selectedService.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            {selectedService.description}
          </p>

          <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Kode Layanan</dt>
              <dd className="font-mono font-medium text-slate-900">{selectedService.code}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Sasaran Pemohon</dt>
              <dd className="font-medium text-slate-900">{selectedService.targetAudience}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Estimasi Penyelesaian</dt>
              <dd className="font-mono font-semibold tabular-nums text-emerald-700">
                {selectedService.slaDays} Hari Kerja
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Biaya Layanan</dt>
              <dd className="font-medium text-slate-900">Gratis (Rp 0)</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <h4 className="font-semibold text-slate-900">Alur Verifikasi Loket TU</h4>
          <ol className="mt-2.5 list-decimal space-y-2 pl-4 text-xs leading-relaxed">
            <li>Setelah mengirim formulir, Anda memperoleh Kode Tiket untuk memantau progres.</li>
            <li>Petugas Tata Usaha memeriksa kelengkapan data Dapodik/Buku Induk.</li>
            <li>Jika status berubah menjadi <strong className="text-slate-800">Siap Diambil</strong>, bawa berkas fisik pendukung ke Ruang Tata Usaha SMAN 9 Surabaya.</li>
          </ol>
        </div>
      </aside>
    </div>
  );
}
