const cacheStore = new WeakMap();

export function getCachedViewData(items, cacheKey, compute) {
  if (!items) return compute();

  let bucket = cacheStore.get(items);
  if (!bucket) {
    bucket = new Map();
    cacheStore.set(items, bucket);
  }

  if (bucket.has(cacheKey)) {
    return bucket.get(cacheKey);
  }

  const value = compute();
  bucket.set(cacheKey, value);
  return value;
}
