import { describe, expect, it } from "vitest";

import {
  parseWranglerConfig,
  validateDeployConfig,
} from "./check-deploy-config.mjs";

const validConfig = {
  name: "research-community-hub",
  main: ".open-next/worker.js",
  compatibility_date: "2026-07-14",
  compatibility_flags: ["nodejs_compat"],
  assets: {
    directory: ".open-next/assets",
    binding: "ASSETS",
  },
  d1_databases: [
    {
      binding: "DB",
      database_name: "research-community-hub",
      database_id: "123e4567-e89b-42d3-a456-426614174000",
      preview_database_id: "223e4567-e89b-42d3-a456-426614174001",
    },
  ],
  r2_buckets: [
    {
      binding: "MEDIA_BUCKET",
      bucket_name: "research-community-hub-media",
    },
  ],
};

describe("deployment configuration validation", () => {
  it("accepts a complete production configuration", () => {
    expect(validateDeployConfig(validConfig)).toEqual([]);
  });

  it("rejects zero D1 placeholders for a production deploy", () => {
    const errors = validateDeployConfig({
      ...validConfig,
      d1_databases: [
        {
          ...validConfig.d1_databases[0],
          database_id: "00000000-0000-0000-0000-000000000000",
          preview_database_id: "00000000-0000-0000-0000-000000000000",
        },
      ],
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("database_id 仍是全零占位符"),
        expect.stringContaining("preview_database_id 仍是全零占位符"),
      ]),
    );
  });

  it("allows placeholders only for CI structure validation", () => {
    expect(
      validateDeployConfig(
        {
          ...validConfig,
          d1_databases: [
            {
              ...validConfig.d1_databases[0],
              database_id: "00000000-0000-0000-0000-000000000000",
              preview_database_id:
                "00000000-0000-0000-0000-000000000000",
            },
          ],
        },
        { allowPlaceholders: true },
      ),
    ).toEqual([]);
  });

  it("rejects missing bindings and incompatible OpenNext fields", () => {
    const errors = validateDeployConfig({
      main: "worker.js",
      compatibility_date: "2024-01-01",
      compatibility_flags: [],
      assets: {},
      d1_databases: [],
      r2_buckets: [],
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("main"),
        expect.stringContaining("assets.directory"),
        expect.stringContaining("ASSETS"),
        expect.stringContaining("nodejs_compat"),
        expect.stringContaining("compatibility_date"),
        expect.stringContaining('binding="DB"'),
        expect.stringContaining('binding="MEDIA_BUCKET"'),
      ]),
    );
  });

  it("parses JSONC comments and trailing commas", () => {
    const parsed = parseWranglerConfig(`{
      // comment
      "main": ".open-next/worker.js",
      "compatibility_flags": ["nodejs_compat",],
    }`);

    expect(parsed).toEqual({
      main: ".open-next/worker.js",
      compatibility_flags: ["nodejs_compat"],
    });
  });
});
