import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { recordDiagnostic } from '../diagnostics';

/** Wide enough for a two-column grid on a large phone, at 2× density. */
const THUMBNAIL_WIDTH = 320;

/**
 * A small JPEG preview of a photograph, made from the camera's file before
 * that file is ingested and deleted. Returns null when one cannot be made:
 * a preview is a convenience, never a reason to lose the photo.
 *
 * The manipulator writes its result to the cache directory, in plaintext.
 * The bytes are taken from its base64 output and the file is deleted at once;
 * the capture-cache sweep removes it after a crash in between.
 */
export async function makeThumbnail(uri: string): Promise<Uint8Array | null> {
  let outputUri: string | null = null;

  try {
    const context = ImageManipulator.manipulate(uri).resize({
      width: THUMBNAIL_WIDTH,
      height: null,
    });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
    outputUri = result.uri;

    return result.base64 ? base64ToBytes(result.base64) : null;
  } catch {
    return null;
  } finally {
    if (outputUri) {
      try {
        new File(outputUri).delete();
      } catch {
        await recordDiagnostic('plaintext_capture_retained');
      }
    }
  }
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  // In slices, so a large argument list never overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
