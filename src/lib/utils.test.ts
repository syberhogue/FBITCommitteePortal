import { describe, expect, it } from "vitest";
import { cn, formatBytes, initials } from "./utils";

describe("UI utilities", () => {
  it("joins only active classes", () => expect(cn("a", false, undefined, "b")).toBe("a b"));
  it("formats byte counts", () => expect(formatBytes(1536)).toBe("1.5 KB"));
  it("creates two-letter initials", () => expect(initials("Ada Lovelace Byron")).toBe("AL"));
});
