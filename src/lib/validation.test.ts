import { describe, expect, it } from "vitest";
import { postgresUuid } from "./validation";

describe("postgresUuid", () => {
  it("accepts deterministic PostgreSQL UUIDs used by local seed records", () => {
    expect(postgresUuid.safeParse("10000000-0000-0000-0000-000000000001").success).toBe(true);
    expect(postgresUuid.safeParse("00000000-0000-0000-0000-000000000003").success).toBe(true);
  });

  it("accepts RFC UUIDs generated in production and rejects malformed IDs", () => {
    expect(postgresUuid.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    expect(postgresUuid.safeParse("not-a-uuid").success).toBe(false);
  });
});
