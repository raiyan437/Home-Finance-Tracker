import { describe, expect, it } from 'vitest';
import {
  FIRESTORE_PROFILE_AVATAR_MAX_CHARS,
  profilePhotoNeedsNormalization,
} from './attachments';

describe('profile photo compatibility', () => {
  it('normalizes only oversized inline image data', () => {
    const prefix = 'data:image/webp;base64,';
    const atLimit = prefix + 'a'.repeat(FIRESTORE_PROFILE_AVATAR_MAX_CHARS - prefix.length);
    const overLimit = atLimit + 'a';

    expect(profilePhotoNeedsNormalization(atLimit)).toBe(false);
    expect(profilePhotoNeedsNormalization(overLimit)).toBe(true);
    expect(profilePhotoNeedsNormalization('https://example.com/avatar.webp')).toBe(false);
    expect(profilePhotoNeedsNormalization(undefined)).toBe(false);
  });
});
