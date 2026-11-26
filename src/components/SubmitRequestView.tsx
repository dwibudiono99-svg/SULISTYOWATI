import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Database,
  Loader2,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Square,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SCHOOL_INFO, TU_SERVICE_CATALOG } from '../config/schoolConfig';
import {
  ApplicantRole,
  DapodikGtk,
  DapodikStudent,
  ReportingPortalConfig,
  RequestParticipant,
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
const MULTI_PARTICIPANT_SERVICES = new Set<ServiceCategoryId>([
  'surat-tugas',
  'rekomendasi',
  'izin-kegiatan',
]);

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

function createParticipantId(): string {
  return `ps-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

  // Mode Perorangan vs Berkelompok / Multiple Peserta
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [participants, setParticipants] = useState<RequestParticipant[]>([]);

  // Pencari Tambah Peserta ke Tabel (untuk Berkelompok)
  const [memberLookupType, setMemberLookupType] = useState<'siswa' | 'gtk'>('siswa');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberSearching, setMemberSearching] = useState(false);
  const [memberHint, setMemberHint] = useState('');
  const [memberStudentResults, setMemberStudentResults] = useState<LookupStudentSummary[]>([]);
  const [memberGtkResults, setMemberGtkResults] = useState<LookupGtkSummary[]>([]);

  // Panel Pilih Banyak (untuk Petugas TU saat database Dapodik Siswa/GTK termuat)
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const [bulkTab, setBulkTab] = useState<'siswa' | 'gtk'>('siswa');
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkRombelFilter, setBulkRombelFilter] = useState('ALL');
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);

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

  // Sinkronkan tipe default pencarian peserta saat ganti layanan/peran
  useEffect(() => {
    if (serviceId === 'surat-tugas' || applicantRole === 'Guru / Tendik') {
      setMemberLookupType('gtk');
      if (gtkList.length > 0) setBulkTab('gtk');
    } else {
      setMemberLookupType('siswa');
      if (students.length > 0) setBulkTab('siswa');
    }
  }, [serviceId, applicantRole, gtkList.length, students.length]);

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
  const supportsMultiService = MULTI_PARTICIPANT_SERVICES.has(serviceId);

  useEffect(() => {
    setCheckedReqs([]);
  }, [serviceId]);

  const addParticipantRow = useCallback((entry: Omit<RequestParticipant, 'id'>) => {
    setParticipants((prev) => {
      const idNorm = entry.identityNumber.trim().toLowerCase();
      const nameNorm = entry.nama.trim().toLowerCase();
      const alreadyExists = prev.some(
        (p) =>
          (idNorm && idNorm !== '-' && p.identityNumber.trim().toLowerCase() === idNorm) ||
          (nameNorm && p.nama.trim().toLowerCase() === nameNorm && p.classOrCohort.trim().toLowerCase() === entry.classOrCohort.trim().toLowerCase())
      );
      if (alreadyExists) return prev;
      return [
        ...prev,
        {
          id: createParticipantId(),
          nama: entry.nama.trim(),
          identityNumber: entry.identityNumber.trim() || '-',
          classOrCohort: entry.classOrCohort.trim() || '-',
          roleLabel: entry.roleLabel?.trim() || (prev.length === 0 ? 'Ketua / Koordinator' : 'Peserta'),
        },
      ];
    });
  }, []);

  const handleToggleGroupMode = (enabled: boolean) => {
    setIsGroupMode(enabled);
    setFormError('');
    if (enabled && participants.length === 0 && applicantName.trim()) {
      addParticipantRow({
        nama: applicantName.trim(),
        identityNumber: identityNumber.trim() || '-',
        classOrCohort: classOrCohort.trim() || '-',
        roleLabel: applicantRole === 'Guru / Tendik' ? 'Koordinator / Pembina' : 'Ketua Tim / Peserta',
      });
    }
  };

  // Sinkronkan baris pertama ke kolom utama bila kolom utama masih kosong di mode berkelompok
  useEffect(() => {
    if (!isGroupMode || participants.length === 0) return;
    const first = participants[0];
    if (!applicantName.trim() && first.nama.trim()) {
      setApplicantName(first.nama);
      setIdentityNumber(first.identityNumber !== '-' ? first.identityNumber : '');
      setClassOrCohort(first.classOrCohort);
    }
  }, [isGroupMode, participants, applicantName]);

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

  // Pencarian cepat peserta tambahan di mode berkelompok
  const runMemberSearch = useCallback(async () => {
    const q = memberQuery.trim();
    const digitsOnly = q.replace(/\D/g, '');
    setMemberHint('');
    setMemberStudentResults([]);
    setMemberGtkResults([]);

    if (q.length < 3) {
      setMemberHint('Ketik minimal 3 karakter (NIS/NISN untuk Siswa, atau NIP/Nama untuk GTK).');
      return;
    }

    if (memberLookupType === 'siswa') {
      if (students.length > 0) {
        const matches = students
          .filter((s) => {
            if (digitsOnly.length >= 4) {
              return (
                s.nisn.replace(/\D/g, '').includes(digitsOnly) ||
                s.nipd.replace(/\D/g, '').includes(digitsOnly)
              );
            }
            return (
              s.nama.toLowerCase().includes(q.toLowerCase()) ||
              s.rombelSaatIni.toLowerCase().includes(q.toLowerCase())
            );
          })
          .slice(0, 8)
          .map(studentToSummary);
        setMemberStudentResults(matches);
        if (matches.length === 0) {
          setMemberHint('Siswa tidak ditemukan di database Dapodik. Gunakan "Tambah Baris Manual" bila perlu.');
        }
        return;
      }

      setMemberSearching(true);
      try {
        const res = await fetch(`/api/dapodik/lookup-student?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = (await res.json()) as {
            found: boolean;
            student: LookupStudentSummary | null;
          };
          if (data.found && data.student) {
            setMemberStudentResults([data.student]);
          } else {
            setMemberHint('NIS/NISN siswa tidak ditemukan di Dapodik. Silakan tambah baris manual di tabel.');
          }
        }
      } catch {
        setMemberHint('Gagal mencari data siswa di server.');
      } finally {
        setMemberSearching(false);
      }
    } else {
      if (gtkList.length > 0) {
        const matches = gtkList
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
          .slice(0, 8)
          .map(gtkToSummary);
        setMemberGtkResults(matches);
        if (matches.length === 0) {
          setMemberHint('GTK tidak ditemukan di database PTK. Gunakan "Tambah Baris Manual" bila perlu.');
        }
        return;
      }

      setMemberSearching(true);
      try {
        const res = await fetch(`/api/dapodik/lookup-gtk?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = (await res.json()) as {
            found: boolean;
            gtk: LookupGtkSummary | null;
            candidates: LookupGtkSummary[];
          };
          const list = data.candidates.length > 0 ? data.candidates : data.gtk ? [data.gtk] : [];
          setMemberGtkResults(list);
          if (list.length === 0) {
            setMemberHint('NIP/Nama GTK belum ditemukan di Dapodik. Silakan tambah baris manual.');
          }
        }
      } catch {
        setMemberHint('Gagal mencari data GTK di server.');
      } finally {
        setMemberSearching(false);
      }
    }
  }, [memberQuery, memberLookupType, students, gtkList]);

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

  const updateParticipantCell = (
    id: string,
    field: keyof Omit<RequestParticipant, 'id'>,
    value: string
  ) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const moveParticipant = (index: number, delta: -1 | 1) => {
    setParticipants((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const removeParticipant = (id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const rombelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (s.rombelSaatIni) set.add(s.rombelSaatIni);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const filteredBulkStudents = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase();
    return students
      .filter((s) => {
        if (bulkRombelFilter !== 'ALL' && s.rombelSaatIni !== bulkRombelFilter) return false;
        if (!q) return true;
        return (
          s.nama.toLowerCase().includes(q) ||
          s.nisn.toLowerCase().includes(q) ||
          s.nipd.toLowerCase().includes(q) ||
          s.rombelSaatIni.toLowerCase().includes(q)
        );
      })
      .slice(0, 80);
  }, [students, bulkSearch, bulkRombelFilter]);

  const filteredBulkGtk = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase();
    return gtkList
      .filter((g) => {
        if (!q) return true;
        return (
          g.nama.toLowerCase().includes(q) ||
          formatPtkDisplayName(g).toLowerCase().includes(q) ||
          g.nip.toLowerCase().includes(q) ||
          g.nuptk.toLowerCase().includes(q) ||
          (g.jabatanPtk || g.jenisPtk).toLowerCase().includes(q)
        );
      })
      .slice(0, 80);
  }, [gtkList, bulkSearch]);

  const handleCommitBulkSelection = () => {
    if (bulkSelectedIds.length === 0) return;
    if (bulkTab === 'siswa') {
      for (const id of bulkSelectedIds) {
        const st = students.find((s) => s.id === id);
        if (st) {
          addParticipantRow({
            nama: st.nama,
            identityNumber: st.nisn || st.nipd || '-',
            classOrCohort: st.rombelSaatIni || '-',
            roleLabel: participants.length === 0 ? 'Ketua / Peserta' : 'Peserta',
          });
        }
      }
    } else {
      for (const id of bulkSelectedIds) {
        const g = gtkList.find((item) => item.id === id);
        if (g) {
          addParticipantRow({
            nama: formatPtkDisplayName(g) || g.nama,
            identityNumber: g.nip || g.nuptk || '-',
            classOrCohort: g.jabatanPtk || g.tugasTambahan || g.jenisPtk,
            roleLabel: 'Pelaksana / Guru',
          });
        }
      }
    }
    setBulkSelectedIds([]);
    setBulkPickerOpen(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanedParticipants = isGroupMode
      ? participants
          .map((p) => ({
            id: p.id,
            nama: p.nama.trim(),
            identityNumber: p.identityNumber.trim() || '-',
            classOrCohort: p.classOrCohort.trim() || '-',
            roleLabel: p.roleLabel?.trim() || 'Peserta',
          }))
          .filter((p) => p.nama.length > 0)
      : [];

    if (isGroupMode && cleanedParticipants.length < 2) {
      setFormError(
        'Mode Berkelompok memerlukan minimal 2 peserta di dalam Tabel Daftar Peserta. Tambahkan peserta lain atau ubah ke mode Perorangan.'
      );
      return;
    }

    const effectiveName = applicantName.trim() || cleanedParticipants[0]?.nama || '';
    const effectiveIdentity =
      identityNumber.trim() || cleanedParticipants[0]?.identityNumber || '';
    const effectiveClass =
      classOrCohort.trim() || cleanedParticipants[0]?.classOrCohort || '-';

    if (!effectiveName || !effectiveIdentity || !phone.trim() || !purpose.trim()) {
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
      applicantName: effectiveName,
      applicantRole,
      identityNumber: effectiveIdentity,
      classOrCohort: effectiveClass,
      phone: phone.trim(),
      purpose: purpose.trim(),
      notes: notes.trim(),
      participants: cleanedParticipants.length > 1 ? cleanedParticipants : undefined,
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
          actor: effectiveName,
          note:
            cleanedParticipants.length > 1
              ? `Permohonan berkelompok ${selectedService.title} (${cleanedParticipants.length} peserta) diajukan melalui SIP TU SMAN 9 Surabaya.`
              : `Permohonan ${selectedService.title} diajukan secara daring melalui SIP TU SMAN 9 Surabaya.`,
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
        setParticipants([]);
        setIsGroupMode(false);
        setMemberQuery('');
        setMemberStudentResults([]);
        setMemberGtkResults([]);
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
            Ketik <strong>NIS / NISN</strong> (untuk Siswa) atau <strong>NIP / Nama</strong> (untuk GTK) agar identitas muncul otomatis sesuai Dapodik. Untuk Surat Tugas atau Lomba Berkelompok, pilih mode <strong>Berkelompok / Multiple Peserta</strong>.
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

        {/* Status Pemohon & Mode Jumlah Peserta */}
        <div className="space-y-4">
          <div>
            <span className="block text-sm font-medium text-slate-800">Status Pemohon Utama / Penanggung Jawab</span>
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

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="block text-xs font-semibold text-slate-800">
                  Jumlah Peserta dalam Surat {supportsMultiService ? '(Disarankan untuk Surat Tugas / Lomba)' : ''}
                </span>
                <p className="text-[11px] text-slate-500">
                  Pilih Berkelompok jika Surat Tugas, Rekomendasi Lomba, atau Dispensasi ditujukan lebih dari 1 orang.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => handleToggleGroupMode(false)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    !isGroupMode
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Perorangan</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleGroupMode(true)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    isGroupMode
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-700 hover:bg-blue-50 hover:text-blue-800'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Berkelompok / Multiple</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Data Identitas Pemohon Utama dengan Pencarian Otomatis Dapodik */}
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
                    required={!isGroupMode || participants.length === 0}
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
                  : isGroupMode
                    ? 'Nama Pemohon Utama / Ketua Tim'
                    : 'Nama Lengkap Pemohon / Siswa'}
              </label>
              <input
                id="applicant-name"
                type="text"
                required={!isGroupMode || participants.length === 0}
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
                Nomor WhatsApp Aktif (Kontak Penanggung Jawab)
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
                <div className="flex items-center gap-2">
                  <span className="rounded border border-emerald-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                    STATUS: {matchedStudent.statusSiswa.toUpperCase()}
                  </span>
                  {isGroupMode && (
                    <button
                      type="button"
                      onClick={() =>
                        addParticipantRow({
                          nama: matchedStudent.nama,
                          identityNumber: matchedStudent.nisn || matchedStudent.nipd,
                          classOrCohort: matchedStudent.rombelSaatIni || '-',
                          roleLabel: participants.length === 0 ? 'Ketua Tim' : 'Peserta',
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      <span>Masukkan ke Tabel</span>
                    </button>
                  )}
                </div>
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
                    <div className="flex items-center gap-2 normal-case">
                      <span className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        {matchedGtk.dukcapilStatus}
                      </span>
                      {isGroupMode && (
                        <button
                          type="button"
                          onClick={() =>
                            addParticipantRow({
                              nama: matchedGtk.displayName || matchedGtk.nama,
                              identityNumber: matchedGtk.nip || matchedGtk.nuptk || '-',
                              classOrCohort: matchedGtk.jabatanPtk || matchedGtk.tugasTambahan || matchedGtk.jenisPtk,
                              roleLabel: 'Pelaksana / Guru',
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                          <span>Masukkan ke Tabel</span>
                        </button>
                      )}
                    </div>
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

        {/* Builder & Tabel Daftar Peserta Berkelompok */}
        {isGroupMode && (
          <section className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Users className="h-4 w-4 text-blue-700" aria-hidden="true" />
                  <span>Daftar Peserta Berkelompok ({participants.length} Orang)</span>
                </h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Tambahkan lebih dari 1 siswa atau guru/pembina. Daftar ini akan dicetak rapi dalam bentuk tabel pada Surat Resmi & Tanda Terima.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {applicantName.trim() && (
                  <button
                    type="button"
                    onClick={() =>
                      addParticipantRow({
                        nama: applicantName.trim(),
                        identityNumber: identityNumber.trim() || '-',
                        classOrCohort: classOrCohort.trim() || '-',
                        roleLabel: applicantRole === 'Guru / Tendik' ? 'Koordinator / Pembina' : 'Ketua Tim',
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50 whitespace-nowrap"
                  >
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>+ Pemohon Utama</span>
                  </button>
                )}
                {userMode === 'petugas' && (students.length > 0 || gtkList.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setBulkPickerOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Database className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                    <span>{bulkPickerOpen ? 'Tutup Pilih Banyak' : 'Pilih Banyak Dapodik'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setParticipants((prev) => [
                      ...prev,
                      {
                        id: createParticipantId(),
                        nama: '',
                        identityNumber: '',
                        classOrCohort: '',
                        roleLabel: prev.length === 0 ? 'Ketua Tim' : 'Peserta',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tambah Baris Manual</span>
                </button>
              </div>
            </div>

            {/* Panel Pilih Banyak Siswa / GTK (Mode Petugas TU) */}
            {bulkPickerOpen && userMode === 'petugas' && (students.length > 0 || gtkList.length > 0) && (
              <div className="space-y-3 rounded-lg border border-slate-300 bg-white p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                    {students.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setBulkTab('siswa');
                          setBulkSelectedIds([]);
                        }}
                        className={`rounded px-2.5 py-1 text-xs font-semibold ${
                          bulkTab === 'siswa' ? 'bg-slate-900 text-white' : 'text-slate-600'
                        }`}
                      >
                        Siswa ({students.length})
                      </button>
                    )}
                    {gtkList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setBulkTab('gtk');
                          setBulkSelectedIds([]);
                        }}
                        className={`rounded px-2.5 py-1 text-xs font-semibold ${
                          bulkTab === 'gtk' ? 'bg-slate-900 text-white' : 'text-slate-600'
                        }`}
                      >
                        Guru / Tendik ({gtkList.length})
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={bulkSelectedIds.length === 0}
                    onClick={handleCommitBulkSelection}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:bg-slate-300"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tambahkan ({bulkSelectedIds.length}) Terpilih</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={bulkSearch}
                    onChange={(e) => setBulkSearch(e.target.value)}
                    placeholder={
                      bulkTab === 'siswa'
                        ? 'Filter nama siswa, NISN, atau kelas...'
                        : 'Filter nama GTK, NIP, atau jabatan...'
                    }
                    className="h-9 min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 text-xs text-slate-900"
                  />
                  {bulkTab === 'siswa' && rombelOptions.length > 0 && (
                    <select
                      value={bulkRombelFilter}
                      onChange={(e) => setBulkRombelFilter(e.target.value)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800"
                    >
                      <option value="ALL">Semua Rombel</option>
                      {rombelOptions.map((rb) => (
                        <option key={rb} value={rb}>
                          {rb}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {bulkTab === 'siswa' ? (
                    filteredBulkStudents.map((st) => {
                      const checked = bulkSelectedIds.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setBulkSelectedIds((prev) =>
                                  checked ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-700"
                            />
                            <span className="truncate font-medium text-slate-900">{st.nama}</span>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-slate-500">
                            {st.nisn || st.nipd} · {st.rombelSaatIni}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    filteredBulkGtk.map((g) => {
                      const checked = bulkSelectedIds.includes(g.id);
                      return (
                        <label
                          key={g.id}
                          className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setBulkSelectedIds((prev) =>
                                  checked ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-700"
                            />
                            <span className="truncate font-medium text-slate-900">
                              {formatPtkDisplayName(g) || g.nama}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-slate-500">
                            {g.nip || g.nuptk || '-'} · {g.jabatanPtk || g.jenisPtk}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Cari & Tambah Satu per Satu via Lookup Dapodik */}
            <div className="rounded-lg border border-blue-200 bg-white p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={memberLookupType}
                  onChange={(e) => {
                    setMemberLookupType(e.target.value as 'siswa' | 'gtk');
                    setMemberStudentResults([]);
                    setMemberGtkResults([]);
                    setMemberHint('');
                  }}
                  aria-label="Tipe pencarian anggota peserta"
                  className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-xs font-medium text-slate-800"
                >
                  <option value="siswa">Cari Siswa (NIS/NISN)</option>
                  <option value="gtk">Cari Guru/Tendik (NIP/Nama)</option>
                </select>
                <div className="flex flex-1 gap-2">
                  <input
                    type="text"
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void runMemberSearch();
                      }
                    }}
                    placeholder={
                      memberLookupType === 'siswa'
                        ? 'Ketik NIS atau NISN peserta lomba untuk ditambahkan...'
                        : 'Ketik NIP atau Nama guru/pembina yang ditugaskan...'
                    }
                    className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-xs text-slate-900 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => void runMemberSearch()}
                    disabled={memberSearching}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-200 whitespace-nowrap"
                  >
                    {memberSearching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Search className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                    )}
                    <span>Cari & Tambah</span>
                  </button>
                </div>
              </div>

              {memberHint && <p className="mt-2 text-xs text-amber-800">{memberHint}</p>}

              {memberStudentResults.length > 0 && (
                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {memberStudentResults.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{st.nama}</p>
                        <p className="font-mono text-[11px] text-slate-600">
                          {st.nisn || st.nipd} · {st.rombelSaatIni}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          addParticipantRow({
                            nama: st.nama,
                            identityNumber: st.nisn || st.nipd || '-',
                            classOrCohort: st.rombelSaatIni || '-',
                            roleLabel: participants.length === 0 ? 'Ketua Tim' : 'Peserta',
                          });
                          setMemberQuery('');
                          setMemberStudentResults([]);
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {memberGtkResults.length > 0 && (
                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {memberGtkResults.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {g.displayName || g.nama}
                        </p>
                        <p className="truncate font-mono text-[11px] text-slate-600">
                          {g.nip || g.nuptk || '-'} · {g.jabatanPtk || g.jenisPtk}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          addParticipantRow({
                            nama: g.displayName || g.nama,
                            identityNumber: g.nip || g.nuptk || '-',
                            classOrCohort: g.jabatanPtk || g.tugasTambahan || g.jenisPtk,
                            roleLabel: 'Pelaksana / Guru',
                          });
                          setMemberQuery('');
                          setMemberGtkResults([]);
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabel Rapi Daftar Peserta */}
            <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
              <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 font-semibold text-slate-800">
                    <th className="w-10 border-r border-slate-200 px-2.5 py-2 text-center">No</th>
                    <th className="border-r border-slate-200 px-2.5 py-2">Nama Lengkap</th>
                    <th className="w-40 border-r border-slate-200 px-2.5 py-2">NISN / NIS / NIP</th>
                    <th className="w-36 border-r border-slate-200 px-2.5 py-2">Kelas / Jabatan</th>
                    <th className="w-36 border-r border-slate-200 px-2.5 py-2">Peran / Ket.</th>
                    <th className="w-24 px-2.5 py-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {participants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-500">
                        Belum ada peserta di tabel. Cari NIS/NISN atau NIP di atas, atau klik <strong>Tambah Baris Manual</strong>.
                      </td>
                    </tr>
                  ) : (
                    participants.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="border-r border-slate-200 px-2 py-1.5 text-center font-mono tabular-nums text-slate-600">
                          {idx + 1}
                        </td>
                        <td className="border-r border-slate-200 px-1.5 py-1">
                          <input
                            type="text"
                            value={p.nama}
                            onChange={(e) => updateParticipantCell(p.id, 'nama', e.target.value)}
                            placeholder="Nama lengkap peserta"
                            className="h-8 w-full rounded border border-transparent px-2 text-xs font-medium text-slate-900 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="border-r border-slate-200 px-1.5 py-1">
                          <input
                            type="text"
                            value={p.identityNumber}
                            onChange={(e) =>
                              updateParticipantCell(p.id, 'identityNumber', e.target.value)
                            }
                            placeholder="NISN / NIP"
                            className="h-8 w-full rounded border border-transparent px-2 font-mono text-xs text-slate-800 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="border-r border-slate-200 px-1.5 py-1">
                          <input
                            type="text"
                            value={p.classOrCohort}
                            onChange={(e) =>
                              updateParticipantCell(p.id, 'classOrCohort', e.target.value)
                            }
                            placeholder="Kelas / Jabatan"
                            className="h-8 w-full rounded border border-transparent px-2 text-xs text-slate-800 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="border-r border-slate-200 px-1.5 py-1">
                          <input
                            type="text"
                            value={p.roleLabel || ''}
                            onChange={(e) =>
                              updateParticipantCell(p.id, 'roleLabel', e.target.value)
                            }
                            placeholder="Ketua / Anggota / Pembina"
                            className="h-8 w-full rounded border border-transparent px-2 text-xs text-slate-700 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="px-1.5 py-1">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveParticipant(idx, -1)}
                              disabled={idx === 0}
                              title="Geser naik"
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                            >
                              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveParticipant(idx, 1)}
                              disabled={idx === participants.length - 1}
                              title="Geser turun"
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                            >
                              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeParticipant(p.id)}
                              title="Hapus baris"
                              className="rounded p-1 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Keperluan */}
        <div>
          <label htmlFor="purpose-input" className="block text-sm font-medium text-slate-800">
            Keperluan & Tujuan Instansi / Nama Kegiatan Lomba
          </label>
          <input
            id="purpose-input"
            type="text"
            required
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Tuliskan tujuan penggunaan surat, nama lomba, tanggal pelaksanaan, atau lokasi penugasan"
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
            placeholder="Misal: jadwal pelaksanaan lomba, jam dispensasi, atau catatan pembina pendamping."
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
                <span>
                  {isGroupMode && participants.length > 1
                    ? `Kirim Permohonan (${participants.length} Peserta)`
                    : 'Kirim Permohonan Layanan'}
                </span>
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
            <li>Untuk tim lomba atau surat tugas kolektif, aktifkan mode <strong>Berkelompok / Multiple</strong> agar seluruh peserta terdata rapi dalam tabel.</li>
            <li>Jika status berubah menjadi <strong className="text-slate-800">Siap Diambil</strong>, bawa berkas fisik pendukung ke Ruang Tata Usaha SMAN 9 Surabaya.</li>
          </ol>
        </div>
      </aside>
    </div>
  );
}
