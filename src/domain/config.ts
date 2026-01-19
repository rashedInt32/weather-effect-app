// We need to create configurations for different environments
// WeatherAppConfig {apiKey, baseUrl, timeoutMs, maxRequestPerMinute}
//

import { Config } from "effect";
import { number } from "effect/Equivalence";

export const WeatherApiConfig = Config.all({
  apiKey: Config.string("WEATHER_API_KEY"),
  baseUrl: Config.string("WEATHER_API_BASE_URL").pipe(
    Config.withDefault("https://api.openweathermap.org/data/2.5"),
  ),
  timeoutMs: Config.number("WEATHER_API_TIMEOUT_MS").pipe(
    Config.withDefault(5000),
    Config.validate({
      message: "Timeout must be between 100ms and 60000ms",
      validation: (n) => n >= 100 && n <= 6000,
    }),
  ),
  maxRequestsPerMinute: Config.number("WEATHER_API_MAX_REQUESTS_PER_MIN").pipe(
    Config.withDefault(60),
    Config.validate({
      message: "Maximum requests per minute must be between 1 and 1200",
      validation: (n) => n >= 1 && n <= 1000,
    }),
  ),
});

export const CacheConfig = Config.all({
  enabled: Config.boolean("CACHE_ENABLED").pipe(Config.withDefault(true)),
  ttsSeconds: Config.number("CACHE_TTL_SECONDS").pipe(
    Config.withDefault(300),
    Config.validate({
      message: "Cache TTL must be between 10 and 3600 seconds",
      validation: (n) => n >= 100 && n <= 4000,
    }),
  ),
  maxSize: Config.number("CACHE_MAX_SIZE").pipe(
    Config.withDefault(100),
    Config.validate({
      message: "Max cache size must be between 10 and 1000 items",
      validation: (n) => n >= 10 && n <= 1000,
    }),
  ),
});

export const StorageConfig = Config.all({
  dataDir: Config.string("WEATHER_CACHE_DATA_DIR").pipe(
    Config.withDefault("./data/weather"),
  ),

  autoSaveIntervalSeconds: Config.number(
    "WEATHER_AUTO_SAVE_INTERVAL_SECONDS",
  ).pipe(
    Config.withDefault(60),
    Config.validate({
      message: "Auto save interval must be between 5 and 3600 seconds",
      validation: (n) => n == 0 || (n >= 10 && n <= 3600),
    }),
  ),
});

export const StreamConfig = Config.all({
  pullIntervalSeconds: Config.number(
    "WEATHER_STREAM_PULL_INTERVAL_SECONDS",
  ).pipe(
    Config.withDefault(30),
    Config.validate({
      message: "Stream pull interval must be between 10 and 3600 seconds",
      validation: (n) => n >= 10 && n <= 3600,
    }),
  ),

  maxConcurrentLocation: Config.number(
    "WEATHER_STREAM_MAX_CONCURRENT_LOCATION",
  ).pipe(
    Config.withDefault(5),
    Config.validate({
      message:
        "Weather stream max concurrent locations must be between 1 and 100",
      validation: (n) => n >= 1 && n <= 100,
    }),
  ),

  bufferSize: Config.number("WEATHER_STREAM_BUFFER_SIZE").pipe(
    Config.withDefault(10),
    Config.validate({
      message: "Buffer size must be between 1 and 1000",
      validation: (n) => n >= 5 && n <= 1000,
    }),
  ),
});

export const AppConfig = Config.all({
  api: WeatherApiConfig,
  cache: CacheConfig,
  storage: StorageConfig,
  stream: StreamConfig,
});

export type AppConfig = Config.Config.Success<typeof AppConfig>;
export type WeatherApiConfigType = Config.Config.Success<
  typeof WeatherApiConfig
>;
export type CacheConfigType = Config.Config.Success<typeof CacheConfig>;
export type StorageConfigType = Config.Config.Success<typeof StorageConfig>;
export type StreamConfigtype = Config.Config.Success<typeof StreamConfig>;
