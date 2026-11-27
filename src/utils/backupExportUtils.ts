import * as XLSX from 'xlsx';
import {
  AgendaEntry,
  BackupBundlePayload,
  DapodikGtk,
  DapodikRombel,
  DapodikStudent,
  DataMovementLogEntry,
  ServiceRequest,
} from '../types/tu';
import { gtkToRowArray, GTK_DAPODIK_HEADERS } from './gtkDapodikValidation';
import { DAPODIK_EXCEL_HEADERS, studentToDapodikRowArray } from './dapodikValidation';

export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJsonFile(payload: unknown, filename: string): void {
  const jsonText = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  downloadBlobFile(blob, filename);
}

export function exportPersuratanRequestsWorkbook(requests: ServiceRequest[]): void {
  const headers = [
    'No',
    'Kode Tiket',
    'Jenis Layanan',
    'Status',
    'Nomor Surat',
    'Nama Pemohon',
    'Peran',
    'NISN / NIP',
    'Kelas / Unit',
    'No. HP',
    'Keperluan',
    'Jumlah Peserta',
    'Petugas TU',
    'Tanggal Pengajuan',
    'Pembaruan Terakhir',
  ];
  const rows = requests.map((r, idx) => [
    idx + 1,
    r.id,
    r.serviceTitle,
    r.status,
    r.letterNumber || '-',
    r.applicantName,
    r.applicantRole,
    r.identityNumber,
    r.classOrCohort,
    r.phone,
    r.purpose,
    r.participants?.length ?? 1,
    r.assignedStaff,
    r.createdAt,
    r.updatedAt,
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Permohonan Surat');
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `rekap-permohonan-surat-sman9sby-${dateStr}.xlsx`);
}

export function exportAgendaWorkbook(entries: AgendaEntry[]): void {
  const headers = [
    'No',
    'Jenis',
    'Nomor Agenda',
    'Nomor Surat',
    'Tanggal Surat',
    'Tanggal Dicatat',
    'Asal / Tujuan',
    'Perihal',
    'Sifat',
    'Disposisi',
    'Tiket Terkait',
  ];
  const rows = entries.map((e, idx) => [
    idx + 1,
    e.type,
    e.agendaNumber,
    e.letterNumber,
    e.letterDate,
    e.recordedDate,
    e.counterparty,
    e.subject,
    e.classification,
    e.disposition,
    e.relatedTicketId || '-',
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Buku Agenda');
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `buku-agenda-surat-sman9sby-${dateStr}.xlsx`);
}

export function exportCombinedExcelBackup(data: {
  requests: ServiceRequest[];
  agenda: AgendaEntry[];
  students: DapodikStudent[];
  gtkList: DapodikGtk[];
  rombels: DapodikRombel[];
  movementLogs?: DataMovementLogEntry[];
}): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Ringkasan
  const summaryRows = [
    ['BACKUP REPOSITORI TERPADU SIP TU SMAN 9 SURABAYA'],
    ['Diekspor pada', new Date().toLocaleString('id-ID')],
    [],
    ['Repositori', 'Jumlah Data'],
    ['Permohonan Surat', data.requests.length],
    ['Buku Agenda Surat', data.agenda.length],
    ['Peserta Didik Dapodik', data.students.length],
    ['GTK Dapodik', data.gtkList.length],
    ['Rombel & Wali Kelas', data.rombels.length],
    ['Log Pelacakan Keluar Masuk Data', data.movementLogs?.length ?? 0],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Ringkasan');

  // Sheet 2: Permohonan Surat
  const reqHeaders = [
    'Kode Tiket',
    'Layanan',
    'Status',
    'Nomor Surat',
    'Pemohon',
    'NISN/NIP',
    'Kelas/Unit',
    'Keperluan',
    'Petugas TU',
    'Tanggal',
  ];
  const reqRows = data.requests.map((r) => [
    r.id,
    r.serviceTitle,
    r.status,
    r.letterNumber || '-',
    r.applicantName,
    r.identityNumber,
    r.classOrCohort,
    r.purpose,
    r.assignedStaff,
    r.createdAt,
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([reqHeaders, ...reqRows]), 'Permohonan');

  // Sheet 3: Buku Agenda
  const agHeaders = [
    'Jenis',
    'No Agenda',
    'No Surat',
    'Tgl Surat',
    'Asal/Tujuan',
    'Perihal',
    'Sifat',
    'Disposisi',
  ];
  const agRows = data.agenda.map((a) => [
    a.type,
    a.agendaNumber,
    a.letterNumber,
    a.letterDate,
    a.counterparty,
    a.subject,
    a.classification,
    a.disposition,
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([agHeaders, ...agRows]), 'Agenda Surat');

  // Sheet 4: Siswa Dapodik
  const stuRows = data.students.map((s, idx) => studentToDapodikRowArray(s, idx));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([[...DAPODIK_EXCEL_HEADERS], ...stuRows]),
    'Siswa Dapodik'
  );

  // Sheet 5: GTK Dapodik
  const gtkRows = data.gtkList.map((g, idx) => gtkToRowArray(g, idx));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([[...GTK_DAPODIK_HEADERS], ...gtkRows]),
    'GTK Dapodik'
  );

  // Sheet 6: Rombel
  const romHeaders = ['No', 'Nama Rombel', 'Tingkat', 'L', 'P', 'Total', 'Wali Kelas', 'Kurikulum', 'Ruangan'];
  const romRows = data.rombels.map((r, idx) => [
    idx + 1,
    r.namaRombel,
    r.tingkatKelas,
    r.jumlahL,
    r.jumlahP,
    r.jumlahTotal,
    r.waliKelasNama,
    r.kurikulum,
    r.ruangan,
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([romHeaders, ...romRows]), 'Rombel');

  // Sheet 7: Pelacakan Keluar Masuk Data
  if (data.movementLogs && data.movementLogs.length > 0) {
    const movHeaders = [
      'No',
      'Waktu',
      'Database',
      'Arah',
      'Sumber',
      'Tahun Pelajaran',
      'Nama',
      'NISN/NIP/NIK',
      'Rombel/Jabatan',
      'Status',
      'Keterangan',
      'Petugas',
    ];
    const movRows = data.movementLogs.map((m, idx) => [
      idx + 1,
      m.timestamp,
      m.domain === 'siswa' ? 'Siswa' : 'GTK',
      m.direction,
      m.source,
      m.tahunPelajaran,
      m.nama,
      m.identityNumber,
      m.unitOrRole,
      m.statusLabel,
      m.note,
      m.actor,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([movHeaders, ...movRows]), 'Pelacakan Data');
  }

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

export function buildBackupFileName(scope: BackupBundlePayload['scope'], ext: 'json' | 'xlsx'): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `backup-siptu-sman9sby-${scope}-${stamp}.${ext}`;
}
