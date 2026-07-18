const cache = new Map();
const pending = new Map();
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

export function getCachedLibrary(libraryPath) {
  return libraryPath ? cache.get(libraryPath) ?? null : null;
}

export function setCachedLibrary(libraryPath, library) {
  if (!libraryPath) return;
  cache.set(libraryPath, library);
  notify();
}

export function invalidateLibraryCache(libraryPath) {
  if (!libraryPath) return;
  cache.delete(libraryPath);
  pending.delete(libraryPath);
  notify();
}

export function clearLibraryCache() {
  cache.clear();
  pending.clear();
  notify();
}

export async function loadLibraryFromCache(libraryPath, loader) {
  if (!libraryPath) return null;
  const cached = getCachedLibrary(libraryPath);
  if (cached) return cached;
  if (pending.has(libraryPath)) return pending.get(libraryPath);

  const request = Promise.resolve(loader())
    .then((library) => {
      setCachedLibrary(libraryPath, library);
      pending.delete(libraryPath);
      return library;
    })
    .catch((error) => {
      pending.delete(libraryPath);
      throw error;
    });

  pending.set(libraryPath, request);
  return request;
}

export function subscribeToLibraryCache(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
