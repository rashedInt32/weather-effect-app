import { Context, Effect, Layer } from "effect";
import { Location, WeatherReading } from "src/domain/models.js";
import {
  HttpError,
  InvalidResponseError,
  LocationNotFoundError,
  NetworkEerror,
  RateLimitError,
  TimeoutError,
} from "src/errors/index.js";
import { Cache } from "src/infrastructure/cache.js";
import { Storage } from "src/infrastructure/storage.js";
import { WeatherApi } from "src/infrastructure/weeather-api.js";

type WeatherServiceError =
  | NetworkEerror
  | HttpError
  | RateLimitError
  | InvalidResponseError
  | TimeoutError;

interface WeatherServiceInterface {
  readonly getCurrentWeather: (
    location: Location,
  ) => Effect.Effect<WeatherReading, WeatherServiceError>;
  readonly refreshWeather: (
    location: Location,
  ) => Effect.Effect<WeatherReading, WeatherServiceError>;
  readonly addLocation: (location: Location) => Effect.Effect<void>;
  readonly removeLocation: (
    locationId: string,
  ) => Effect.Effect<void, LocationNotFoundError>;
  readonly getTrackedLocations: () => Effect.Effect<Location[]>;
  readonly getWeatherHistory: () => Effect.Effect<WeatherReading[]>;
}

export class WeatherService extends Context.Tag("WeatherService")<
  WeatherService,
  WeatherServiceInterface
>() {}

export const makeWeatherService = Effect.gen(function* () {
  const api = yield* WeatherApi;
  const cache = yield* Cache;
  const storage = yield* Storage;

  const getCurrentWeather = (
    location: Location,
  ): Effect.Effect<WeatherReading, WeatherServiceError> =>
    Effect.gen(function* () {
      const cacheKey = `weather:${location.id}`;

      const cached = yield* cache.get<WeatherReading>(cacheKey).pipe(
        Effect.catchTags({
          CacheMissError: () => Effect.succeed(null),
          CacheExpiredError: () => Effect.succeed(null),
        }),
      );

      if (cached !== null) {
        return cached;
      }

      const fresh = yield* api.getCurrentWeather(location);
      yield* cache
        .set(cacheKey, fresh)
        .pipe(Effect.catchAll(() => Effect.void));

      return fresh;
    });

  const refreshWeather = (
    location: Location,
  ): Effect.Effect<WeatherReading, WeatherServiceError> =>
    Effect.gen(function* () {
      const fresh = yield* api.getCurrentWeather(location);
      const cacheKey = `weather:${location.id}`;
      yield* cache
        .set(cacheKey, fresh)
        .pipe(Effect.catchAll(() => Effect.void));

      return fresh;
    });

  const addLocation = (location: Location): Effect.Effect<void> =>
    Effect.gen(function* () {
      const locations: Location[] = yield* storage
        .loadLocations()
        .pipe(Effect.catchAll(() => Effect.succeed([] as Location[])));

      const exists = locations.some((loc) => loc.id === location.id);
      if (!exists) {
        locations.push(location);
        yield* storage
          .saveLocations(locations)
          .pipe(Effect.catchAll(() => Effect.void));
      }
    });

  const removeLocation = (
    locationId: string,
  ): Effect.Effect<void, LocationNotFoundError> =>
    Effect.gen(function* () {
      const locations: Location[] = yield* storage
        .loadLocations()
        .pipe(Effect.catchAll(() => Effect.succeed([] as Location[])));

      const exists = locations.some((loc) => loc.id === locationId);
      if (!exists) {
        return yield* LocationNotFoundError.make({
          locationId,
        });
      }

      const filtered = locations.filter(
        (location) => location.id !== locationId,
      );

      yield* storage
        .saveLocations(filtered)
        .pipe(Effect.catchAll(() => Effect.void));
    });

  const getTrackedLocations = (): Effect.Effect<Location[]> =>
    storage.loadLocations().pipe(Effect.catchAll(() => Effect.succeed([])));

  const getWeatherHistory = (): Effect.Effect<WeatherReading[]> =>
    storage.loadReadings().pipe(Effect.catchAll(() => Effect.succeed([])));

  return WeatherService.of({
    getCurrentWeather,
    addLocation,
    getTrackedLocations,
    getWeatherHistory,
    refreshWeather,
    removeLocation,
  });
});

export const WeatherServiceLive = Layer.effect(
  WeatherService,
  makeWeatherService,
);
