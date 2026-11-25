const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_INPUT_BYTES = 5 * 1024 * 1024;

export async function processPtkPhotoFile(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Format foto tidak didukung. Gunakan berkas JPG, PNG, atau WEBP.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Ukuran file foto melebihi batas 5 MB.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Gagal membaca berkas foto.'));
    reader.readAsDataURL(file);
  });

  if (!rawDataUrl.startsWith('data:image/')) {
    throw new Error('Isi berkas foto tidak valid.');
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Gambar foto tidak dapat dimuat.'));
    el.src = rawDataUrl;
  });

  const maxSide = 420;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || maxSide, img.naturalHeight || maxSide));
  const targetW = Math.max(1, Math.round((img.naturalWidth || maxSide) * scale));
  const targetH = Math.max(1, Math.round((img.naturalHeight || maxSide) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawDataUrl;

  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', 0.86);
}
