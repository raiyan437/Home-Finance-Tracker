import { describe, expect, it } from 'vitest';
import { rollbackOptimisticEntity } from './optimisticState';

describe('optimistic rollback', () => {
  it('rolls back failed creates', () => {
    expect(rollbackOptimisticEntity([{ id: 'new', value: 'local', version: 1 }], 'new', undefined)).toEqual([]);
  });

  it('restores the last confirmed version after a failed update', () => {
    const previous = { id: 'item', value: 'cloud', version: 1 };
    const current = [{ id: 'item', value: 'optimistic', version: 2 }];
    expect(rollbackOptimisticEntity(current, 'item', previous, (item) => item.version === 2)).toEqual([previous]);
  });

  it('restores failed deletions and does not clobber a newer edit', () => {
    const previous = { id: 'item', value: 'cloud', version: 1 };
    expect(rollbackOptimisticEntity([], 'item', previous)).toEqual([previous]);
    const newer = { id: 'item', value: 'newer', version: 3 };
    expect(rollbackOptimisticEntity([newer], 'item', previous, (item) => item.version === 2)).toEqual([newer]);
  });
});
