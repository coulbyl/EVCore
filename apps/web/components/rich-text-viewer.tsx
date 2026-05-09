"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";
import { cn } from "@evcore/ui";
import { CopyBlockExtension } from "./copy-block-node";
import { LinkPreviewCard } from "./link-preview-card";

function extractExternalUrls(html: string): string[] {
  const seen = new Set<string>();
  const regex = /href="(https?:\/\/[^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    if (url && !seen.has(url)) seen.add(url);
  }
  return Array.from(seen);
}

type Props = {
  content: string;
  className?: string;
};

export function RichTextViewer({ content, className }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        link: {
          openOnClick: true,
          HTMLAttributes: {
            class: "text-primary underline cursor-pointer",
            target: "_blank",
            rel: "noopener noreferrer",
          },
        },
      }),
      CopyBlockExtension,
    ],
    content,
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  const urls = useMemo(() => extractExternalUrls(content), [content]);

  if (!editor) return null;

  return (
    <div className={cn("rt-content text-sm", className)}>
      <EditorContent editor={editor} />
      {urls.map((url) => (
        <LinkPreviewCard key={url} url={url} />
      ))}
    </div>
  );
}
