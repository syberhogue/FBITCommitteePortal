import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichTextView } from "./rich-text-view";

describe("RichTextView", () => {
  it("renders ordinary agenda text without requiring formatting marks", () => {
    const value = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Review and approve the agenda" }],
        },
      ],
    });

    render(<RichTextView value={value} emptyText="No agenda." />);

    expect(screen.getByText("Review and approve the agenda")).toBeVisible();
  });
});
