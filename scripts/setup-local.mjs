import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env"))
  throw new Error(".env already exists; preserve existing configuration.");
const database =
  "postgres://postgres:postgres@localhost:51217/template1?sslmode=disable&connection_limit=1&pgbouncer=true&connect_timeout=15&pool_timeout=15";
writeFileSync(
  ".env",
  `DATABASE_URL="${database}"\nDIRECT_URL="${database}"\nAUTH_SECRET="${randomBytes(48).toString("base64url")}"\nAUTH_URL="http://localhost:3000"\nENABLE_DEMO_AUTH="true"\nDEMO_PASSWORD="${randomBytes(24).toString("base64url")}"\n`,
);
console.log("Local environment created. Secrets were not printed.");
