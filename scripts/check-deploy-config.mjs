import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MINIMUM_COMPATIBILITY_DATE = "2024-09-23";

function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
        output += character;
      }
      continue;
    }

    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      } else if (character === "\n") {
        output += character;
      }
      continue;
    }

    if (inString) {
      output += character;

      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }

    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    output += character;
  }

  return output.replace(/,\s*([}\]])/g, "$1");
}

export function parseWranglerConfig(source) {
  return JSON.parse(stripJsonComments(source));
}

function isValidUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function validateDeployConfig(config, options = {}) {
  const allowPlaceholders = options.allowPlaceholders === true;
  const errors = [];

  if (!config || typeof config !== "object") {
    return ["wrangler.jsonc 必须包含一个配置对象"];
  }

  if (config.main !== ".open-next/worker.js") {
    errors.push('main 必须为 ".open-next/worker.js"');
  }

  if (!config.assets || config.assets.directory !== ".open-next/assets") {
    errors.push('assets.directory 必须为 ".open-next/assets"');
  }

  if (config.assets?.binding !== "ASSETS") {
    errors.push('静态资源 Binding 必须命名为 "ASSETS"');
  }

  if (!Array.isArray(config.compatibility_flags)) {
    errors.push("compatibility_flags 必须是数组");
  } else if (!config.compatibility_flags.includes("nodejs_compat")) {
    errors.push('compatibility_flags 必须包含 "nodejs_compat"');
  }

  if (
    typeof config.compatibility_date !== "string" ||
    config.compatibility_date < MINIMUM_COMPATIBILITY_DATE
  ) {
    errors.push(
      `compatibility_date 必须不早于 ${MINIMUM_COMPATIBILITY_DATE}`,
    );
  }

  const databases = Array.isArray(config.d1_databases)
    ? config.d1_databases
    : [];
  const database = databases.find((item) => item?.binding === "DB");

  if (!database) {
    errors.push('缺少 binding="DB" 的 D1 配置');
  } else {
    if (database.database_name !== "research-community-hub") {
      errors.push('D1 database_name 必须为 "research-community-hub"');
    }

    for (const field of ["database_id", "preview_database_id"]) {
      const value = database[field];

      if (!isValidUuid(value)) {
        errors.push(`D1 ${field} 必须是有效 UUID`);
      } else if (!allowPlaceholders && value === ZERO_UUID) {
        errors.push(
          `D1 ${field} 仍是全零占位符，请创建 Cloudflare D1 后替换真实 UUID`,
        );
      }
    }
  }

  const buckets = Array.isArray(config.r2_buckets) ? config.r2_buckets : [];
  const mediaBucket = buckets.find((item) => item?.binding === "MEDIA_BUCKET");

  if (!mediaBucket) {
    errors.push('缺少 binding="MEDIA_BUCKET" 的 R2 配置');
  } else if (mediaBucket.bucket_name !== "research-community-hub-media") {
    errors.push('R2 bucket_name 必须为 "research-community-hub-media"');
  }

  return errors;
}

async function main() {
  const allowPlaceholders = process.argv.includes("--allow-placeholders");
  const configUrl = new URL("../wrangler.jsonc", import.meta.url);
  let config;

  try {
    const source = await readFile(configUrl, "utf8");
    config = parseWranglerConfig(source);
  } catch (error) {
    console.error("无法读取或解析 wrangler.jsonc");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const errors = validateDeployConfig(config, { allowPlaceholders });

  if (errors.length > 0) {
    console.error("Cloudflare 部署配置未通过检查：");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    allowPlaceholders
      ? "Cloudflare 配置结构有效（CI 允许 D1 占位 UUID）。"
      : "Cloudflare 生产部署配置检查通过。",
  );
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
