import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, fileStorage, isFirebaseConfigured } from '../config/firebase';
import { createId } from '../utils/ids';

export type AttachmentKind = 'avatars' | 'receipts' | 'settlement-proofs';
const CLOUD_MAX_BYTES = 5 * 1024 * 1024;
const OFFLINE_MAX_BYTES = 300 * 1024;
const PROFILE_PHOTO_MAX_BYTES = 28 * 1024;
const UPLOAD_TIMEOUT_MS = 20_000;

const asDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Unable to read the selected image.'));
  reader.readAsDataURL(file);
});

const uploadImageWithTimeout = async (path: string, file: File, ownerUid: string): Promise<string> => {
  if (!fileStorage) throw new Error('Cloud storage is unavailable.');
  const storageRef = ref(fileStorage, path);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { ownerUid },
  });

  let timeoutId: number | undefined;
  try {
    await Promise.race([
      uploadTask,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          uploadTask.cancel();
          reject(new Error('Image upload timed out. Please check your connection and try again.'));
        }, UPLOAD_TIMEOUT_MS);
      }),
    ]);
    return await getDownloadURL(storageRef);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
};

/** Downsizes profile photos before upload so mobile uploads remain quick and reliable. */
export const prepareProfilePhoto = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be used as profile pictures.');
  if (file.size > CLOUD_MAX_BYTES) throw new Error('Image must be 5 MB or smaller.');

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      const timeoutId = window.setTimeout(() => reject(new Error('Unable to read the selected image.')), 10_000);
      element.onload = () => {
        window.clearTimeout(timeoutId);
        resolve(element);
      };
      element.onerror = () => {
        window.clearTimeout(timeoutId);
        reject(new Error('Unable to read the selected image. Please choose a standard JPG, PNG, or WebP image.'));
      };
      element.src = imageUrl;
    });

    // Profile photos are stored as compact Firestore-safe data URLs so they
    // work even when a Firebase project has no Storage bucket configured.
    const maxDimension = 192;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare the selected image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let blob: Blob | null = null;
    for (const quality of [0.78, 0.64, 0.5, 0.38]) {
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Unable to prepare the selected image.')), 'image/webp', quality);
      });
      if (blob.size <= PROFILE_PHOTO_MAX_BYTES) break;
    }
    if (!blob || blob.size > PROFILE_PHOTO_MAX_BYTES) {
      throw new Error('This image could not be compressed enough. Please choose a simpler photo.');
    }
    return new File([blob], 'profile-photo.webp', { type: 'image/webp' });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

export const saveAttachment = async (file: File, kind: AttachmentKind, houseId?: string): Promise<string> => {
  if (!file.type.startsWith('image/')) throw new Error('Only image attachments are supported.');
  if (file.size > CLOUD_MAX_BYTES) throw new Error('Image must be 5 MB or smaller.');

  if (kind === 'avatars') {
    if (file.size > PROFILE_PHOTO_MAX_BYTES) throw new Error('Profile photo is too large after optimization.');
    return asDataUrl(file);
  }

  if (isFirebaseConfigured && fileStorage && auth?.currentUser) {
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = houseId
      ? `houses/${houseId}/${kind}/${createId('file')}.${extension}`
      : `users/${auth.currentUser.uid}/${kind}/${createId('file')}.${extension}`;
    return uploadImageWithTimeout(path, file, auth.currentUser.uid);
  }

  if (file.size > OFFLINE_MAX_BYTES) {
    throw new Error('Offline attachments must be 300 KB or smaller. Connect cloud storage to upload larger images.');
  }
  return asDataUrl(file);
};
