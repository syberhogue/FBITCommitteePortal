"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { fontSizes, parseRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

const toolbarButton =
  "grid size-8 place-items-center rounded border border-transparent text-[#003C71] hover:border-[#0077CA] hover:bg-[#eef6fb] aria-pressed:border-[#0077CA] aria-pressed:bg-[#eef6fb]";

export function RichTextEditor({
  name,
  label,
  initialValue,
  compact = false,
}: {
  name: string;
  label: string;
  initialValue: string;
  compact?: boolean;
}) {
  const [initialSerialized] = useState(() => JSON.stringify(parseRichText(initialValue)));
  const serializedInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, FontSize],
    content: parseRichText(initialValue),
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      if (serializedInput.current) {
        serializedInput.current.value = JSON.stringify(current.getJSON());
      }
    },
    editorProps: {
      attributes: {
        class: cn(
          "rich-text-editor min-h-36 px-3 py-3 text-sm focus:outline-none",
          compact && "min-h-28",
        ),
        "aria-label": label,
      },
    },
  });

  useEffect(() => {
    const input = serializedInput.current;
    const form = input?.form;
    if (!editor || !input || !form) return;

    const syncEditor = () => {
      input.value = JSON.stringify(editor.getJSON());
    };
    const syncFormData = (event: FormDataEvent) => {
      syncEditor();
      event.formData.set(name, input.value);
    };

    form.addEventListener("submit", syncEditor, true);
    form.addEventListener("formdata", syncFormData);
    return () => {
      form.removeEventListener("submit", syncEditor, true);
      form.removeEventListener("formdata", syncFormData);
    };
  }, [editor, name]);

  const command = (callback: () => void) => {
    callback();
    editor?.commands.focus();
  };

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-[#0077CA] focus-within:ring-2 focus-within:ring-[#0077CA]/20">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
          <button
            type="button"
            className={toolbarButton}
            aria-label="Bold"
            aria-pressed={editor?.isActive("bold") ?? false}
            onClick={() => command(() => editor?.chain().focus().toggleBold().run())}
          >
            <Bold className="size-4" />
          </button>
          <button
            type="button"
            className={toolbarButton}
            aria-label="Italic"
            aria-pressed={editor?.isActive("italic") ?? false}
            onClick={() => command(() => editor?.chain().focus().toggleItalic().run())}
          >
            <Italic className="size-4" />
          </button>
          <button
            type="button"
            className={toolbarButton}
            aria-label="Strikethrough"
            aria-pressed={editor?.isActive("strike") ?? false}
            onClick={() => command(() => editor?.chain().focus().toggleStrike().run())}
          >
            <Strikethrough className="size-4" />
          </button>
          <span className="mx-1 h-6 w-px bg-slate-300" />
          <button
            type="button"
            className={toolbarButton}
            aria-label="Bulleted list"
            aria-pressed={editor?.isActive("bulletList") ?? false}
            onClick={() => command(() => editor?.chain().focus().toggleBulletList().run())}
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            className={toolbarButton}
            aria-label="Numbered list"
            aria-pressed={editor?.isActive("orderedList") ?? false}
            onClick={() => command(() => editor?.chain().focus().toggleOrderedList().run())}
          >
            <ListOrdered className="size-4" />
          </button>
          <button
            type="button"
            className={toolbarButton}
            aria-label="Block quote"
            aria-pressed={editor?.isActive("blockquote") ?? false}
            onClick={() => command(() => editor?.chain().focus().toggleBlockquote().run())}
          >
            <Quote className="size-4" />
          </button>
          <select
            aria-label="Font size"
            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700"
            value={editor?.getAttributes("textStyle").fontSize ?? ""}
            onChange={(event) => {
              const size = event.target.value;
              if (size) editor?.chain().focus().setFontSize(size).run();
              else editor?.chain().focus().unsetFontSize().run();
            }}
          >
            <option value="">Normal size</option>
            {fontSizes.map((size) => (
              <option key={size} value={size}>
                {size.replace("px", " px")}
              </option>
            ))}
          </select>
          <span className="mx-1 h-6 w-px bg-slate-300" />
          <button
            type="button"
            className={toolbarButton}
            aria-label="Clear formatting"
            onClick={() =>
              command(() => editor?.chain().focus().clearNodes().unsetAllMarks().run())
            }
          >
            <RemoveFormatting className="size-4" />
          </button>
          <button
            type="button"
            className={toolbarButton}
            aria-label="Undo"
            disabled={!editor?.can().undo()}
            onClick={() => command(() => editor?.chain().focus().undo().run())}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            className={toolbarButton}
            aria-label="Redo"
            disabled={!editor?.can().redo()}
            onClick={() => command(() => editor?.chain().focus().redo().run())}
          >
            <Redo2 className="size-4" />
          </button>
        </div>
        <EditorContent editor={editor} />
      </div>
      <input ref={serializedInput} type="hidden" name={name} defaultValue={initialSerialized} />
    </div>
  );
}
