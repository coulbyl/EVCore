"use client";

import { useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Copy, Check } from "lucide-react";

function CopyBlockNodeView({ node }: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const text = node.attrs["text"] as string;

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-sm align-middle text-foreground"
    >
      <span>{text}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Copier"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </NodeViewWrapper>
  );
}

export const CopyBlockExtension = Node.create({
  name: "copyBlock",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      text: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-copy-block]",
        getAttrs: (el) => ({
          text: (el as HTMLElement).getAttribute("data-text") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-copy-block": "",
        "data-text": node.attrs["text"] as string,
      }),
      node.attrs["text"] as string,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CopyBlockNodeView);
  },
});
