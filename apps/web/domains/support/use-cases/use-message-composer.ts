"use client";

import { useCallback, useRef, useState } from "react";
import type {
  AttachmentUploadUrlResponse,
  SupportAttachment,
  SupportAttachmentKind,
  SupportMessage,
} from "../types/support";

let localIdCounter = 0;

// Prefixed and monotonic rather than crypto.randomUUID() — collision-proof
// enough for a purely local, single-tab-lifetime key, no crypto dependency.
function nextLocalId(): string {
  localIdCounter += 1;
  return `pending:${Date.now()}:${localIdCounter}`;
}

export type ComposerAttachmentInput = {
  file: File | Blob;
  kind: SupportAttachmentKind;
  mimeType: string;
  sizeBytes: number;
  fileName?: string;
  durationMs?: number;
  width?: number;
  height?: number;
};

type AttachmentRefForSend = {
  objectKey: string;
  kind: SupportAttachmentKind;
  fileName?: string;
  durationMs?: number;
  width?: number;
  height?: number;
};

// PUT with upload progress — fetch() has no upload-progress event, so this
// stays on XMLHttpRequest specifically for that.
function putWithProgress(
  url: string,
  file: File | Blob,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Échec de l'envoi du fichier (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Échec de l'envoi du fichier"));
    xhr.send(file);
  });
}

type PendingEntry = {
  message: SupportMessage;
  // Kept for retry — re-uploads from scratch rather than trying to resume,
  // simpler and attachments here are capped at 20MB (config/storage.constants.ts).
  content?: string;
  attachment?: ComposerAttachmentInput;
  objectUrl?: string; // revoked on drop to avoid leaking memory
};

/**
 * Optimistic send for the support chat composer, shared by the operator and
 * admin inboxes. Handles both plain text and attachments (voice notes,
 * images, files): an attachment shows an immediate local preview
 * (URL.createObjectURL) and an upload-progress bar, flips to "failed" with
 * everything preserved (text + file) if either the upload or the message
 * POST fails, and drops once the confirmed message lands in the cache (via
 * `onSent`, and/or the socket echo the caller's onSent also handles).
 *
 * Does not touch the query cache itself — callers own their own cache shape
 * and pass `onSent` to write the confirmed message in.
 */
export function useMessageComposer(options: {
  senderRole: "ADMIN" | "OPERATOR";
  requestUploadUrl: (meta: {
    kind: SupportAttachmentKind;
    mimeType: string;
    sizeBytes: number;
    fileName?: string;
  }) => Promise<AttachmentUploadUrlResponse>;
  sendFn: (input: {
    content?: string;
    attachment?: AttachmentRefForSend;
  }) => Promise<SupportMessage>;
  onSent: (message: SupportMessage) => void;
}) {
  const { senderRole } = options;
  const [pending, setPending] = useState<SupportMessage[]>([]);
  const entriesRef = useRef(new Map<string, PendingEntry>());
  // sendFn/requestUploadUrl/onSent are recreated every render (inline
  // closures at call sites) — a ref keeps attempt()/retry() from going
  // stale without forcing every caller to useCallback their arguments.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updatePending = useCallback(
    (localId: string, patch: Partial<SupportMessage>) => {
      setPending((prev) =>
        prev.map((m) => (m.id === localId ? { ...m, ...patch } : m)),
      );
    },
    [],
  );

  const attempt = useCallback(
    async (localId: string) => {
      const entry = entriesRef.current.get(localId);
      if (!entry) return;
      updatePending(localId, {
        status: "sending",
        uploadProgress: entry.attachment ? 0 : undefined,
      });

      try {
        let attachmentRef: AttachmentRefForSend | undefined;
        if (entry.attachment) {
          const {
            file,
            kind,
            mimeType,
            sizeBytes,
            fileName,
            durationMs,
            width,
            height,
          } = entry.attachment;
          const uploadInfo = await optionsRef.current.requestUploadUrl({
            kind,
            mimeType,
            sizeBytes,
            fileName,
          });
          await putWithProgress(uploadInfo.uploadUrl, file, mimeType, (pct) =>
            updatePending(localId, { uploadProgress: pct }),
          );
          attachmentRef = {
            objectKey: uploadInfo.objectKey,
            kind,
            fileName,
            durationMs,
            width,
            height,
          };
        }

        const message = await optionsRef.current.sendFn({
          content: entry.content,
          attachment: attachmentRef,
        });
        if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
        entriesRef.current.delete(localId);
        setPending((prev) => prev.filter((m) => m.id !== localId));
        optionsRef.current.onSent(message);
      } catch {
        updatePending(localId, { status: "failed" });
      }
    },
    [updatePending],
  );

  const send = useCallback(
    (content: string | undefined, attachment?: ComposerAttachmentInput) => {
      const localId = nextLocalId();
      const objectUrl = attachment
        ? URL.createObjectURL(attachment.file)
        : undefined;
      const previewAttachment: SupportAttachment | undefined = attachment
        ? {
            kind: attachment.kind,
            url: objectUrl!,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            fileName: attachment.fileName ?? null,
            durationMs: attachment.durationMs ?? null,
            width: attachment.width ?? null,
            height: attachment.height ?? null,
          }
        : undefined;

      const optimistic: SupportMessage = {
        id: localId,
        conversationId: "",
        senderId: "",
        senderRole,
        senderUsername: "",
        content: content ?? null,
        attachment: previewAttachment,
        createdAt: new Date().toISOString(),
        status: "sending",
        uploadProgress: attachment ? 0 : undefined,
      };
      entriesRef.current.set(localId, {
        message: optimistic,
        content,
        attachment,
        objectUrl,
      });
      setPending((prev) => [...prev, optimistic]);
      void attempt(localId);
    },
    [attempt, senderRole],
  );

  const retry = useCallback(
    (localId: string) => {
      if (!entriesRef.current.has(localId)) return;
      void attempt(localId);
    },
    [attempt],
  );

  const discard = useCallback((localId: string) => {
    const entry = entriesRef.current.get(localId);
    if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl);
    entriesRef.current.delete(localId);
    setPending((prev) => prev.filter((m) => m.id !== localId));
  }, []);

  return { pending, send, retry, discard };
}
