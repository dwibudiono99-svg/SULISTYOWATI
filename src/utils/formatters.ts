import { RequestStatus } from '../types/tu';

export function formatTanggalIndonesia(isoString: string, withTime = false): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;

  const datePart = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);

  if (!withTime) return datePart;

  const timePart = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  return `${datePart}, ${timePart} WIB`;
}

export function formatTanggalSuratResmi(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getStatusMeta(status: RequestStatus): {
  textClass: string;
  surfaceClass: string;
  label: string;
  stepIndex: number;
} {
  switch (status) {
    case 'Diajukan':
      return {
        textClass: 'text-slate-700',
        surfaceClass: 'bg-slate-100',
        label: 'Diajukan',
        stepIndex: 1,
      };
    case 'Verifikasi Berkas':
      return {
        textClass: 'text-blue-700',
        surfaceClass: 'bg-blue-50',
        label: 'Verifikasi Berkas',
        stepIndex: 2,
      };
    case 'Proses Pengetikan':
      return {
        textClass: 'text-indigo-700',
        surfaceClass: 'bg-indigo-50',
        label: 'Proses Pengetikan',
        stepIndex: 3,
      };
    case 'Menunggu TTD Kepala Sekolah':
      return {
        textClass: 'text-amber-700',
        surfaceClass: 'bg-amber-50',
        label: 'Menunggu TTD Kepala Sekolah',
        stepIndex: 4,
      };
    case 'Siap Diambil':
      return {
        textClass: 'text-emerald-700',
        surfaceClass: 'bg-emerald-50',
        label: 'Siap Diambil',
        stepIndex: 5,
      };
    case 'Selesai':
      return {
        textClass: 'text-emerald-800',
        surfaceClass: 'bg-emerald-50',
        label: 'Selesai',
        stepIndex: 6,
      };
    case 'Perlu Perbaikan':
      return {
        textClass: 'text-red-700',
        surfaceClass: 'bg-red-50',
        label: 'Perlu Perbaikan',
        stepIndex: 0,
      };
  }
}

export function generateTicketCode(existingCount: number): string {
  const num = 1 + existingCount;
  return `TU-2026-${String(num).padStart(4, '0')}`;
}

export function generateOfficialLetterNumber(sequenceOffset: number): string {
  const seq = 124 + sequenceOffset;
  return `421.3/${seq}/101.6.1.9/2026`;
}
