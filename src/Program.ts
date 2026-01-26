import { Console, Effect, Layer, Stream } from "effect";
import {
  CacheConfig,
  StorageConfig,
  WeatherApiConfig,
} from "src/domain/config.js";
import { createLocation, WeatherReading } from "src/domain/models.js";
import { makeCacheLayer } from "src/infrastructure/cache.js";
import { makeStorageLayer } from "src/infrastructure/storage.js";
import { makeWeatherApiLayer } from "src/infrastructure/weeather-api.js";
import {
  StreamService,
  StreamServiceLive,
} from "src/services/stream-service.js";
import {
  WeatherService,
  WeatherServiceLive,
} from "src/services/weather-service.js";

const infraLayer = Layer.unwrapEffect(
  Effect.all({
    apiConfig: WeatherApiConfig,
    cacheConfig: CacheConfig,
    storageConfig: StorageConfig,
  }).pipe(
    Effect.map(({ apiConfig, cacheConfig, storageConfig }) =>
      Layer.mergeAll(
        makeWeatherApiLayer(apiConfig),
        makeCacheLayer(cacheConfig),
        makeStorageLayer(storageConfig),
      ),
    ),
  ),
);

const weatherlayer = Layer.provide(WeatherServiceLive, infraLayer);
const streamLayer = Layer.provide(
  StreamServiceLive,
  Layer.merge(infraLayer, weatherlayer),
);

const servicesLayer = Layer.mergeAll(weatherlayer, streamLayer);

const demoProgram = Effect.gen(function* () {
  const weatherService = yield* WeatherService;
  const streamService = yield* StreamService;

  yield* Console.log("=== Weather Monitoring System ===\n");

  yield* Console.log("📍 Adding locations to track...");

  const nyc = createLocation({
    name: "New York",
    country: "US",
    latitude: 40.7128,
    longitude: -74.006,
  });

  const london = createLocation({
    name: "London",
    country: "GB",
    latitude: 51.5074,
    longitude: -0.1278,
  });

  const tokyo = createLocation({
    name: "Tokyo",
    country: "JP",
    latitude: 35.6762,
    longitude: 139.6503,
  });

  yield* weatherService.addLocation(nyc);
  yield* Console.log(`  ✓ Added ${nyc.name}, ${nyc.country}`);

  yield* weatherService.addLocation(london);
  yield* Console.log(`  ✓ Added ${london.name}, ${london.country}`);

  yield* weatherService.addLocation(tokyo);
  yield* Console.log(`  ✓ Added ${tokyo.name}, ${tokyo.country}`);

  yield* Console.log("\n🌦️  Starting weather stream...");
  yield* Console.log("(Press Ctrl+C to stop)\n");

  const updates = streamService.weatherUpdates();

  yield* Stream.runForEach(updates, (reading: WeatherReading) =>
    Console.log(
      `[${new Date(reading.timestamp).toLocaleTimeString()}] ` +
        `${reading.location.name}: ${reading.temperature}°C, ` +
        `Humidity: ${reading.humidity}%, ` +
        `Wind: ${reading.windSpeed} m/s - ${reading.condition}`,
    ),
  );
});

const main = demoProgram.pipe(Effect.provide(servicesLayer));

Effect.runPromise(main).catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
