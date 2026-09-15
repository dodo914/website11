import { lazy } from 'react';

const CHUNK_RELOAD_KEY = 'lava_chunk_reload_once';

/**
 * Load a lazy chunk and recover once from stale-cache/deploy chunk mismatches.
 * A single hard reload is allowed per session to avoid infinite reload loops.
 */
export function lazyWithRetry(importer) {
  return lazy(async () => {
    try {
      const module = await importer();
      // A stale-chunk recovery flag is only needed until the retry succeeds.
      // Clear it after a successful import so a later deployment in the same
      // browser tab/session can recover once again if its chunks are stale.
      try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch (_) {}
      return module;
    } catch (error) {
      if (typeof window === 'undefined') throw error;

      let alreadyRetried = false;
      try {
        alreadyRetried = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
      } catch (_) {}

      if (!alreadyRetried) {
        try { sessionStorage.setItem(CHUNK_RELOAD_KEY, '1'); } catch (_) {}
        window.location.reload();
        await new Promise(() => {});
      }

      throw error;
    }
  });
}
