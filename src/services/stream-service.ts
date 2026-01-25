import { Context, Duration, Effect, Schedule, Stream } from "effect";
import { StreamConfig, StreamConfigtype } from "src/domain/config.js";
import { WeatherReading, Location } from "src/domain/models.js";
import { WeatherService } from "src/services/weather-service.js";

export interface StreamServiceInterface {
  weatherUpdates: () => Stream.Stream<WeatherReading, never, WeatherService>;
  locationWeatherUpdates: (
    locationId: string,
  ) => Stream.Stream<WeatherReading, never, WeatherService>;
  multiLocationWeatherUpdates: (
    locationIds: string[],
  ) => Stream.Stream<WeatherReading, never, WeatherService>;
}

export class StreamService extends Context.Tag("StreamService")<
  StreamService,
  StreamServiceInterface
>() {}

export const makeStreamService = Effect.gen(function* () {
  const weatherService = yield* WeatherService;
  const config: StreamConfigtype = yield* StreamConfig;

  const weatherUpdates = (): Stream.Stream<
    WeatherReading,
    never,
    WeatherService
  > =>
    Stream.fromSchedule(
      Schedule.fixed(Duration.seconds(config.pullIntervalSeconds)),
    ).pipe(
      Stream.flatMap(() => weatherService.getTrackedLocations()),
      Stream.flatMap((locations) =>
        Stream.fromIterable(locations as Location[]),
      ),
      Stream.mapEffect(
        (location: Location) =>
          weatherService
            .getCurrentWeather(location)
            .pipe(Effect.catchAll(() => Effect.succeed(null))),
        { concurrency: config.maxConcurrentLocation },
      ),
      Stream.filter((reading): reading is WeatherReading => reading !== null),
      Stream.buffer({ capacity: config.bufferSize }),
    );

  const locationWeatherUpdates = (
    locationId: string,
  ): Stream.Stream<WeatherReading, never, WeatherService> =>
    Stream.fromSchedule(
      Schedule.fixed(Duration.seconds(config.pullIntervalSeconds)),
    ).pipe(
      Stream.flatMap(() =>
        Effect.gen(function* () {
          const locations = yield* weatherService.getTrackedLocations();
          const location = locations.find((loc) => loc.id === locationId);
          return location;
        }),
      ),
      Stream.filter((location): location is Location => location !== undefined),
      Stream.mapEffect((location) =>
        weatherService.getCurrentWeather(location).pipe(
          Effect.retry(
            Schedule.exponential(Duration.seconds(1)).pipe(
              Schedule.compose(Schedule.recurs(3)),
            ),
          ),
          Effect.catchAll(() => Effect.succeed(null)),
        ),
      ),
      Stream.filter((reading): reading is WeatherReading => reading !== null),
    );

  const multiLocationWeatherUpdates = (
    locationIds: string[],
  ): Stream.Stream<WeatherReading, never, WeatherService> =>
    Stream.mergeAll(
      locationIds.map((id) => locationWeatherUpdates(id)),
      { concurrency: config.maxConcurrentLocation },
    );

  return StreamService.of({
    weatherUpdates,
    locationWeatherUpdates,
    multiLocationWeatherUpdates,
  });
});
