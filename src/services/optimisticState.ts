/**
 * Restores one optimistic collection item without clobbering a newer local
 * edit to a different version of the same record.
 */
export const rollbackOptimisticEntity = <T extends { id: string }>(
  current: T[],
  entityId: string,
  previous: T | undefined,
  isStillOptimistic?: (entity: T) => boolean,
): T[] => {
  const optimistic = current.find((entity) => entity.id === entityId);
  if (!optimistic) return previous ? [previous, ...current] : current;
  if (isStillOptimistic && !isStillOptimistic(optimistic)) return current;
  if (!previous) return current.filter((entity) => entity.id !== entityId);
  return current.map((entity) => entity.id === entityId ? previous : entity);
};
