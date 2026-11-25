import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileEdit,
  Inbox,
  Stamp,
} from 'lucide-react';
import { RequestStatus } from '../types/tu';
import { getStatusMeta } from '../utils/formatters';

interface StatusIndicatorProps {
  status: RequestStatus;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const meta = getStatusMeta(status);

  const renderIcon = () => {
    switch (status) {
      case 'Diajukan':
        return <Inbox className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      case 'Verifikasi Berkas':
        return <FileCheck2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      case 'Proses Pengetikan':
        return <FileEdit className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      case 'Menunggu TTD Kepala Sekolah':
        return <Stamp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      case 'Siap Diambil':
        return <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      case 'Selesai':
        return <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      case 'Perlu Perbaikan':
        return <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${meta.textClass}`}>
      {renderIcon()}
      <span>{meta.label}</span>
    </span>
  );
}
