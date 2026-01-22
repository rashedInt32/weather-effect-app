import { Schema } from "effect";

export class NetworkEerror extends Schema.TaggedError<NetworkEerror>()(
  "NetworkEerror",
  {
    url: Schema.String,
    operation: Schema.String,
    cause: Schema.Defect,
  },
) {}

export class HttpError extends Schema.TaggedError<HttpError>()("HttpError", {
  url: Schema.String,
  method: Schema.String,
  statusCode: Schema.Number,
  statusText: Schema.String,
  body: Schema.optional(Schema.String),
}) {}

export class RateLimitError extends Schema.TaggedError<RateLimitError>()(
  "RateLimitError",
  {
    limit: Schema.Number,
    remaining: Schema.Number,
    resetAt: Schema.Date,
    retryAfterSeconds: Schema.optional(Schema.Number),
  },
) {}

export class InvalidResponseError extends Schema.TaggedError<InvalidResponseError>()(
  "InvalidResponseError",
  {
    url: Schema.String,
    expectedSchema: Schema.String,
    responseBody: Schema.String,
    parseError: Schema.Defect,
  },
) {}

export class CacheMissError extends Schema.TaggedError<CacheMissError>()(
  "CacheMissError",
  {
    key: Schema.String,
  },
) {}

export class CacheExpiredError extends Schema.TaggedError<CacheExpiredError>()(
  "CacheExpiredError",
  {
    key: Schema.String,
    cachedAt: Schema.Date,
    expiresAt: Schema.Date,
  },
) {}

export class CacheFullError extends Schema.TaggedError<CacheFullError>()(
  "CacheFullError",
  {
    maxSize: Schema.Number,
    currentSize: Schema.Number,
  },
) {}

export class FileSystemError extends Schema.TaggedError<FileSystemError>()(
  "FileSystemError",
  {
    operation: Schema.String,
    path: Schema.String,
    error: Schema.Defect,
  },
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    field: Schema.String,
    value: Schema.String,
    message: Schema.String,
  },
) {}

export class LocationNotFoundError extends Schema.TaggedError<LocationNotFoundError>()(
  "LocationNotFoundError",
  {
    locationId: Schema.String,
  },
) {}

export class TimeoutError extends Schema.TaggedError<TimeoutError>()(
  "TimeoutError",
  {
    operation: Schema.String,
    timeoutMs: Schema.Number,
  },
) {}

export class ConfigError extends Schema.TaggedError<ConfigError>()(
  "ConfigError",
  {
    key: Schema.String,
    message: Schema.String,
  },
) {}

export type WeatherAppError =
  | NetworkEerror
  | HttpError
  | RateLimitError
  | InvalidResponseError
  | CacheMissError
  | CacheFullError
  | CacheExpiredError
  | FileSystemError
  | ValidationError
  | LocationNotFoundError
  | TimeoutError
  | ConfigError;
