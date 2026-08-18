import { Fragment, type ReactNode } from "react";
import {
  parseRichText,
  richTextPlainText,
  type RichTextMark,
  type RichTextNode,
} from "@/lib/rich-text";
import { cn } from "@/lib/utils";

function withMarks(content: ReactNode, marks: RichTextMark[] | undefined, key: string): ReactNode {
  if (!marks?.length) return content;
  return marks.reduce<ReactNode>((child, mark, index) => {
    const markKey = `${key}-mark-${index}`;
    if (mark.type === "bold") return <strong key={markKey}>{child}</strong>;
    if (mark.type === "italic") return <em key={markKey}>{child}</em>;
    if (mark.type === "strike") return <s key={markKey}>{child}</s>;
    if (mark.type === "code") return <code key={markKey}>{child}</code>;
    if (mark.type === "textStyle" && mark.attrs?.fontSize) {
      return (
        <span key={markKey} style={{ fontSize: mark.attrs.fontSize }}>
          {child}
        </span>
      );
    }
    return child;
  }, content);
}

function renderNode(node: RichTextNode, key: string): ReactNode {
  if (node.type === "text") return withMarks(node.text, node.marks, key);
  const children = node.content?.map((child, index) => (
    <Fragment key={`${key}-${index}`}>{renderNode(child, `${key}-${index}`)}</Fragment>
  ));
  if (node.type === "doc") return children;
  if (node.type === "paragraph") return <p>{children?.length ? children : <br />}</p>;
  if (node.type === "heading") {
    if (node.attrs?.level === 1) return <h2>{children}</h2>;
    if (node.attrs?.level === 3) return <h4>{children}</h4>;
    return <h3>{children}</h3>;
  }
  if (node.type === "bulletList") return <ul>{children}</ul>;
  if (node.type === "orderedList") return <ol>{children}</ol>;
  if (node.type === "listItem") return <li>{children}</li>;
  if (node.type === "blockquote") return <blockquote>{children}</blockquote>;
  if (node.type === "horizontalRule") return <hr />;
  if (node.type === "hardBreak") return <br />;
  return null;
}

export function RichTextView({
  value,
  emptyText,
  compact = false,
}: {
  value: string;
  emptyText: string;
  compact?: boolean;
}) {
  const document = parseRichText(value);
  const hasText = richTextPlainText(value).length > 0;
  if (!hasText) return <p className="italic text-slate-400">{emptyText}</p>;
  return (
    <div className={cn("rich-text-view", compact && "rich-text-view-compact")}>
      {renderNode(document, "root")}
    </div>
  );
}
