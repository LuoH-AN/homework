const OUTPUT_MIME = "image/jpeg";
const DEFAULT_QUALITY = 0.82;
const COMPRESS_UNSUPPORTED = "IMAGE_COMPRESS_UNSUPPORTED";

type JpegOptions = {
  quality?: number;
};

function clampQuality(value: number) {
  if (Number.isNaN(value)) return DEFAULT_QUALITY;
  return Math.min(1, Math.max(0, value));
}

function toJpegFilename(name: string) {
  if (!name) return "upload.jpg";
  return name.replace(/\.[^/.]+$/, "") + ".jpg";
}

async function loadImageElement(file: File) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  try {
    await img.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image decode failed"));
    });
  }
  return { img, revoke: () => URL.revokeObjectURL(url) };
}

async function drawToCanvas(file: File) {
  let bitmap: ImageBitmap | null = null;
  let revoke: (() => void) | null = null;
  let img: HTMLImageElement | null = null;

  try {
    if (typeof createImageBitmap === "function") {
      try {
        bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image"
        } as ImageBitmapOptions);
      } catch {
        bitmap = await createImageBitmap(file);
      }
    }
  } catch {
    bitmap = null;
  }

  if (!bitmap) {
    try {
      const loaded = await loadImageElement(file);
      img = loaded.img;
      revoke = loaded.revoke;
    } catch {
      return null;
    }
  }

  const width = bitmap?.width ?? img?.naturalWidth ?? 0;
  const height = bitmap?.height ?? img?.naturalHeight ?? 0;
  if (!width || !height) {
    if (bitmap && "close" in bitmap) bitmap.close();
    if (revoke) revoke();
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (bitmap && "close" in bitmap) bitmap.close();
    if (revoke) revoke();
    return null;
  }
  ctx.imageSmoothingQuality = "high";
  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0, width, height);
  } else if (img) {
    ctx.drawImage(img, 0, 0, width, height);
  }

  return {
    canvas,
    cleanup: () => {
      if (bitmap && "close" in bitmap) bitmap.close();
      if (revoke) revoke();
    }
  };
}

export async function compressImageToJpeg(file: File, options: JpegOptions = {}) {
  if (typeof document === "undefined") {
    throw new Error(COMPRESS_UNSUPPORTED);
  }

  const quality = clampQuality(options.quality ?? DEFAULT_QUALITY);
  const prepared = await drawToCanvas(file);
  if (!prepared) {
    throw new Error(COMPRESS_UNSUPPORTED);
  }

  const { canvas, cleanup } = prepared;
  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), OUTPUT_MIME, quality)
    );
    if (!blob) {
      throw new Error(COMPRESS_UNSUPPORTED);
    }
    return new File([blob], toJpegFilename(file.name), {
      type: OUTPUT_MIME,
      lastModified: file.lastModified
    });
  } finally {
    cleanup();
  }
}

export async function compressImagesToJpeg(files: File[], options: JpegOptions = {}) {
  const results: File[] = [];
  for (const file of files) {
    results.push(await compressImageToJpeg(file, options));
  }
  return results;
}

export { COMPRESS_UNSUPPORTED };
