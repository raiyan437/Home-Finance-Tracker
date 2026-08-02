import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, fileStorage, isFirebaseConfigured } from '../config/firebase';
import { createId } from '../utils/ids';

export type AttachmentKind = 'avatars' | 'receipts' | 'settlement-proofs';
const CLOUD_MAX_BYTES = 5 * 1024 * 1024;
const OFFLINE_MAX_BYTES = 300 * 1024;

const asDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Unable to read the selected image.'));
  reader.readAsDataURL(file);
});

export const saveAttachment = async (file: File, kind: AttachmentKind, houseId?: string): Promise<string> => {
  if (!file.type.startsWith('image/')) throw new Error('Only image attachments are supported.');
  if (file.size > CLOUD_MAX_BYTES) throw new Error('Image must be 5 MB or smaller.');

  if (isFirebaseConfigured && fileStorage && auth?.currentUser) {
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = houseId
      ? `houses/${houseId}/${kind}/${createId('file')}.${extension}`
      : `users/${auth.currentUser.uid}/${kind}/${createId('file')}.${extension}`;
    const storageRef = ref(fileStorage, path);
    await uploadBytes(storageRef, file, { contentType: file.type, customMetadata: { ownerUid: auth.currentUser.uid } });
    return getDownloadURL(storageRef);
  }

  if (file.size > OFFLINE_MAX_BYTES) {
    throw new Error('Offline attachments must be 300 KB or smaller. Connect cloud storage to upload larger images.');
  }
  return asDataUrl(file);
};
