export const MEDIA_LIMITS = { image: 5, video: 16, audio: 16, document: 100 } as const;

const mimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
  avif: 'image/avif', tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', csv: 'text/csv', zip: 'application/zip', mp4: 'video/mp4',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', webm: 'audio/webm', m4a: 'audio/mp4',
};

export function getMediaType(file: Pick<File, 'name' | 'type'>) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = mimeByExtension[ext] || file.type || 'application/octet-stream';
  const kind: keyof typeof MEDIA_LIMITS = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'document';
  return { mime, kind };
}

export function validateMediaSize(kind: keyof typeof MEDIA_LIMITS, size: number) {
  if (size === 0) throw new Error('O arquivo está vazio.');
  if (size > MEDIA_LIMITS[kind] * 1024 * 1024) {
    throw new Error(`O WhatsApp aceita ${kind === 'image' ? 'fotos' : kind === 'document' ? 'documentos' : kind === 'video' ? 'vídeos' : 'áudios'} de até ${MEDIA_LIMITS[kind]}MB.`);
  }
}

export async function prepareChatFile(file: File): Promise<File> {
  const { mime, kind } = getMediaType(file);
  // Images are compressed before applying Meta's 5MB limit.
  validateMediaSize(kind === 'image' ? 'document' : kind, file.size);
  if (kind !== 'image' || (['image/jpeg', 'image/png'].includes(mime) && file.size <= 5 * 1024 * 1024)) {
    return new File([file], file.name, { type: mime });
  }
  let source: Blob = file;
  if (['image/heic', 'image/heif'].includes(mime)) {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    source = Array.isArray(converted) ? converted[0] : converted;
  }
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error('Não foi possível converter esta foto. Envie uma versão JPG ou PNG.'); });
    const ratio = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a foto.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível converter a foto.')), 'image/jpeg', 0.85));
    validateMediaSize('image', blob.size);
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally { URL.revokeObjectURL(url); }
}