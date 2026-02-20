

## Compress Driver Images Before Upload

### Problem
When drivers take photos of loads or scan BOL/POD documents, the images are uploaded at full camera resolution (often 12-50 megapixels, 5-15MB each). This makes downloads very slow and wastes storage.

### Solution
Create a shared image compression utility that resizes images to a maximum dimension (e.g., 1600px) and compresses them as JPEG at 80% quality before uploading. This typically reduces file sizes from 5-15MB down to 200-500KB while maintaining perfectly readable document quality.

### Changes

**1. New utility: `src/lib/imageCompression.ts`**
- A `compressImage(file: File | Blob, options?)` function that:
  - Loads the image onto a canvas
  - Resizes to max 1600px on the longest side (preserving aspect ratio)
  - Exports as JPEG at 0.80 quality
  - Returns a compressed `Blob`
  - Skips PDFs (passes them through unchanged)
- A `compressDataUrl(dataUrl: string, options?)` variant for the scanner flow

**2. Update `src/components/driver-app/StopCard.tsx`**
- In `handleFileUpload`: compress each image file before uploading to storage
- PDFs are left untouched
- Change the uploaded file extension to `.jpg` for compressed images

**3. Update `src/components/driver-app/DocumentScanner.tsx`**
- In `enhanceImage`: reduce output quality from 0.92 to 0.80
- In `handleUploadAll`: resize the final image to max 1600px before creating the blob
- This applies to both enhanced and original images

**4. Update `src/hooks/usePodDocuments.ts`**
- In `uploadPod`: compress image files before uploading (this hook is used by the Loads page POD upload dialog)

### Technical Details

The compression function will look like:

```text
compressImage(file, { maxDimension: 1600, quality: 0.80 })
  -> Load into Image element
  -> Draw onto Canvas at reduced size
  -> canvas.toBlob('image/jpeg', 0.80)
  -> Return compressed Blob (~200-500KB)
```

Expected size reduction:
- Phone photo (12MP, ~5MB) -> ~300KB
- Phone photo (50MP, ~15MB) -> ~500KB
- Scanned document page -> ~150-300KB

Quality at 1600px width is more than sufficient for reading text on BOL/POD documents.
