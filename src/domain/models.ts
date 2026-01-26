import { Schema } from "effect";

export class LocationId extends Schema.String.pipe(
  Schema.brand("LocationId"),
) {}

export class WeatherReadingId extends Schema.String.pipe(
  Schema.brand("WeatherReadingId"),
) {}

export const Latitude = Schema.Number.pipe(
  Schema.between(-90, 90, {
    message: () => "Latitude must be between -90 and 90 degrees",
  }),
  Schema.brand("Latitude"),
);

export const Longitude = Schema.Number.pipe(
  Schema.between(-180, 180, {
    message: () => "Longitude must be between -180 and 180 degrees",
  }),
  Schema.brand("Longitude"),
);

export class Location extends Schema.Class<Location>("Location")({
  id: LocationId,
  name: Schema.String.pipe(
    Schema.minLength(1, {
      message: () => "Name must be more that 1 character lenght",
    }),
  ),
  country: Schema.optional(Schema.String),
  coordinates: Schema.Struct({
    latitude: Latitude,
    longitude: Longitude,
  }),
}) {}

export const WeatherCondition = Schema.Literal(
  "clear",
  "cloudy",
  "rainy",
  "snowy",
  "stormy",
  "foggy",
);

export type WeatherCondition = typeof WeatherCondition.Type;

export const Temperature = Schema.Number.pipe(
  Schema.between(-100, 60, {
    message: () => "Temperature must be between -100 and 60 Celsius",
  }),
  Schema.brand("Temperature"),
);

export const Humidity = Schema.Number.pipe(
  Schema.between(0, 100, {
    message: () => "Humidity must be between 0 and 100 percent",
  }),
  Schema.brand("Humidity"),
);

export const WindSpeed = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0, {
    message: () => "Wind speed must be greater than or equal to 0",
  }),
  Schema.brand("WindSpeed"),
);

export class WeatherReading extends Schema.Class<WeatherReading>(
  "WeatherReading",
)({
  id: WeatherReadingId,
  location: Location,
  temperature: Temperature,
  feelsLike: Temperature,
  humidity: Humidity,
  windSpeed: WindSpeed,
  condition: WeatherCondition,
  windDirection: Schema.optional(
    Schema.Number.pipe(
      Schema.between(0, 360, {
        message: () => "Wend direction must be between 0 and 360 degrees",
      }),
    ),
  ),
  precipitation: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0, {
        message: () => "Precipitation must be greater than or equal to 0",
      }),
    ),
  ),
  pressure: Schema.optional(
    Schema.Number.pipe(
      Schema.between(900, 1100, {
        message: () => "Pressure must be between 900 and 1100 hPa",
      }),
    ),
  ),
  timestamp: Schema.Date,
}) {}

export class Forcast extends Schema.Class<Forcast>("Forcast")({
  id: Schema.String.pipe(Schema.brand("ForecastId")),
  location: Location,
  forecastedFor: Schema.Date,
  temperature: Temperature,
  temperatureMax: Temperature,
  temperatureMin: Temperature,
  condition: WeatherCondition,
  humidity: Humidity,
  windSpeed: WindSpeed,
  precipitation: Schema.optional(Schema.Number),
  confidence: Schema.Number.pipe(
    Schema.between(0, 100, {
      message: () => "Confidence must be between 0 and 100 percent",
    }),
  ),
  createdAt: Schema.Date,
}) {}

export const createLocation = (params: {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
}): Location =>
  new Location({
    id: LocationId.make(`loc-${Math.random().toString(36).slice(2)}`),
    name: params.name,
    country: params.country,
    coordinates: {
      latitude: Latitude.make(params.latitude),
      longitude: Longitude.make(params.longitude),
    },
  });

export const createWeatherReading = (params: {
  location: Location;
  temperature: number;
  feelsLike: number;
  humidity: number;
  condition: WeatherCondition;
  windSpeed: number;
  windDirection?: number;
  precipitation?: number;
  pressure?: number;
}): WeatherReading =>
  new WeatherReading({
    id: WeatherReadingId.make(`read-${Math.random().toString(36).slice(2)}`),
    location: params.location,
    temperature: Temperature.make(params.temperature),
    feelsLike: Temperature.make(params.feelsLike),
    humidity: Humidity.make(params.humidity),
    condition: params.condition,
    windSpeed: WindSpeed.make(params.windSpeed),
    windDirection: params.windDirection,
    precipitation: params.precipitation,
    pressure: params.pressure,
    visibility: params.visibility,
    timestamp: new Date(),
  });

export const createForcast = (params: {
  location: Location;
  forecastedFor: Date;
  temperature: number;
  temperatureMax: number;
  temperatureMin: number;
  condition: WeatherCondition;
  humidity: number;
  windSpeed: number;
  precipitation?: number;
  confidence: number;
}): Forcast =>
  new Forcast({
    id: Schema.String.pipe(Schema.brand("ForecastId")).make(
      `forecast-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ),
    location: params.location,
    forecastedFor: params.forecastedFor,
    condition: params.condition,
    temperature: Temperature.make(params.temperature),
    temperatureMin: Temperature.make(params.temperatureMin),
    temperatureMax: Temperature.make(params.temperatureMax),
    humidity: Humidity.make(params.humidity),
    windSpeed: WindSpeed.make(params.windSpeed),
    precipitation: params.precipitation,
    confidence: params.confidence,
    createdAt: new Date(),
  });
