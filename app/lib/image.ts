import type { EncodeOptions } from "@jsquash/avif/meta";

const AVIF_MIME = "image/avif";
const AVIF_UNSUPPORTED = "AVIF_UNSUPPORTED";

type AvifOptions = Partial<EncodeOptions>;

function toAvifFilename(name: string) {
  if (!name) return "upload.avif";
  return name.replace(/\.[^/.]+$/, "") + ".avif";
}

async function loadImageElement(file: File) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  if ("decode" in img) {
    try {
      await img.decode();
    } catch {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image decode failed"));
      });
    }
  } else {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image decode failed"));
    });
  }
  return { img, revoke: () => URL.revokeObjectURL(url) };
}

async function getImageData(file: File) {
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

  const cleanup = () => {
    if (bitmap && "close" in bitmap) bitmap.close();
    if (revoke) revoke();
  };

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.imageSmoothingQuality = "high";
    if (bitmap) {
      ctx.drawImage(bitmap, 0, 0, width, height);
    } else if (img) {
      ctx.drawImage(img, 0, 0, width, height);
    }
    return ctx.getImageData(0, 0, width, height);
  } finally {
    cleanup();
  }
}

export async function compressImageToAvif(file: File, options: AvifOptions = {}) {
  if (file.type === AVIF_MIME) return file;
  if (typeof document === "undefined") {
    throw new Error(AVIF_UNSUPPORTED);
  }

  const imageData = await getImageData(file);
  if (!imageData) {
    throw new Error(AVIF_UNSUPPORTED);
  }

  try {
    const { encode } = await import("@jsquash/avif");
    const encoded = await encode(imageData, options);
    return new File([encoded], toAvifFilename(file.name), {
      type: AVIF_MIME,
      lastModified: file.lastModified
    });
  } catch (err) {
    throw new Error(AVIF_UNSUPPORTED);
  }
}

export async function compressImagesToAvif(files: File[], options: AvifOptions = {}) {
  const results: File[] = [];
  for (const file of files) {
    results.push(await compressImageToAvif(file, options));
  }
  return results;
}

export { AVIF_UNSUPPORTED };
