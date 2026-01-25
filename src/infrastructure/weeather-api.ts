import { Context, Schema, Effect, Layer } from "effect";
import { WeatherApiConfigType } from "src/domain/config.js";
import {
  createWeatherReading,
  WeatherReading,
  Location,
} from "src/domain/models.js";
import {
  HttpError,
  InvalidResponseError,
  NetworkEerror,
  RateLimitError,
  TimeoutError,
} from "src/errors/index.js";

const OpenWeatherMapResponse = Schema.Struct({
  coord: Schema.Struct({
    lon: Schema.Number,
    lat: Schema.Number,
  }),
  weather: Schema.Array(
    Schema.Struct({
      id: Schema.Number,
      main: Schema.String,
      description: Schema.String,
    }),
  ),
  main: Schema.Struct({
    temp: Schema.Number,
    feels_like: Schema.Number,
    humidity: Schema.Number,
    pressure: Schema.optional(Schema.Number),
  }),
  visibility: Schema.optional(Schema.Number),
  wind: Schema.Struct({
    speed: Schema.Number,
    deg: Schema.optional(Schema.Number),
  }),
  rain: Schema.optional(
    Schema.Struct({
      "1h": Schema.optional(Schema.Number),
    }),
  ),
  name: Schema.String,
  dt: Schema.Number,
});

type OpenWeatherMapResponse = typeof OpenWeatherMapResponse.Type;

const mapWeatherCondition = (id: number): WeatherReading["condition"] => {
  if (id >= 200 && id < 300) return "stormy";
  if (id >= 300 && id < 600) return "rainy";
  if (id >= 600 && id < 700) return "snowy";
  if (id >= 700 && id < 800) return "foggy";
  if (id === 800) return "clear";
  return "cloudy";
};

const transformResponse = (
  response: OpenWeatherMapResponse,
  location: Location,
): WeatherReading => {
  const tempCelsius = response.main.temp - 273.15;
  const feelsLikeCelsius = response.main.feels_like - 273.15;
  const condition = mapWeatherCondition(response.weather[0]?.id ?? 800);

  return createWeatherReading({
    location,
    temperature: tempCelsius,
    feelsLike: feelsLikeCelsius,
    humidity: response.main.humidity,
    condition,
    windSpeed: response.wind.speed,
    windDirection: response.wind.deg ?? 180,
    precipitation: response.rain?.["1h"] ?? 0,
    pressure: response.main.pressure ?? 1015,
    visibility: response.visibility ?? 1000,
  });
};

export class WeatherApi extends Context.Tag("WeatherApi")<
  WeatherApi,
  {
    readonly getCurrentWeather: (
      location: Location,
    ) => Effect.Effect<
      WeatherReading,
      | NetworkEerror
      | HttpError
      | RateLimitError
      | InvalidResponseError
      | TimeoutError
    >;
  }
>() {}

export const makeWeatherApi = (config: WeatherApiConfigType) => {
  const getCurrentWeather = (
    location: Location,
  ): Effect.Effect<
    WeatherReading,
    | NetworkEerror
    | HttpError
    | RateLimitError
    | InvalidResponseError
    | TimeoutError
  > =>
    Effect.gen(function* () {
      const url = new URL(`${config.baseUrl}/weather`);
      url.searchParams.set("lat", location.coordinates.latitude.toString());
      url.searchParams.set("lon", location.coordinates.longitude.toString());
      url.searchParams.set("appid", config.apiKey);

      const response = yield* Effect.tryPromise({
        try: () => fetch(url.toString()),
        catch: (error) =>
          NetworkEerror.make({
            url: url.toString(),
            operation: "Fetch",
            cause: error,
          }),
      }).pipe(
        Effect.timeout(`${config.timeoutMs} millis`),
        Effect.mapError((maybeTimeout) => {
          if (maybeTimeout._tag === "TimeoutException") {
            return TimeoutError.make({
              operation: `Fetch ${url.toString()}`,
              timeoutMs: config.timeoutMs,
            });
          }
          return maybeTimeout;
        }),
      );

      if (!response.ok) {
        const body = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => undefined,
        }).pipe(Effect.orElseSucceed(() => undefined));

        if (response.status === 429) {
          const resetAt = new Date(Date.now() + 60000);
          const retryAfter = response.headers.get("Retry-After");

          return yield* RateLimitError.make({
            limit: config.maxRequestsPerMinute,
            remaining: 0,
            resetAt,
            retryAfterSeconds: retryAfter
              ? parseInt(retryAfter, 10)
              : undefined,
          });
        }

        return yield* HttpError.make({
          url: url.toString(),
          method: "GET",
          statusCode: response.status,
          statusText: response.statusText,
          body,
        });
      }

      const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: (error) =>
          InvalidResponseError.make({
            url: url.toString(),
            expectedSchema: "OpenWeatherMapResponse",
            responseBody: "Failed to parse JSON",
            parseError: error,
          }),
      });

      const validated = yield* Schema.decode(OpenWeatherMapResponse)(json).pipe(
        Effect.mapError((parseError) =>
          InvalidResponseError.make({
            url: url.toString(),
            expectedSchema: "OpenWeatherMapResponse",
            responseBody: JSON.stringify(json),
            parseError,
          }),
        ),
      );

      return transformResponse(validated, location);
    });

  return WeatherApi.of({
    getCurrentWeather,
  });
};

export const makeWeatherApiLayer = (config: WeatherApiConfigType) =>
  Layer.succeed(WeatherApi, makeWeatherApi(config));
