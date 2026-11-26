import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Database,
  Loader2,
  Search,
  Send,
  ShieldAlert,
  Square,
  User,
  Users,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { SCHOOL_INFO, TU_SERVICE_CATALOG } from '../config/schoolConfig';
import {
  ApplicantRole,
  DapodikGtk,
  DapodikStudent,
  ReportingPortalConfig,
  ServiceCategoryId,
  ServiceRequest,
  UserMode,
} from '../types/tu';
import { generateTicketCode } from '../utils/formatters';
import { formatPtkDisplayName } from '../utils/gtkDapodikValidation';

interface LookupStudentSummary {
  id: string;
  nama: string;
  nipd: string;
  nisn: string;
  jk: string;
  tempatLahir: string;
  tanggalLahir: string;
  rombelSaatIni: string;
  tingkatKelas: string;
  statusSiswa: string;
  hp: string;
}

interface LookupGtkSummary {
  id: string;
  nama: string;
  displayName: string;
  gelarDepan?: string;
  gelarBelakang?: string;
  nip: string;
  nuptk: string;
  jenisPtk: string;
  jabatanPtk?: string;
  tugasTambahan: string;
  statusKepegawaian: string;
  dukcapilStatus: string;
  hp: string;
  fotoDataUrl?: string;
}

interface SubmitRequestViewProps {
  initialServiceId: ServiceCategoryId;
  existingCount: number;
  userMode: UserMode;
  reportingPortal: ReportingPortalConfig;
  students: DapodikStudent[];
  gtkList?: DapodikGtk[];
  prefillStudent?: DapodikStudent | null;
  prefillGtk?: DapodikGtk | null;
  onSubmitNewRequest: (request: ServiceRequest) => Promise<boolean>;
  onNavigateQueue?: () => void;
}

const ROLES: ApplicantRole[] = ['Siswa', 'Alumni', 'Guru / Tendik', 'Orang Tua / Wali'];

function studentToSummary(s: DapodikStudent): LookupStudentSummary {
  return {
    id: s.id,
    nama: s.nama,
    nipd: s.nipd,
    nisn: s.nisn,
    jk: s.jk,
    tempatLahir: s.tempatLahir,
    tanggalLahir: s.tanggalLahir,
    rombelSaatIni: s.rombelSaatIni,
    tingkatKelas: s.tingkatKelas,
    statusSiswa: s.statusSiswa,
    hp: s.hp || s.telepon || '',
  };
}

function gtkToSummary(g: DapodikGtk): LookupGtkSummary {
  return {
    id: g.id,
    nama: g.nama,
    displayName: formatPtkDisplayName(g),
    gelarDepan: g.gelarDepan,
    gelarBelakang: g.gelarBelakang,
    nip: g.nip,
    nuptk: g.nuptk,
    jenisPtk: g.jenisPtk,
    jabatanPtk: g.jabatanPtk,
    tugasTambahan: g.tugasTambahan,
    statusKepegawaian: g.statusKepegawaian,
    dukcapilStatus: g.dukcapilStatus,
    hp: g.hp,
    fotoDataUrl: g.fotoDataUrl,
  };
}

export function SubmitRequestView({
  initialServiceId,
  existingCount,
  userMode,
  reportingPortal,
  students,
  gtkList = [],
  prefillStudent,
  prefillGtk,
  onSubmitNewRequest,
  onNavigateQueue,
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedDapodikId, setSelectedDapodikId] = useState('');
  const [selectedGtkId, setSelectedGtkId] = useState('');

  const [matchedStudent, setMatchedStudent] = useState<LookupStudentSummary | null>(null);
  const [matchedGtk, setMatchedGtk] = useState<LookupGtkSummary | null>(null);
  const [gtkCandidates, setGtkCandidates] = useState<LookupGtkSummary[]>([]);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'searching' | 'found' | 'not-found'>('idle');
  const lastAppliedLookupRef = useRef<string>('');

  useEffect(() => {
    setServiceId(initialServiceId);
  }, [initialServiceId]);

  const applyStudentSummary = useCallback((student: LookupStudentSummary, overwriteIdentity = true) => {
    setSelectedDapodikId(student.id);
    setSelectedGtkId('');
    setMatchedStudent(student);
    setMatchedGtk(null);
    setGtkCandidates([]);
    setLookupStatus('found');
    setApplicantRole(student.statusSiswa === 'Lulus' ? 'Alumni' : 'Siswa');
    setApplicantName(student.nama);
    if (overwriteIdentity) {
      setIdentityNumber(student.nisn || student.nipd);
    }
    setClassOrCohort(student.rombelSaatIni || '-');
    if (student.hp) {
      setPhone((prev) => prev.trim() || student.hp);
    }
  }, []);

  const applyGtkSummary = useCallback((gtk: LookupGtkSummary, overwriteName = true, overwriteId = true) => {
    setSelectedGtkId(gtk.id);
    setSelectedDapodikId('');
    setMatchedGtk(gtk);
    setMatchedStudent(null);
    setGtkCandidates([]);
    setLookupStatus('found');
    setApplicantRole('Guru / Tendik');
    if (overwriteName) {
      setApplicantName(gtk.displayName || gtk.nama);
    }
    if (overwriteId) {
      setIdentityNumber(gtk.nip || gtk.nuptk || '');
    }
    setClassOrCohort(gtk.jabatanPtk || gtk.tugasTambahan || gtk.jenisPtk);
    if (gtk.hp) {
      setPhone((prev) => prev.trim() || gtk.hp);
    }
  }, []);

  useEffect(() => {
    if (prefillStudent) {
      const summary = studentToSummary(prefillStudent);
      lastAppliedLookupRef.current = `student:${summary.id}`;
      applyStudentSummary(summary, true);
    }
  }, [prefillStudent, applyStudentSummary]);

  useEffect(() => {
    if (prefillGtk) {
      const summary = gtkToSummary(prefillGtk);
      lastAppliedLookupRef.current = `gtk:${summary.id}`;
      applyGtkSummary(summary, true, true);
    }
  }, [prefillGtk, applyGtkSummary]);

  const selectedService =
    TU_SERVICE_CATALOG.find((s) => s.id === serviceId) ?? TU_SERVICE_CATALOG[0];

  useEffect(() => {
    setCheckedReqs([]);
  }, [serviceId]);

  const runStudentLookup = useCallback(
    async (queryRaw: string, fromButton = false) => {
      const q = queryRaw.trim();
      const digitsOnly = q.replace(/\D/g, '');
      if (q.length < 4) {
        if (fromButton) {
          setLookupStatus('not-found');
        } else {
          setLookupStatus('idle');
        }
        return;
      }

      if (matchedStudent && (matchedStudent.nisn === q || matchedStudent.nipd === q)) {
        return;
      }

      // Check local students list first (when loaded in Petugas mode)
      if (students.length > 0) {
        const localMatch = students.find((s) => {
          const nisn = String(s.nisn ?? '').trim();
          const nipd = String(s.nipd ?? '').trim();
          if (digitsOnly.length >= 4) {
            if (nisn && nisn.replace(/\D/g, '') === digitsOnly) return true;
            if (nipd && nipd.replace(/\D/g, '') === digitsOnly) return true;
          }
          return (
            (nisn && nisn.toLowerCase() === q.toLowerCase()) ||
            (nipd && nipd.toLowerCase() === q.toLowerCase())
          );
        });
        if (localMatch) {
          const summary = studentToSummary(localMatch);
          lastAppliedLookupRef.current = `student:${summary.id}`;
          applyStudentSummary(summary, false);
          return;
        }
      }

      setLookupStatus('searching');
      try {
        const res = await fetch(`/api/dapodik/lookup-student?q=${encodeURIComponent(q)}`);
        if (!res.ok) {
          setLookupStatus('idle');
          return;
        }
        const data = (await res.json()) as {
          found: boolean;
          student: LookupStudentSummary | null;
        };
        if (data.found && data.student) {
          lastAppliedLookupRef.current = `student:${data.student.id}`;
          applyStudentSummary(data.student, false);
        } else {
          setMatchedStudent(null);
          setSelectedDapodikId('');
          setLookupStatus('not-found');
        }
      } catch {
        setLookupStatus('idle');
      }
    },
    [students, matchedStudent, applyStudentSummary]
  );

  const runGtkLookup = useCallback(
    async (queryRaw: string, source: 'id' | 'name') => {
      const q = queryRaw.trim();
      const digitsOnly = q.replace(/\D/g, '');
      if (q.length < 3) {
        setGtkCandidates([]);
        setLookupStatus('idle');
        return;
      }

      if (
        matchedGtk &&
        ((matchedGtk.nip && matchedGtk.nip === q) ||
          (matchedGtk.nuptk && matchedGtk.nuptk === q) ||
          matchedGtk.nama.toLowerCase() === q.toLowerCase() ||
          matchedGtk.displayName.toLowerCase() === q.toLowerCase())
      ) {
        return;
      }

      // Check local gtkList first if available
      if (gtkList.length > 0) {
        const exact = gtkList.find((g) => {
          const nipDigits = String(g.nip ?? '').replace(/\D/g, '');
          const nuptkDigits = String(g.nuptk ?? '').replace(/\D/g, '');
          const bareName = g.nama.trim().toLowerCase();
          const fullName = formatPtkDisplayName(g).trim().toLowerCase();
          if (digitsOnly.length >= 8 && (nipDigits === digitsOnly || nuptkDigits === digitsOnly)) {
            return true;
          }
          return bareName === q.toLowerCase() || fullName === q.toLowerCase();
        });
        if (exact) {
          const summary = gtkToSummary(exact);
          applyGtkSummary(summary, source !== 'name', source !== 'id');
          return;
        }
        const candidates = gtkList
          .filter((g) => {
            if (digitsOnly.length >= 6) {
              return (
                g.nip.replace(/\D/g, '').includes(digitsOnly) ||
                g.nuptk.replace(/\D/g, '').includes(digitsOnly)
              );
            }
            return (
              g.nama.toLowerCase().includes(q.toLowerCase()) ||
              formatPtkDisplayName(g).toLowerCase().includes(q.toLowerCase())
            );
          })
          .slice(0, 6)
          .map(gtkToSummary);
        setGtkCandidates(candidates);
        setLookupStatus(candidates.length > 0 ? 'idle' : 'not-found');
        return;
      }

      setLookupStatus('searching');
      try {
        const res = await fetch(`/api/dapodik/lookup-gtk?q=${encodeURIComponent(q)}`);
        if (!res.ok) {
          setLookupStatus('idle');
          return;
        }
        const data = (await res.json()) as {
          found: boolean;
          exact: boolean;
          gtk: LookupGtkSummary | null;
          candidates: LookupGtkSummary[];
        };
        if (data.exact && data.gtk) {
          applyGtkSummary(data.gtk, source !== 'name', source !== 'id');
        } else if (data.candidates.length > 0) {
          setGtkCandidates(data.candidates);
          setLookupStatus('idle');
        } else {
          setGtkCandidates([]);
          setLookupStatus('not-found');
        }
      } catch {
        setLookupStatus('idle');
      }
    },
    [gtkList, matchedGtk, applyGtkSummary]
  );

  // Debounced auto-lookup saat Siswa mengetik NIS/NISN
  useEffect(() => {
    if (applicantRole !== 'Siswa' && applicantRole !== 'Alumni') return;
    const trimmed = identityNumber.trim();
    if (trimmed.length < 4) {
      if (matchedStudent) setMatchedStudent(null);
      setLookupStatus('idle');
      return;
    }
    const timer = window.setTimeout(() => {
      void runStudentLookup(trimmed);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [applicantRole, identityNumber, matchedStudent, runStudentLookup]);

  // Debounced auto-lookup saat GTK mengetik NIP/NUPTK
  useEffect(() => {
    if (applicantRole !== 'Guru / Tendik') return;
    const trimmed = identityNumber.trim();
    if (trimmed.length < 6) return;
    const timer = window.setTimeout(() => {
      void runGtkLookup(trimmed, 'id');
    }, 250);
    return () => window.clearTimeout(timer);
  }, [applicantRole, identityNumber, runGtkLookup]);

  // Debounced auto-lookup saat GTK mengetik Nama
  useEffect(() => {
    if (applicantRole !== 'Guru / Tendik') return;
    const trimmed = applicantName.trim();
    if (trimmed.length < 3) {
      setGtkCandidates([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void runGtkLookup(trimmed, 'name');
    }, 280);
    return () => window.clearTimeout(timer);
  }, [applicantRole, applicantName, runGtkLookup]);

  const handleRoleChange = (role: ApplicantRole) => {
    setApplicantRole(role);
    setLookupStatus('idle');
    setGtkCandidates([]);
    if (role === 'Guru / Tendik') {
      setMatchedStudent(null);
      setSelectedDapodikId('');
    } else {
      setMatchedGtk(null);
      setSelectedGtkId('');
    }
  };

  const toggleRequirement = (req: string) => {
    setCheckedReqs((prev) =>
      prev.includes(req) ? prev.filter((item) => item !== req) : [...prev, req]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

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
    setIsSubmitting(true);
    try {
      const ok = await onSubmitNewRequest(newRequest);
      if (ok) {
        setApplicantName('');
        setIdentityNumber('');
        setClassOrCohort('');
        setPhone('');
        setPurpose('');
        setNotes('');
        setCheckedReqs([]);
        setSelectedDapodikId('');
        setSelectedGtkId('');
        setMatchedStudent(null);
        setMatchedGtk(null);
        setGtkCandidates([]);
        setLookupStatus('idle');
      } else {
        setFormError(
          'Permohonan belum berhasil direkam ke server Tata Usaha. Periksa koneksi atau pesan notifikasi lalu klik Kirim ulang.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!reportingPortal.isOpen && userMode !== 'petugas') {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-amber-300 bg-white p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold text-slate-900">
          Pelaporan / Pengajuan Layanan Sedang Ditutup
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {reportingPortal.closedMessage}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Jam Layanan Loket TU: {SCHOOL_INFO.serviceHours}
        </p>
        {onNavigateQueue && (
          <button
            type="button"
            onClick={onNavigateQueue}
            className="mt-5 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Lacak Tiket & Antrean Berjalan
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8"
      >
        {!reportingPortal.isOpen && userMode === 'petugas' && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>
              <strong>Pelaporan Publik Ditutup:</strong> Pemohon tidak dapat mengirim formulir daring. Formulir ini tetap dibuka khusus untuk input loket oleh Petugas TU.
            </span>
          </div>
        )}

        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Formulir Permohonan Pelayanan Tata Usaha
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Ketik <strong>NIS / NISN</strong> (untuk Siswa) atau <strong>NIP / Nama</strong> (untuk GTK) agar nama dan identitas muncul otomatis sesuai Dapodik SMAN 9 Surabaya.
          </p>
        </div>

        {/* Ambil Cepat dari Database Dapodik Siswa / GTK (Hanya Mode Petugas TU terautentikasi) */}
        {userMode === 'petugas' && (students.length > 0 || gtkList.length > 0) && (
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
            {students.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Database className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                  <span>Pilih Cepat Siswa Dapodik</span>
                </div>
                <select
                  value={selectedDapodikId}
                  onChange={(e) => {
                    const found = students.find((s) => s.id === e.target.value);
                    if (found) applyStudentSummary(studentToSummary(found), true);
                    else setSelectedDapodikId('');
                  }}
                  aria-label="Pilih siswa dari database Dapodik"
                  className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                >
                  <option value="">-- Pilih siswa/alumni --</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.nama} · NISN {st.nisn} ({st.rombelSaatIni})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {gtkList.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Users className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Pilih Cepat GTK Dapodik</span>
                </div>
                <select
                  value={selectedGtkId}
                  onChange={(e) => {
                    const found = gtkList.find((g) => g.id === e.target.value);
                    if (found) applyGtkSummary(gtkToSummary(found), true, true);
                    else setSelectedGtkId('');
                  }}
                  aria-label="Pilih GTK dari database Dapodik"
                  className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                >
                  <option value="">-- Pilih Guru / Tendik --</option>
                  {gtkList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama.toUpperCase()} ({(g.jabatanPtk || g.jenisPtk).toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                onClick={() => handleRoleChange(role)}
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

        {/* Data Identitas dengan Pencarian Otomatis Dapodik */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="identity-number" className="block text-sm font-medium text-slate-800">
                {applicantRole === 'Guru / Tendik' ? 'NIP / NUPTK' : 'NISN / NIS (Ketik untuk Cek Dapodik)'}
              </label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="identity-number"
                    type="text"
                    required
                    value={identityNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIdentityNumber(val);
                      if (matchedStudent && val.trim() !== matchedStudent.nisn && val.trim() !== matchedStudent.nipd) {
                        setMatchedStudent(null);
                      }
                      if (matchedGtk && val.trim() !== matchedGtk.nip && val.trim() !== matchedGtk.nuptk) {
                        setMatchedGtk(null);
                      }
                    }}
                    placeholder={
                      applicantRole === 'Guru / Tendik'
                        ? 'Ketik NIP atau NUPTK'
                        : 'Ketik NIS atau NISN (mis. 0106961457)'
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (applicantRole === 'Guru / Tendik') {
                      void runGtkLookup(identityNumber || applicantName, identityNumber ? 'id' : 'name');
                    } else {
                      void runStudentLookup(identityNumber, true);
                    }
                  }}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  {lookupStatus === 'searching' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" aria-hidden="true" />
                  ) : (
                    <Search className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                  )}
                  <span>Cek Data</span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="applicant-name" className="block text-sm font-medium text-slate-800">
                {applicantRole === 'Guru / Tendik'
                  ? 'Nama Lengkap GTK (Ketik Nama untuk Cek PTK)'
                  : 'Nama Lengkap Pemohon / Siswa'}
              </label>
              <input
                id="applicant-name"
                type="text"
                required
                value={applicantName}
                onChange={(e) => {
                  const val = e.target.value;
                  setApplicantName(val);
                  if (matchedGtk && val.trim().toLowerCase() !== matchedGtk.nama.toLowerCase() && val.trim().toLowerCase() !== matchedGtk.displayName.toLowerCase()) {
                    setMatchedGtk(null);
                  }
                }}
                placeholder={
                  applicantRole === 'Guru / Tendik'
                    ? 'Ketik nama guru / tendik sesuai Dapodik'
                    : 'Terisi otomatis jika NIS/NISN cocok dengan Dapodik'
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="class-cohort" className="block text-sm font-medium text-slate-800">
                {applicantRole === 'Alumni'
                  ? 'Tahun Lulus / Angkatan'
                  : applicantRole === 'Guru / Tendik'
                    ? 'Jabatan PTK / Unit Tugas'
                    : 'Kelas / Rombel Saat Ini'}
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
                      ? 'Terisi otomatis sesuai PTK Dapodik'
                      : 'Terisi otomatis sesuai Rombel Dapodik'
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
                placeholder="Contoh: 081234567890"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Kartu Identitas Siswa Terverifikasi Dapodik */}
          {matchedStudent && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  <span>Identitas Siswa Terverifikasi di Database Dapodik SMAN 9 Surabaya</span>
                </div>
                <span className="rounded border border-emerald-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                  STATUS: {matchedStudent.statusSiswa.toUpperCase()}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-emerald-200/70 pt-3 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-emerald-800/80">Nama Lengkap</dt>
                  <dd className="font-semibold text-slate-900">{matchedStudent.nama}</dd>
                </div>
                <div>
                  <dt className="text-emerald-800/80">Rombel / Kelas</dt>
                  <dd className="font-mono font-semibold text-slate-900">
                    {matchedStudent.rombelSaatIni || '-'} (Tingkat {matchedStudent.tingkatKelas})
                  </dd>
                </div>
                <div>
                  <dt className="text-emerald-800/80">NISN / NIPD</dt>
                  <dd className="font-mono font-semibold text-slate-900">
                    {matchedStudent.nisn || '-'} / {matchedStudent.nipd || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-emerald-800/80">L/P · TTL</dt>
                  <dd className="text-slate-900">
                    {matchedStudent.jk} · {matchedStudent.tempatLahir || '-'},{' '}
                    {matchedStudent.tanggalLahir || '-'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Kartu Identitas GTK Terverifikasi Dapodik */}
          {matchedGtk && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 uppercase">
              <div className="flex items-start gap-3.5">
                <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg border border-emerald-200 bg-white">
                  {matchedGtk.fotoDataUrl ? (
                    <img
                      src={matchedGtk.fotoDataUrl}
                      alt={matchedGtk.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <User className="h-5 w-5" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold normal-case text-emerald-900">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                      <span>Data GTK Padan dengan Database PTK Dapodik</span>
                    </div>
                    <span className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-semibold normal-case text-emerald-800">
                      {matchedGtk.dukcapilStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {matchedGtk.displayName || matchedGtk.nama}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700">
                    <span className="font-mono">NIP: {matchedGtk.nip || '-'}</span>
                    <span className="font-mono">NUPTK: {matchedGtk.nuptk || '-'}</span>
                    <span>STATUS: {matchedGtk.statusKepegawaian}</span>
                    <span>JABATAN: {matchedGtk.jabatanPtk || matchedGtk.jenisPtk}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Daftar Kandidat GTK jika mengetik sebagian nama */}
          {applicantRole === 'Guru / Tendik' && !matchedGtk && gtkCandidates.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
              <p className="text-xs font-semibold text-blue-900">
                Ditemukan {gtkCandidates.length} GTK yang sesuai di Database PTK Dapodik — klik untuk pilih:
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {gtkCandidates.map((cand) => (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => applyGtkSummary(cand, true, true)}
                    className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-left transition-colors hover:border-blue-500 hover:bg-blue-50"
                  >
                    <div className="h-9 w-8 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                      {cand.fotoDataUrl ? (
                        <img
                          src={cand.fotoDataUrl}
                          alt={cand.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <User className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 uppercase">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {cand.displayName || cand.nama}
                      </p>
                      <p className="truncate font-mono text-[10px] text-slate-500">
                        {cand.nip ? `NIP ${cand.nip}` : `NUPTK ${cand.nuptk || '-'}`} ·{' '}
                        {cand.jabatanPtk || cand.jenisPtk}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pesan bila NIS/NISN atau NIP tidak ditemukan di database Dapodik */}
          {lookupStatus === 'not-found' && !matchedStudent && !matchedGtk && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              <span>
                {applicantRole === 'Guru / Tendik'
                  ? 'NIP/Nama GTK belum ditemukan padan di database PTK Dapodik saat ini. Anda tetap dapat mengisi identitas secara manual untuk diverifikasi Petugas TU.'
                  : 'NIS/NISN belum ditemukan di database Siswa Dapodik saat ini. Periksa kembali penulisan angka NIS/NISN, atau lengkapi nama dan kelas secara manual.'}
              </span>
            </div>
          )}
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
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400 whitespace-nowrap"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                <span>Menyimpan Permohonan...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Kirim Permohonan Layanan</span>
              </>
            )}
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
            <li>Masukkan NIS/NISN (Siswa) atau NIP/Nama (GTK) untuk menarik identitas resmi Dapodik.</li>
            <li>Setelah mengirim formulir, Anda memperoleh Kode Tiket dan permohonan langsung masuk ke meja Petugas TU.</li>
            <li>Jika status berubah menjadi <strong className="text-slate-800">Siap Diambil</strong>, bawa berkas fisik pendukung ke Ruang Tata Usaha SMAN 9 Surabaya.</li>
          </ol>
        </div>
      </aside>
    </div>
  );
}
