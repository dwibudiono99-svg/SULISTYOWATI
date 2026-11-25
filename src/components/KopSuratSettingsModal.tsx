import { AlertCircle, ImagePlus, RotateCcw, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { DEFAULT_KOP_SURAT_CONFIG } from '../config/schoolConfig';
import { KopDividerStyle, KopSuratConfig, KopSuratMode } from '../types/tu';

interface KopSuratSettingsModalProps {
  open: boolean;
  config: KopSuratConfig;
  onClose: () => void;
  onSave: (nextConfig: KopSuratConfig) => Promise<boolean>;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function readRasterImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      reject(new Error('Format berkas tidak didukung. Gunakan PNG, JPG, atau WEBP.'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error('Ukuran gambar melebihi batas maksimal 2 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(result)) {
        reject(new Error('Berkas gambar tidak valid.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.readAsDataURL(file);
  });
}

export function KopSuratSettingsModal({
  open,
  config,
  onClose,
  onSave,
}: KopSuratSettingsModalProps) {
  const [draft, setDraft] = useState<KopSuratConfig>(config);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);

  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const leftLogoInputRef = useRef<HTMLInputElement | null>(null);
  const rightLogoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(config);
      setErrorMsg(null);
      setSaving(false);
    }
  }, [config, open]);

  if (!open) return null;

  const handleModeChange = (mode: KopSuratMode) => {
    setErrorMsg(null);
    setDraft((prev) => ({ ...prev, mode }));
  };

  const handleUploadImage = async (
    file: File | undefined,
    field: 'bannerImageDataUrl' | 'leftLogoDataUrl' | 'rightLogoDataUrl'
  ) => {
    if (!file) return;
    setErrorMsg(null);
    try {
      const dataUrl = await readRasterImageFile(file);
      setDraft((prev) => ({ ...prev, [field]: dataUrl }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat berkas gambar.');
    }
  };

  const handleFileInputChange = (
    e: ChangeEvent<HTMLInputElement>,
    field: 'bannerImageDataUrl' | 'leftLogoDataUrl' | 'rightLogoDataUrl'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    void handleUploadImage(file, field);
  };

  const handleBannerDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingBanner(false);
    const file = e.dataTransfer.files?.[0];
    void handleUploadImage(file, 'bannerImageDataUrl');
  };

  const handleResetDefault = () => {
    setErrorMsg(null);
    setDraft(DEFAULT_KOP_SURAT_CONFIG);
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (draft.mode === 'upload-banner' && !draft.bannerImageDataUrl) {
      setErrorMsg('Unggah gambar berkas Kop Surat terlebih dahulu sebelum menyimpan.');
      return;
    }
    if (draft.mode === 'custom' && !draft.schoolNameLine.trim()) {
      setErrorMsg('Nama Instansi / Sekolah pada Kop Surat wajib diisi.');
      return;
    }
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) {
      onClose();
    }
  };

  const dividerClass =
    draft.dividerStyle === 'double'
      ? 'border-b-4 border-double border-slate-900'
      : draft.dividerStyle === 'thick-thin'
        ? 'border-b-[3px] border-slate-900'
        : 'border-b border-slate-900';

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kop-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="kop-modal-title" className="text-base font-semibold text-slate-900">
              Pengaturan Kop Surat Sekolah
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Pilih unggah gambar Kop Surat siap pakai atau atur teks, logo, dan garis pemisah sendiri.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup pengaturan Kop Surat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Modal */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Switcher Mode */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleModeChange('custom')}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition ${
                draft.mode === 'custom'
                  ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <SlidersHorizontal
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  draft.mode === 'custom' ? 'text-blue-700' : 'text-slate-500'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Setting Kop Sendiri (Teks & Logo)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Susun baris teks instansi, unggah logo kiri/kanan, dan pilih gaya garis bawah.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('upload-banner')}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition ${
                draft.mode === 'upload-banner'
                  ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <Upload
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  draft.mode === 'upload-banner' ? 'text-blue-700' : 'text-slate-500'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Upload Berkas Kop Utuh
                </p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Unggah file gambar Kop Surat resmi siap cetak (PNG, JPG, atau WEBP maks. 2 MB).
                </p>
              </div>
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Live Preview */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Pratinjau Kop Surat pada Lembar A4
            </p>
            <div className="rounded-md border border-slate-200 bg-white px-5 py-4 text-slate-900">
              {draft.mode === 'upload-banner' ? (
                draft.bannerImageDataUrl ? (
                  <img
                    src={draft.bannerImageDataUrl}
                    alt="Pratinjau berkas Kop Surat"
                    className="mx-auto max-h-36 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
                    Belum ada gambar berkas Kop Surat yang diunggah.
                  </div>
                )
              ) : (
                <div className={`${dividerClass} pb-3 text-center`}>
                  <div className="flex items-center justify-center gap-4">
                    {draft.leftLogoDataUrl ? (
                      <img
                        src={draft.leftLogoDataUrl}
                        alt="Logo kiri Kop Surat"
                        className="h-14 w-14 shrink-0 object-contain"
                      />
                    ) : (
                      <svg
                        viewBox="0 0 64 64"
                        className="h-14 w-14 shrink-0 text-slate-900"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M32 6L10 14v18c0 14.5 9.4 24.4 22 28 12.6-3.6 22-13.5 22-28V14L32 6z"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        />
                        <path
                          d="M22 27h20M22 34h20M26 20h12"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}

                    <div className="min-w-0 flex-1">
                      {draft.provinceLine && (
                        <p className="text-[11px] font-semibold tracking-wider text-slate-800">
                          {draft.provinceLine}
                        </p>
                      )}
                      {draft.departmentLine && (
                        <p className="text-xs font-bold tracking-wide text-slate-900">
                          {draft.departmentLine}
                        </p>
                      )}
                      <p className="mt-0.5 text-base font-bold tracking-tight text-slate-950">
                        {draft.schoolNameLine || 'NAMA SEKOLAH / INSTANSI'}
                      </p>
                      {draft.addressLine && (
                        <p className="mt-0.5 text-[11px] text-slate-700">{draft.addressLine}</p>
                      )}
                      {draft.contactLine && (
                        <p className="text-[11px] text-slate-700">{draft.contactLine}</p>
                      )}
                      {draft.websiteLine && (
                        <p className="text-[11px] text-slate-700">{draft.websiteLine}</p>
                      )}
                    </div>

                    {draft.rightLogoDataUrl ? (
                      <img
                        src={draft.rightLogoDataUrl}
                        alt="Logo kanan Kop Surat"
                        className="h-14 w-14 shrink-0 object-contain"
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Berdasarkan Mode */}
          {draft.mode === 'upload-banner' ? (
            <div className="space-y-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingBanner(true);
                }}
                onDragLeave={() => setIsDraggingBanner(false)}
                onDrop={handleBannerDrop}
                className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
                  isDraggingBanner
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 bg-slate-50/70'
                }`}
              >
                <Upload className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-slate-800">
                  Seret dan lepas gambar Kop Surat utuh di sini, atau pilih berkas dari komputer
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Disarankan rasio memanjang (contoh 1600×320 px). Format PNG, JPG, WEBP maksimal 2 MB.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{draft.bannerImageDataUrl ? 'Ganti Berkas Kop' : 'Pilih Berkas Kop'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        bannerImageDataUrl: '/assets/aistudio/image_53f155ea.png',
                      }))
                    }
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <span>Pakai Lampiran Kop SMAN 9</span>
                  </button>
                  {draft.bannerImageDataUrl && (
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, bannerImageDataUrl: '' }))}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                      <span>Hapus Gambar</span>
                    </button>
                  )}
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleFileInputChange(e, 'bannerImageDataUrl')}
                  className="sr-only"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Upload Logo Kiri & Kanan */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-800">
                      Logo Kiri (Pemprov / Sekolah)
                    </span>
                    <div className="flex items-center gap-2">
                      {draft.leftLogoDataUrl !== '/assets/logo-jatim-sman9.png' && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              leftLogoDataUrl: '/assets/logo-jatim-sman9.png',
                            }))
                          }
                          className="text-[11px] font-medium text-blue-700 hover:underline"
                        >
                          Pakai Logo Jatim
                        </button>
                      )}
                      {draft.leftLogoDataUrl && (
                        <button
                          type="button"
                          onClick={() => setDraft((prev) => ({ ...prev, leftLogoDataUrl: '' }))}
                          className="text-[11px] font-medium text-rose-600 hover:underline"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50">
                      {draft.leftLogoDataUrl ? (
                        <img
                          src={draft.leftLogoDataUrl}
                          alt="Logo kiri"
                          className="h-10 w-10 object-contain"
                        />
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">Default</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => leftLogoInputRef.current?.click()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Unggah Logo Kiri</span>
                    </button>
                    <input
                      ref={leftLogoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleFileInputChange(e, 'leftLogoDataUrl')}
                      className="sr-only"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-800">
                      Logo Kanan (Opsional)
                    </span>
                    {draft.rightLogoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, rightLogoDataUrl: '' }))}
                        className="text-[11px] font-medium text-rose-600 hover:underline"
                      >
                        Hapus Logo
                      </button>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50">
                      {draft.rightLogoDataUrl ? (
                        <img
                          src={draft.rightLogoDataUrl}
                          alt="Logo kanan"
                          className="h-10 w-10 object-contain"
                        />
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">Kosong</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => rightLogoInputRef.current?.click()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Unggah Logo Kanan</span>
                    </button>
                    <input
                      ref={rightLogoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleFileInputChange(e, 'rightLogoDataUrl')}
                      className="sr-only"
                    />
                  </div>
                </div>
              </div>

              {/* Input Baris Teks Kop */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="kop-province" className="block text-xs font-medium text-slate-700">
                    Baris 1 (Pemerintah Daerah / Yayasan)
                  </label>
                  <input
                    id="kop-province"
                    type="text"
                    value={draft.provinceLine}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, provinceLine: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="kop-dept" className="block text-xs font-medium text-slate-700">
                    Baris 2 (Dinas / Instansi Induk)
                  </label>
                  <input
                    id="kop-dept"
                    type="text"
                    value={draft.departmentLine}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, departmentLine: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="kop-school" className="block text-xs font-medium text-slate-700">
                    Baris 3 (Nama Sekolah)
                  </label>
                  <input
                    id="kop-school"
                    type="text"
                    value={draft.schoolNameLine}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, schoolNameLine: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="kop-divider" className="block text-xs font-medium text-slate-700">
                    Gaya Garis Bawah Kop
                  </label>
                  <select
                    id="kop-divider"
                    value={draft.dividerStyle}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        dividerStyle: e.target.value as KopDividerStyle,
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900"
                  >
                    <option value="double">Garis Ganda Resmi (Double)</option>
                    <option value="thick-thin">Garis Tebal</option>
                    <option value="single">Garis Tunggal Tipis</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="kop-address" className="block text-xs font-medium text-slate-700">
                    Baris 4 (Alamat Lengkap)
                  </label>
                  <input
                    id="kop-address"
                    type="text"
                    value={draft.addressLine}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, addressLine: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="kop-contact" className="block text-xs font-medium text-slate-700">
                    Baris 5 (Telepon & Faksimili)
                  </label>
                  <input
                    id="kop-contact"
                    type="text"
                    value={draft.contactLine}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, contactLine: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="kop-website" className="block text-xs font-medium text-slate-700">
                    Baris 6 (Laman, Surel & NPSN)
                  </label>
                  <input
                    id="kop-website"
                    type="text"
                    value={draft.websiteLine}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, websiteLine: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Pengaturan Default Blok Tanda Tangan */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-xs font-semibold text-slate-800">
              Blok Tanda Tangan & Kota Surat
            </h3>
            <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="kop-city" className="block text-xs font-medium text-slate-700">
                  Kota Penetapan Surat
                </label>
                <input
                  id="kop-city"
                  type="text"
                  value={draft.cityName}
                  onChange={(e) => setDraft((prev) => ({ ...prev, cityName: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="kop-title" className="block text-xs font-medium text-slate-700">
                  Jabatan Penandatangan
                </label>
                <input
                  id="kop-title"
                  type="text"
                  value={draft.principalTitle}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, principalTitle: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="kop-principal" className="block text-xs font-medium text-slate-700">
                  Nama Kepala Sekolah / Penandatangan
                </label>
                <input
                  id="kop-principal"
                  type="text"
                  value={draft.principalName}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, principalName: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="kop-nip" className="block text-xs font-medium text-slate-700">
                  NIP Penandatangan
                </label>
                <input
                  id="kop-nip"
                  type="text"
                  value={draft.principalNip}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, principalNip: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Bawaan SMAN 9</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="inline-flex h-9 items-center rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan Kop Surat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
