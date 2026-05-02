const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function normalizeConnectionString(raw) {
  // pg will interpret `sslmode` in the connection string and may override the
  // `ssl` option we pass. We strip it and control SSL explicitly.
  // NOTE: This intentionally trades strict verification for compatibility when
  // the runtime can't validate the chain (common on some Windows setups).
  // Some valid Postgres connection strings (notably Unix socket forms) are not
  // valid WHATWG URLs; in that case, keep the raw string untouched.
  try {
    const url = new URL(raw);
    const sslmode = url.searchParams.get("sslmode");
    if (sslmode) url.searchParams.delete("sslmode");
    return {
      connectionString: url.toString(),
      sslmode: sslmode ? sslmode.toLowerCase() : null,
    };
  } catch {
    return { connectionString: raw, sslmode: null };
  }
}

function usage() {
  console.log(
    [
      "Usage:",
      '  node scripts/run-sql.js "<DATABASE_URL>" "<path/to/file.sql>"',
      "",
      "Examples:",
      '  node scripts/run-sql.js "postgresql://user:pass@host:5432/db" "create_tables.sql"',
      '  node scripts/run-sql.js "postgresql://user:pass@host:5432/db?sslmode=require" "C:\\\\Users\\\\11\\\\Downloads\\\\User_rows.sql"',
    ].join("\n")
  );
}

async function main() {
  const [, , connectionString, sqlFileArg] = process.argv;

  if (!connectionString || !sqlFileArg) {
    usage();
    process.exit(1);
  }

  const sqlFilePath = path.resolve(sqlFileArg);
  const sql = fs.readFileSync(sqlFilePath, "utf8");

  const normalized = normalizeConnectionString(connectionString);
  const needsSsl = normalized.sslmode === "require" || normalized.sslmode === "verify-full";
  const client = new Client({
    connectionString: normalized.connectionString,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log(`OK: executed ${sqlFilePath}`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

