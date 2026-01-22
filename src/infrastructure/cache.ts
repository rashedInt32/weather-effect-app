import { Context, Effect, Layer, Ref } from "effect";
import { CacheConfigType } from "src/domain/config.js";
import {
  CacheExpiredError,
  CacheFullError,
  CacheMissError,
} from "src/errors/index.js";

interface CacheEntry<T> {
  value: T;
  cachedAt: Date;
  expiresAt: Date;
  accessCount: number;
}

type CacheState = Map<string, CacheEntry<unknown>>;

export class Cache extends Context.Tag("Cache")<
  Cache,
  {
    readonly get: <T>(
      key: string,
    ) => Effect.Effect<T, CacheMissError | CacheExpiredError>;

    readonly set: <T>(
      key: string,
      value: T,
    ) => Effect.Effect<void, CacheFullError>;

    readonly clear: () => Effect.Effect<void>;
    readonly size: () => Effect.Effect<number>;
  }
>() {}

export const makeCache = Effect.fn("makeCache")(function* (
  config: CacheConfigType,
) {
  const cacheRef = yield* Ref.make<CacheState>(new Map());

  const get = <T>(
    key: string,
  ): Effect.Effect<T, CacheMissError | CacheExpiredError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(cacheRef);
      const entry = state.get(key);

      if (!entry) {
        return yield* CacheMissError.make({ key });
      }
      const now = new Date();
      if (now > entry.expiresAt) {
        yield* Ref.update(cacheRef, (s) => {
          s.delete(key);
          return s;
        });
        return yield* CacheExpiredError.make({
          key,
          cachedAt: entry.cachedAt,
          expiresAt: entry.expiresAt,
        });
      }

      yield* Ref.update(cacheRef, (s) => {
        const updated = s.get(key);
        if (updated) {
          updated.accessCount++;
        }
        return s;
      });

      return entry.value as T;
    });

  const set = <T>(key: string, value: T): Effect.Effect<void, CacheFullError> =>
    Effect.gen(function* () {
      if (!config.enabled) {
        return;
      }
      const state = yield* Ref.get(cacheRef);

      if (state.size >= config.maxSize && !state.has(key)) {
        let lruKey: string | null = null;
        let minAccessCount = Infinity;

        for (const [k, entry] of state.entries()) {
          if (entry.accessCount < minAccessCount) {
            minAccessCount = entry.accessCount;
            lruKey = k;
          }
        }

        if (lruKey) {
          yield* Ref.update(cacheRef, (s) => {
            s.delete(lruKey!);
            return s;
          });
        } else {
          return yield* CacheFullError.make({
            maxSize: config.maxSize,
            currentSize: state.size,
          });
        }
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + config.ttsSeconds * 1000);

      const entry: CacheEntry<T> = {
        value,
        cachedAt: now,
        expiresAt,
        accessCount: 0,
      };

      return yield* Ref.update(cacheRef, (s) => {
        s.set(key, entry as CacheEntry<unknown>);
        return s;
      });
    });

  const clear = (): Effect.Effect<void> => Ref.set(cacheRef, new Map());

  const size = (): Effect.Effect<number> =>
    Ref.get(cacheRef).pipe(Effect.map((s) => s.size));

  return Cache.of({ get, set, clear, size });
});

export const makeCacheLayer = (config: CacheConfigType) =>
  Layer.effect(Cache, makeCache(config));
