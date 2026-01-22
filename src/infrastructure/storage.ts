import { Context, Effect, Layer, ParseResult, Schema } from "effect";
import { join } from "node:path";
import { promises as fs } from "node:fs";
import { StorageConfigType } from "src/domain/config.js";
import { Location, WeatherReading } from "src/domain/models.js";
import { FileSystemError } from "src/errors/index.js";

export class Storage extends Context.Tag("Storage")<
  Storage,
  {
    readonly saveLocations: (
      locations: Location[],
    ) => Effect.Effect<void, FileSystemError | ParseResult.ParseError>;
    readonly loadLocations: () => Effect.Effect<
      Location[],
      FileSystemError | ParseResult.ParseError
    >;
    readonly saveReadings: (
      readings: WeatherReading[],
    ) => Effect.Effect<void, FileSystemError | ParseResult.ParseError>;

    readonly loadReadings: () => Effect.Effect<
      WeatherReading[],
      FileSystemError | ParseResult.ParseError
    >;
  }
>() {}

const makeFileStorage = (config: StorageConfigType) => {
  const locationsPath = join(config.dataDir, "locations.json");
  const readingsPath = join(config.dataDir, "readings.json");

  const ensureDir = Effect.tryPromise({
    try: () => fs.mkdir(config.dataDir, { recursive: true }),
    catch: (error) =>
      FileSystemError.make({
        operation: "mkdir",
        path: config.dataDir,
        error,
      }),
  });

  const saveData = <A, I>(
    filePath: string,
    data: A[],
    schema: Schema.Schema<A, I>,
  ): Effect.Effect<void, FileSystemError | ParseResult.ParseError> =>
    Effect.gen(function* () {
      yield* ensureDir;
      const encoded = yield* Effect.all(
        data.map((item) => Schema.encode(schema)(item)),
      );

      yield* Effect.tryPromise({
        try: () => fs.writeFile(filePath, JSON.stringify(encoded, null, 2)),
        catch: (error) =>
          FileSystemError.make({
            operation: "writeFile",
            path: filePath,
            error,
          }),
      });
    });

  const loadData = <A, I>(
    filePath: string,
    schema: Schema.Schema<A, I>,
  ): Effect.Effect<A[], FileSystemError | ParseResult.ParseError> =>
    Effect.gen(function* () {
      const content = yield* Effect.tryPromise({
        try: () => fs.readFile(filePath, "utf-8"),
        catch: (error) =>
          FileSystemError.make({
            operation: "readFile",
            path: filePath,
            error,
          }),
      });

      const parsed = JSON.parse(content) as I[];

      return yield* Effect.all(
        parsed.map((item) => Schema.decode(schema)(item)),
      );
    });

  return Storage.of({
    saveLocations: (locations: Location[]) =>
      saveData(locationsPath, locations, Location),
    loadLocations: () => loadData(locationsPath, Location),
    saveReadings: (readings: WeatherReading[]) =>
      saveData(readingsPath, readings, WeatherReading),
    loadReadings: () => loadData(readingsPath, WeatherReading),
  });
};

export const makeStorageLayer = (config: StorageConfigType) =>
  Layer.succeed(Storage, makeFileStorage(config));
