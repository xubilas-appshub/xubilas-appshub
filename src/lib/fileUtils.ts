import imageCompression from 'browser-image-compression';

/**
 * Resizes an image file to a specific dimension (square) while maintaining aspect ratio (center crop)
 */
export const resizeImage = (file: File, size: number = 512): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = size;
        canvas.height = size;

        // Calculate dimensions for center crop
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = img.width;
        let sourceHeight = img.height;

        if (img.width > img.height) {
          sourceWidth = img.height;
          sourceX = (img.width - img.height) / 2;
        } else {
          sourceHeight = img.width;
          sourceY = (img.height - img.width) / 2;
        }

        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight, // Source
          0, 0, size, size // Destination
        );

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob failed'));
            }
          },
          file.type === 'image/gif' ? 'image/gif' : 'image/png',
          0.9
        );
      };
      img.onerror = () => reject(new Error('Image load failed'));
    };
    reader.onerror = () => reject(new Error('File read failed'));
  });
};

/**
 * Compresses an image file with "extreme" settings for storage efficiency
 * @param file The image file to compress
 * @param isLogo If true, uses higher quality but smaller dimensions. If false (screenshot), uses lower quality but larger dimensions.
 */
export const compressImage = async (file: File, isLogo: boolean = false): Promise<File | Blob> => {
  const options = {
    maxSizeMB: isLogo ? 0.1 : 0.5, // 100KB for logos, 500KB for screenshots
    maxWidthOrHeight: isLogo ? 512 : 1920,
    useWebWorker: true,
    initialQuality: 0.6, // Start with 60% quality for extreme compression
    fileType: 'image/webp' // Convert to WEBP for better compression
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Compression failed, falling back to original:', error);
    return file;
  }
};

/**
 * General file compression utility. 
 * For images, it uses extreme compression.
 * For other files (like APKs), we return the original to prevent corruption.
 */
export const compressFile = async (file: File, type: 'logo' | 'screenshot' | 'apk'): Promise<File | Blob> => {
  if (type === 'logo' || type === 'screenshot') {
    return await compressImage(file, type === 'logo');
  }
  
  // APK compression is disabled to prevent "package appears to be invalid" errors
  return file;
};

/**
 * Downloads a file from a URL by fetching it as a blob first
 * This ensures the 'download' attribute and filename are respected
 */
export const downloadFileReliably = async (url: string, filename: string, onProgress?: (progress: number) => void) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Network response was not ok');

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body?.getReader();
  if (!reader) {
    // Fallback if streams aren't supported
    const originalBlob = await response.blob();
    const mimeType = filename.endsWith('.apk') ? 'application/vnd.android.package-archive' : originalBlob.type;
    const blob = new Blob([originalBlob], { type: mimeType });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
    return;
  }

  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total > 0 && onProgress) {
      onProgress(Math.round((loaded / total) * 100));
    }
  }

  const mimeType = filename.endsWith('.apk') ? 'application/vnd.android.package-archive' : undefined;
  const blob = new Blob(chunks, { type: mimeType });
  
  // Verify if the download seems complete
  if (total > 0 && loaded !== total) {
    console.warn(`Download size mismatch: expected ${total}, got ${loaded}`);
  }

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
};
