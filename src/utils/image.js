// Uploaded images are stored inside the site settings row, which every visitor
// downloads, so they are resized and re-encoded before saving.
const MAX_DATA_URL_LENGTH = 800_000; // ≈600 KB of image data

export async function imageFileToDataUrl(file, { maxWidth = 1600, quality = 0.82 } = {}) {
    if (!file?.type?.startsWith('image/')) {
        throw new Error('Please choose an image file.');
    }

    const bitmap = await createImageBitmap(file);
    let dataUrl;
    try {
        const scale = Math.min(1, maxWidth / bitmap.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/webp', quality);
        // Browsers without a WebP encoder return PNG, which is far larger for photos.
        if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', quality);
    } finally {
        bitmap.close();
    }

    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        throw new Error('This image is still too large after compression. Please use a smaller image or paste an image URL.');
    }
    return dataUrl;
}
