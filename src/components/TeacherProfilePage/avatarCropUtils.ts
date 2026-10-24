import { t } from '../../i18n/translate';
export const MAX_AVATAR_BLOB_BYTES = 2 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 256;

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(t('La imagen no es válida.')));
    image.src = src;
  });
}

// Renders the user's crop/zoom selection onto a fixed-size square canvas and re-encodes
// it as JPEG, stepping down quality until it fits the upload budget.
export async function cropToBudgetedBlob(imageSrc: string, crop: PixelCrop): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const outputSize = Math.min(AVATAR_OUTPUT_SIZE, Math.round(crop.width));
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  canvas.getContext('2d')!.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, outputSize, outputSize);
  for (const quality of [0.82, 0.7, 0.58]) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob && blob.size <= MAX_AVATAR_BLOB_BYTES) return blob;
  }
  throw new Error(t('La imagen sigue siendo demasiado grande después de comprimirla.'));
}
