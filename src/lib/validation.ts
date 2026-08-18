import { z } from "zod";

// PostgreSQL accepts UUID-shaped identifiers regardless of RFC version/variant
// bits. `z.uuid()` is intentionally stricter, which rejects deterministic IDs
// used by the local seed data even though they are valid `uuid` column values.
export const postgresUuid = z.guid();
