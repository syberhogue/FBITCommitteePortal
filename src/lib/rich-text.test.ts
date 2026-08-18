import { describe, expect, it } from "vitest";
import { parseRichText, richTextPlainText, serializeRichText } from "./rich-text";

describe("rich text persistence", () => {
  it("converts legacy plain text into safe paragraphs", () => {
    const document = parseRichText("Agenda item one\nAgenda item two");
    expect(document.content).toHaveLength(2);
    expect(richTextPlainText(JSON.stringify(document))).toBe("Agenda item one Agenda item two");
  });

  it("keeps supported formatting and removes unsupported content", () => {
    const source = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Approved", marks: [{ type: "bold" }] },
            { type: "script", text: "alert(1)" },
            {
              type: "text",
              text: " agenda",
              marks: [{ type: "textStyle", attrs: { fontSize: "16px;background:red" } }],
            },
          ],
        },
      ],
    });
    const serialized = serializeRichText(source, 5000);
    expect(serialized).toContain('"type":"bold"');
    expect(serialized).not.toContain("script");
    expect(serialized).not.toContain("background");
    expect(richTextPlainText(serialized)).toBe("Approved agenda");
  });

  it("enforces the persisted length limit", () => {
    expect(() => serializeRichText("x".repeat(200), 50)).toThrow("Formatted text is too long");
  });
});
