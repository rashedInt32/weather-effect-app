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
  location: Schema.Struct({
    name: Schema.String,
    country: Schema.String,
    lon: Schema.Number,
    lat: Schema.Number,
  }),
  current: Schema.Struct({
    temp_c: Schema.Number,
    wind_kph: Schema.Number,
    wind_degree: Schema.Number,
    pressure_mb: Schema.Number,
    precip_in: Schema.Number,
    humidity: Schema.Number,
    feelslike_c: Schema.Number,
    condition: Schema.Struct({
      text: Schema.String,
      icon: Schema.String,
      code: Schema.Number,
    }),
  }),
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
  const tempCelsius = response.current.temp_c;
  const feelsLikeCelsius = response.current.feelslike_c;
  const condition = mapWeatherCondition(response.current.condition.code ?? 800);

  return createWeatherReading({
    location,
    temperature: tempCelsius,
    feelsLike: feelsLikeCelsius,
    humidity: response.current.humidity,
    condition,
    windSpeed: response.current.wind_kph,
    windDirection: response.current.wind_degree ?? 180,
    precipitation: response.current.precip_in ?? 0,
    pressure: response.current.pressuere_md ?? 1015,
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
      const url = new URL(
        `${config.baseUrl}key=${config.apiKey}&q=${location.name}`,
      );
      // url.searchParams.set("lat", location.coordinates.latitude.toString());
      // url.searchParams.set("lon", location.coordinates.longitude.toString());
      // url.searchParams.set("appid", config.apiKey);

      const response = yield* Effect.tryPromise({
        try: () => fetch(url.toString()),
        catch: (error) => {
          return NetworkEerror.make({
            url: url.toString(),
            operation: "Fetch",
            cause: error,
          });
        },
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
        catch: (error) => {
          return InvalidResponseError.make({
            url: url.toString(),
            expectedSchema: "OpenWeatherMapResponse",
            responseBody: "Failed to parse JSON",
            parseError: error,
          });
        },
      });

      const validated = yield* Schema.decode(OpenWeatherMapResponse)(json).pipe(
        Effect.mapError((parseError) => {
          return InvalidResponseError.make({
            url: url.toString(),
            expectedSchema: "OpenWeatherMapResponse",
            responseBody: JSON.stringify(json),
            parseError,
          });
        }),
      );

      const result = transformResponse(validated, location);
      return result;
    });

  return WeatherApi.of({
    getCurrentWeather,
  });
};

export const makeWeatherApiLayer = (config: WeatherApiConfigType) =>
  Layer.succeed(WeatherApi, makeWeatherApi(config));
