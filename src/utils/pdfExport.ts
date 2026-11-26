import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SCHOOL_INFO } from '../config/schoolConfig';
import type { AgendaEntry, KopSuratConfig, ServiceRequest } from '../types/tu';
import { formatTanggalIndonesia, formatTanggalSuratResmi } from './formatters';

interface LoadedImageInfo {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
}

async function loadImageForPdf(src?: string): Promise<LoadedImageInfo | null> {
  if (!src || !src.trim()) return null;
  try {
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Image load timeout')), 4000);
      img.onload = () => {
        window.clearTimeout(timer);
        resolve();
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('Image load error'));
      };
      img.src = src;
    });

    const naturalW = img.naturalWidth || 100;
    const naturalH = img.naturalHeight || 100;
    const canvas = document.createElement('canvas');
    canvas.width = naturalW;
    canvas.height = naturalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const pngDataUrl = canvas.toDataURL('image/png');
    return {
      dataUrl: pngDataUrl,
      format: 'PNG',
      width: naturalW,
      height: naturalH,
    };
  } catch {
    return null;
  }
}

async function drawKopSurat(doc: jsPDF, kopSurat: KopSuratConfig): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2;

  if (!kopSurat.showKopSurat) {
    // Ruang kosong untuk kertas kop fisik sekolah
    return 40;
  }

  if (kopSurat.mode === 'upload-banner' && kopSurat.bannerImageDataUrl) {
    const banner = await loadImageForPdf(kopSurat.bannerImageDataUrl);
    if (banner) {
      const ratio = banner.height / Math.max(1, banner.width);
      const targetW = contentWidth;
      const targetH = Math.min(42, targetW * ratio);
      doc.addImage(banner.dataUrl, banner.format, marginX, 12, targetW, targetH);
      return 12 + targetH + 6;
    }
  }

  const leftLogo = await loadImageForPdf(kopSurat.leftLogoDataUrl);
  const rightLogo = await loadImageForPdf(kopSurat.rightLogoDataUrl);

  const logoSize = 20;
  const startY = 13;

  if (leftLogo) {
    const ratio = leftLogo.width / Math.max(1, leftLogo.height);
    const drawH = logoSize;
    const drawW = Math.min(22, drawH * ratio);
    doc.addImage(leftLogo.dataUrl, leftLogo.format, marginX, startY, drawW, drawH);
  }

  if (rightLogo) {
    const ratio = rightLogo.width / Math.max(1, rightLogo.height);
    const drawH = logoSize;
    const drawW = Math.min(22, drawH * ratio);
    doc.addImage(rightLogo.dataUrl, rightLogo.format, pageWidth - marginX - drawW, startY, drawW, drawH);
  }

  const centerX = pageWidth / 2;
  let y = startY + 4;

  doc.setTextColor(15, 23, 42);
  if (kopSurat.provinceLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(kopSurat.provinceLine, centerX, y, { align: 'center' });
    y += 4.5;
  }

  if (kopSurat.departmentLine) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(kopSurat.departmentLine, centerX, y, { align: 'center' });
    y += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.text(kopSurat.schoolNameLine || SCHOOL_INFO.name, centerX, y, { align: 'center' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  if (kopSurat.addressLine) {
    doc.text(kopSurat.addressLine, centerX, y, { align: 'center', maxWidth: contentWidth - 44 });
    y += 3.8;
  }
  if (kopSurat.contactLine) {
    doc.text(kopSurat.contactLine, centerX, y, { align: 'center', maxWidth: contentWidth - 44 });
    y += 3.8;
  }
  if (kopSurat.websiteLine) {
    doc.text(kopSurat.websiteLine, centerX, y, { align: 'center', maxWidth: contentWidth - 44 });
    y += 3.8;
  }

  const lineY = Math.max(startY + logoSize + 3, y + 1);
  doc.setDrawColor(15, 23, 42);
  if (kopSurat.dividerStyle === 'double') {
    doc.setLineWidth(0.6);
    doc.line(marginX, lineY, pageWidth - marginX, lineY);
    doc.setLineWidth(0.3);
    doc.line(marginX, lineY + 1.2, pageWidth - marginX, lineY + 1.2);
  } else if (kopSurat.dividerStyle === 'thick-thin') {
    doc.setLineWidth(0.9);
    doc.line(marginX, lineY, pageWidth - marginX, lineY);
    doc.setLineWidth(0.25);
    doc.line(marginX, lineY + 1.2, pageWidth - marginX, lineY + 1.2);
  } else {
    doc.setLineWidth(0.45);
    doc.line(marginX, lineY, pageWidth - marginX, lineY);
  }

  return lineY + 8;
}

export async function downloadOfficialLetterPdf(params: {
  request: ServiceRequest;
  kopSurat: KopSuratConfig;
  principalName: string;
  principalNip: string;
}): Promise<void> {
  const { request, kopSurat, principalName, principalNip } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 20;
  const maxWidth = pageWidth - marginX * 2;

  let y = await drawKopSurat(doc, kopSurat);

  const letterTitle =
    request.serviceId === 'surat-tugas'
      ? 'SURAT TUGAS'
      : request.serviceId === 'izin-kegiatan'
        ? 'SURAT DISPENSASI KEGIATAN'
        : request.serviceId === 'rekomendasi'
          ? 'SURAT REKOMENDASI'
          : 'SURAT KETERANGAN';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(letterTitle, pageWidth / 2, y, { align: 'center' });
  const titleW = doc.getTextWidth(letterTitle);
  doc.setLineWidth(0.35);
  doc.line(pageWidth / 2 - titleW / 2, y + 1, pageWidth / 2 + titleW / 2, y + 1);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Nomor : ${request.letterNumber || '421.3/___/101.6.1.9/2026'}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 10;

  const groupParticipants =
    Array.isArray(request.participants) && request.participants.length > 1
      ? request.participants
      : null;

  doc.setFontSize(10.5);
  const intro = groupParticipants
    ? request.serviceId === 'surat-tugas'
      ? 'Yang bertanda tangan di bawah ini Kepala SMA Negeri 9 Surabaya, Kota Surabaya, Provinsi Jawa Timur menugaskan kepada nama-nama tersebut di bawah ini :'
      : request.serviceId === 'izin-kegiatan'
        ? 'Yang bertanda tangan di bawah ini Kepala SMA Negeri 9 Surabaya, Kota Surabaya, Provinsi Jawa Timur memberikan izin / dispensasi kegiatan kepada peserta didik dan/atau pembina berikut :'
        : request.serviceId === 'rekomendasi'
          ? 'Yang bertanda tangan di bawah ini Kepala SMA Negeri 9 Surabaya, Kota Surabaya, Provinsi Jawa Timur memberikan rekomendasi untuk mengikuti kegiatan kepada nama-nama berikut :'
          : 'Yang bertanda tangan di bawah ini Kepala SMA Negeri 9 Surabaya, Kota Surabaya, Provinsi Jawa Timur menerangkan dengan sesungguhnya bahwa nama-nama berikut :'
    : 'Yang bertanda tangan di bawah ini Kepala SMA Negeri 9 Surabaya, Kota Surabaya, Provinsi Jawa Timur menerangkan dengan sesungguhnya bahwa :';
  const introLines = doc.splitTextToSize(intro, maxWidth) as string[];
  doc.text(introLines, marginX, y);
  y += introLines.length * 5.2 + 4;

  if (groupParticipants) {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5, textColor: [15, 23, 42], lineColor: [30, 41, 59], lineWidth: 0.2 },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 34 },
        3: { cellWidth: 32 },
        4: { cellWidth: 30 },
      },
      head: [['No', 'Nama Lengkap', 'NISN / NIS / NIP', 'Kelas / Jabatan', 'Keterangan']],
      body: groupParticipants.map((p, idx) => [
        String(idx + 1),
        p.nama || '-',
        p.identityNumber || '-',
        p.classOrCohort || '-',
        p.roleLabel || 'Peserta',
      ]),
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 25) + 6;
  } else {
    const rows: [string, string][] = [
      ['Nama Lengkap', request.applicantName || '-'],
      [
        request.applicantRole === 'Guru / Tendik' ? 'NIP / NUPTK' : 'NISN / NIS',
        request.identityNumber || '-',
      ],
      ['Status / Kelas / Unit', `${request.applicantRole} — ${request.classOrCohort || '-'}`],
      ['Instansi / Sekolah', 'SMA Negeri 9 Surabaya'],
    ];

    for (const [label, value] of rows) {
      doc.setFont('helvetica', 'normal');
      doc.text(label, marginX + 4, y);
      doc.text(':', marginX + 52, y);
      doc.setFont('helvetica', label === 'Nama Lengkap' ? 'bold' : 'normal');
      const valLines = doc.splitTextToSize(value, maxWidth - 58) as string[];
      doc.text(valLines, marginX + 56, y);
      y += Math.max(1, valLines.length) * 5.2 + 1;
    }
    y += 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const body1 = groupParticipants
    ? `Berdasarkan data administrasi Tata Usaha SMA Negeri 9 Surabaya, nama-nama tersebut di atas (${groupParticipants.length} orang) secara resmi tercatat dan diterbitkan surat ${request.serviceTitle} untuk keperluan/kegiatan: ${request.purpose}.`
    : `Berdasarkan data pokok administrasi Tata Usaha SMA Negeri 9 Surabaya, yang bersangkutan tercatat secara resmi dan permohonan layanan ${request.serviceTitle} ini diterbitkan untuk keperluan: ${request.purpose}.`;
  const body1Lines = doc.splitTextToSize(body1, maxWidth) as string[];
  if (y + body1Lines.length * 5.2 > 265) {
    doc.addPage();
    y = 20;
  }
  doc.text(body1Lines, marginX, y);
  y += body1Lines.length * 5.2 + 4;

  const body2 = groupParticipants
    ? 'Demikian surat ini dibuat dengan sebenarnya agar dapat dilaksanakan penuh tanggung jawab dan dipergunakan sebagaimana mestinya.'
    : 'Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.';
  const body2Lines = doc.splitTextToSize(body2, maxWidth) as string[];
  doc.text(body2Lines, marginX, y);
  y += body2Lines.length * 5.2 + 12;

  if (y > 245) {
    doc.addPage();
    y = 24;
  }

  const signX = pageWidth - marginX - 65;
  doc.text(
    `${kopSurat.cityName || 'Surabaya'}, ${formatTanggalSuratResmi(request.updatedAt || new Date().toISOString())}`,
    signX,
    y
  );
  y += 5;
  doc.text(kopSurat.principalTitle || 'Kepala Sekolah,', signX, y);
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.text(principalName || kopSurat.principalName, signX, y);
  const nameW = doc.getTextWidth(principalName || kopSurat.principalName);
  doc.line(signX, y + 0.8, signX + nameW, y + 0.8);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`NIP. ${principalNip || kopSurat.principalNip}`, signX, y);

  doc.save(`Surat_${request.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}

export async function downloadReceiptPdf(params: {
  request: ServiceRequest;
  kopSurat: KopSuratConfig;
}): Promise<void> {
  const { request, kopSurat } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 20;

  let y = await drawKopSurat(doc, kopSurat);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TANDA TERIMA PELAYANAN TATA USAHA', pageWidth / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Kode Tiket : ${request.id}`, pageWidth / 2, y, { align: 'center' });
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 3, textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: 'bold', fillColor: [248, 250, 252] },
    },
    body: [
      [
        'Nama Pemohon',
        Array.isArray(request.participants) && request.participants.length > 1
          ? `${request.applicantName || '-'} dkk (${request.participants.length} peserta)`
          : request.applicantName || '-',
      ],
      ['NISN / NIS / NIP', request.identityNumber || '-'],
      ['Jenis Layanan', request.serviceTitle || '-'],
      ['Status Saat Ini', request.status || '-'],
      ['Tanggal Pengajuan', formatTanggalIndonesia(request.createdAt, true)],
      ['Estimasi Selesai', formatTanggalIndonesia(request.estimatedReadyAt)],
      ['Keperluan', request.purpose || '-'],
    ],
  });

  const tableEndY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 60;
  y = tableEndY + 7;

  if (Array.isArray(request.participants) && request.participants.length > 1) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`Daftar Peserta Tercatat (${request.participants.length} Orang):`, marginX, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2, textColor: [15, 23, 42] },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
      head: [['No', 'Nama Lengkap', 'NISN / NIP', 'Kelas / Jabatan', 'Peran']],
      body: request.participants.map((p, idx) => [
        String(idx + 1),
        p.nama || '-',
        p.identityNumber || '-',
        p.classOrCohort || '-',
        p.roleLabel || 'Peserta',
      ]),
    });

    y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 25) + 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Berkas Persyaratan yang Tercatat:', marginX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const reqs =
    Array.isArray(request.submittedRequirements) && request.submittedRequirements.length > 0
      ? request.submittedRequirements
      : ['Verifikasi berkas fisik dilakukan langsung di Loket 1 Tata Usaha.'];

  for (const item of reqs) {
    const lines = doc.splitTextToSize(`• ${item}`, pageWidth - marginX * 2) as string[];
    doc.text(lines, marginX + 2, y);
    y += lines.length * 4.5 + 1;
  }

  y += 10;
  const signX = pageWidth - marginX - 58;
  doc.setFontSize(9.5);
  doc.text(
    `${kopSurat.cityName || 'Surabaya'}, ${formatTanggalSuratResmi(request.createdAt || new Date().toISOString())}`,
    signX,
    y
  );
  doc.text('Petugas Loket TU,', signX, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(request.assignedStaff || SCHOOL_INFO.staffName, signX, y + 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Lacak online: ${SCHOOL_INFO.publicPortalUrl}`,
    marginX,
    y + 23,
    { maxWidth: pageWidth - marginX * 2 - 64 }
  );

  doc.save(`Tanda_Terima_${request.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}

export async function downloadRekapLaporanPdf(params: {
  requests: ServiceRequest[];
  agendaEntries: AgendaEntry[];
  kopSurat: KopSuratConfig;
  periodLabel: string;
  principalName: string;
  principalNip: string;
}): Promise<void> {
  const { requests, agendaEntries, kopSurat, periodLabel, principalName, principalNip } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 16;

  let y = await drawKopSurat(doc, kopSurat);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('LAPORAN REKAPITULASI PELAYANAN & AGENDA TATA USAHA', pageWidth / 2, y, {
    align: 'center',
  });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Periode: ${periodLabel} · Dicetak: ${formatTanggalSuratResmi(new Date().toISOString())}`, pageWidth / 2, y, {
    align: 'center',
  });
  y += 8;

  const total = requests.length;
  const inProcess = requests.filter(
    (r) =>
      r.status === 'Diajukan' ||
      r.status === 'Verifikasi Berkas' ||
      r.status === 'Proses Pengetikan' ||
      r.status === 'Menunggu TTD Kepala Sekolah'
  ).length;
  const done = requests.filter((r) => r.status === 'Siap Diambil' || r.status === 'Selesai').length;
  const revision = requests.filter((r) => r.status === 'Perlu Perbaikan').length;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: { fontSize: 8.8, cellPadding: 2.5, halign: 'center', textColor: [15, 23, 42] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    head: [['Total Permohonan', 'Dalam Proses / TTD', 'Siap / Selesai', 'Perlu Perbaikan', 'Total Agenda TU']],
    body: [[String(total), String(inProcess), String(done), String(revision), String(agendaEntries.length)]],
  });

  y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 18) + 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('A. Rekapitulasi Permohonan Layanan Administrasi', marginX, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['Kode Tiket', 'Pemohon', 'Layanan', 'No. Surat', 'Status', 'Tanggal']],
    body:
      requests.length > 0
        ? requests.map((r) => [
            r.id,
            Array.isArray(r.participants) && r.participants.length > 1
              ? `${r.applicantName} dkk (${r.participants.length} peserta)`
              : `${r.applicantName} (${r.classOrCohort || r.applicantRole})`,
            r.serviceTitle,
            r.letterNumber || '-',
            r.status,
            formatTanggalIndonesia(r.createdAt),
          ])
        : [['-', 'Belum ada permohonan pada periode ini.', '-', '-', '-', '-']],
  });

  y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 30) + 8;

  if (y > 235) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('B. Rekapitulasi Buku Agenda Surat Masuk & Keluar', marginX, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['No. Agenda', 'Jenis', 'No. Surat', 'Asal / Tujuan', 'Perihal', 'Tanggal']],
    body:
      agendaEntries.length > 0
        ? agendaEntries.map((a) => [
            a.agendaNumber,
            a.type,
            a.letterNumber,
            a.counterparty,
            a.subject,
            formatTanggalIndonesia(a.letterDate),
          ])
        : [['-', '-', '-', 'Belum ada data agenda pada periode ini.', '-', '-']],
  });

  let signY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 30) + 12;
  if (signY > 250) {
    doc.addPage();
    signY = 24;
  }

  const signX = pageWidth - marginX - 64;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `${kopSurat.cityName || 'Surabaya'}, ${formatTanggalSuratResmi(new Date().toISOString())}`,
    signX,
    signY
  );
  doc.text(kopSurat.principalTitle || 'Kepala Sekolah,', signX, signY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(principalName || kopSurat.principalName, signX, signY + 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`NIP. ${principalNip || kopSurat.principalNip}`, signX, signY + 28.5);

  doc.setFontSize(9.5);
  doc.text('Mengetahui,', marginX, signY);
  doc.text('Koordinator Tata Usaha,', marginX, signY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(SCHOOL_INFO.staffName, marginX, signY + 24);

  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Laporan_Pelayanan_TU_SMAN9_${safePeriod}.pdf`);
}
