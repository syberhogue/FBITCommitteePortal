export type RichTextMark = {
  type: "bold" | "italic" | "strike" | "code" | "textStyle";
  attrs?: { fontSize?: string };
};

export type RichTextNode = {
  type:
    | "doc"
    | "paragraph"
    | "heading"
    | "bulletList"
    | "orderedList"
    | "listItem"
    | "blockquote"
    | "horizontalRule"
    | "hardBreak"
    | "text";
  attrs?: { level?: number; fontSize?: string };
  content?: RichTextNode[];
  marks?: RichTextMark[];
  text?: string;
};

export type RichTextDocument = RichTextNode & { type: "doc" };

export const fontSizes = ["12px", "14px", "16px", "18px", "24px", "32px"] as const;

const containerTypes = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
]);
const leafTypes = new Set(["horizontalRule", "hardBreak"]);
const markTypes = new Set(["bold", "italic", "strike", "code", "textStyle"]);

function cleanMark(value: unknown): RichTextMark | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { type?: unknown; attrs?: unknown };
  if (typeof candidate.type !== "string" || !markTypes.has(candidate.type)) return null;
  if (candidate.type !== "textStyle") return { type: candidate.type as RichTextMark["type"] };
  const fontSize = (candidate.attrs as { fontSize?: unknown } | undefined)?.fontSize;
  if (typeof fontSize !== "string" || !fontSizes.includes(fontSize as (typeof fontSizes)[number])) {
    return null;
  }
  return { type: "textStyle", attrs: { fontSize } };
}

function cleanNode(value: unknown): RichTextNode | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    type?: unknown;
    attrs?: unknown;
    content?: unknown;
    marks?: unknown;
    text?: unknown;
  };
  if (candidate.type === "text" && typeof candidate.text === "string") {
    const marks = Array.isArray(candidate.marks)
      ? candidate.marks.map(cleanMark).filter((mark): mark is RichTextMark => Boolean(mark))
      : undefined;
    return { type: "text", text: candidate.text, ...(marks?.length ? { marks } : {}) };
  }
  if (typeof candidate.type !== "string") return null;
  if (leafTypes.has(candidate.type)) return { type: candidate.type as RichTextNode["type"] };
  if (!containerTypes.has(candidate.type)) return null;
  const content = Array.isArray(candidate.content)
    ? candidate.content.map(cleanNode).filter((node): node is RichTextNode => Boolean(node))
    : [];
  if (candidate.type === "heading") {
    const requestedLevel = (candidate.attrs as { level?: unknown } | undefined)?.level;
    const level =
      requestedLevel === 1 || requestedLevel === 2 || requestedLevel === 3 ? requestedLevel : 2;
    return { type: "heading", attrs: { level }, content };
  }
  return { type: candidate.type as RichTextNode["type"], content };
}

function legacyDocument(value: string): RichTextDocument {
  const lines = value.split(/\r?\n/);
  return {
    type: "doc",
    content: (lines.length ? lines : [""]).map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

export function parseRichText(value: string | null | undefined): RichTextDocument {
  const source = value?.trim() ?? "";
  if (!source.startsWith("{")) return legacyDocument(value ?? "");
  try {
    const cleaned = cleanNode(JSON.parse(source));
    if (cleaned?.type === "doc") return cleaned as RichTextDocument;
  } catch {
    // Invalid or legacy content is rendered as text, never interpreted as markup.
  }
  return legacyDocument(value ?? "");
}

export function serializeRichText(value: string, maxLength: number): string {
  const serialized = JSON.stringify(parseRichText(value));
  if (serialized.length > maxLength) throw new Error("Formatted text is too long.");
  return serialized;
}

export function richTextPlainText(value: string | null | undefined): string {
  const text: string[] = [];
  const visit = (node: RichTextNode) => {
    if (node.type === "text" && node.text) text.push(node.text);
    node.content?.forEach(visit);
    if (["paragraph", "heading", "listItem", "blockquote"].includes(node.type)) text.push("\n");
  };
  visit(parseRichText(value));
  return text.join(" ").replace(/\s+/g, " ").trim();
}
