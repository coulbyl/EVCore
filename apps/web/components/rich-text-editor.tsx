"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import {
  Bold,
  Copy,
  ExternalLink,
  Italic,
  Link2,
  List,
  ListOrdered,
  X,
} from "lucide-react";
import { Button, Input, cn } from "@evcore/ui";
import { CopyBlockExtension } from "./copy-block-node";

type ToolbarInput =
  | { type: "link"; value: string }
  | { type: "copyBlock"; value: string }
  | null;

type Props = {
  value?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: Props) {
  const [toolbarInput, setToolbarInput] = useState<ToolbarInput>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: "text-primary underline cursor-pointer",
            target: "_blank",
            rel: "noopener noreferrer",
          },
        },
      }),
      CopyBlockExtension,
    ],
    content: value ?? "",
    onUpdate({ editor: e }) {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[120px] px-3 py-2 text-sm",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value === "" && !editor.isEmpty) {
      editor.commands.clearContent();
    }
  }, [editor, value]);

  function applyLink() {
    if (!editor || toolbarInput?.type !== "link") return;
    const raw = toolbarInput.value.trim();
    if (raw) {
      const href =
        raw.startsWith("http://") ||
        raw.startsWith("https://") ||
        raw.startsWith("/") ||
        raw.startsWith("mailto:")
          ? raw
          : `https://${raw}`;
      editor.chain().focus().setLink({ href }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setToolbarInput(null);
  }

  function applyCopyBlock() {
    if (!editor || toolbarInput?.type !== "copyBlock") return;
    const text = toolbarInput.value.trim();
    if (text) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "copyBlock", attrs: { text } })
        .run();
    }
    setToolbarInput(null);
  }

  function handleLinkButton() {
    if (!editor) return;
    if (toolbarInput?.type === "link") {
      setToolbarInput(null);
      return;
    }
    const existing = editor.getAttributes("link").href as string | undefined;
    setToolbarInput({ type: "link", value: existing ?? "" });
  }

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-background focus-within:ring-1 focus-within:ring-ring",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Gras"
        >
          <Bold size={13} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italique"
        >
          <Italic size={13} />
        </ToolbarBtn>

        <div className="mx-1 h-4 w-px bg-border" />

        <ToolbarBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Liste à puces"
        >
          <List size={13} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Liste ordonnée"
        >
          <ListOrdered size={13} />
        </ToolbarBtn>

        <div className="mx-1 h-4 w-px bg-border" />

        <ToolbarBtn
          active={editor.isActive("link") || toolbarInput?.type === "link"}
          onClick={handleLinkButton}
          label="Lien"
        >
          <Link2 size={13} />
        </ToolbarBtn>
        <ToolbarBtn
          active={toolbarInput?.type === "copyBlock"}
          onClick={() =>
            setToolbarInput(
              toolbarInput?.type === "copyBlock"
                ? null
                : { type: "copyBlock", value: "" },
            )
          }
          label="Bloc copiable"
        >
          <Copy size={13} />
        </ToolbarBtn>
      </div>

      {/* Link preview bubble when cursor is inside a link */}
      {editor.isActive("link") && toolbarInput?.type !== "link" && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          <ExternalLink size={11} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {editor.getAttributes("link").href as string}
          </span>
          <button
            type="button"
            className="shrink-0 text-destructive hover:opacity-80"
            onClick={() => editor.chain().focus().unsetLink().run()}
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Inline input for link / copyBlock */}
      {toolbarInput !== null && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <Input
            autoFocus
            value={toolbarInput.value}
            onChange={(e) =>
              setToolbarInput({ ...toolbarInput, value: e.target.value })
            }
            placeholder={
              toolbarInput.type === "link"
                ? "https://..."
                : "Texte à copier (ex: h12GR)"
            }
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (toolbarInput.type === "link") applyLink();
                else applyCopyBlock();
              }
              if (e.key === "Escape") setToolbarInput(null);
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 rounded-lg"
            onClick={() =>
              toolbarInput.type === "link" ? applyLink() : applyCopyBlock()
            }
          >
            OK
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded"
            onClick={() => setToolbarInput(null)}
          >
            <X size={13} />
          </Button>
        </div>
      )}

      {/* Editor area */}
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <p className="pointer-events-none absolute left-3 top-2 select-none text-sm text-muted-foreground">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} className="rt-content" />
      </div>
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7 rounded", active && "bg-muted")}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </Button>
  );
}
