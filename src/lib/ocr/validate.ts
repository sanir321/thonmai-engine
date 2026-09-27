/**
 * Upload hardening.
 *
 * A file extension and a client-supplied MIME type are both trivially forged, so
 * neither is trusted. The type is decided by reading the file's own magic bytes,
 * and the size is capped before anything is decoded.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export type UploadKind = "pdf" | "png" | "jpeg";

export interface SniffedUpload {
  kind: UploadKind;
  mime: string;
}

export class UploadRejected extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "UploadRejected";
    this.status = status;
  }
}

const SIGNATURES: {
  kind: UploadKind;
  mime: string;
  offset: number;
  bytes: readonly number[];
  /** Optional trailing marker, e.g. a PDF `%%EOF`. */
  tail?: readonly number[];
}[] = [
  { kind: "pdf", mime: "application/pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  { kind: "png", mime: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { kind: "jpeg", mime: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
];

function startsWith(buf: Buffer, bytes: readonly number[], offset: number): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buf[offset + i] === byte);
}

/**
 * Returns the real type, or throws. A mismatch against the declared type is
 * rejected outright rather than silently corrected: a client sending
 * `image/png` for a PDF is either broken or probing.
 */
export function sniffUpload(bytes: Buffer, declaredMime?: string | null): SniffedUpload {
  if (bytes.length === 0) throw new UploadRejected("That file is empty.");
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new UploadRejected(
      "That file is larger than 8 MB. Please upload a smaller scan or photo.",
      413,
    );
  }

  const match = SIGNATURES.find((s) => startsWith(bytes, s.bytes, s.offset));
  if (!match) {
    throw new UploadRejected("Please upload a PDF, PNG, or JPEG file.");
  }

  if (declaredMime && declaredMime !== "application/octet-stream") {
    const declared = declaredMime.split(";")[0]?.trim().toLowerCase();
    const compatible =
      declared === match.mime ||
      // Browsers frequently label a PDF as octet-stream or a generic type.
      (match.kind === "pdf" && declared === "application/x-pdf");
    if (!compatible) {
      throw new UploadRejected(
        `That file looks like ${match.mime} but was sent as ${declared}.`,
      );
    }
  }

  return { kind: match.kind, mime: match.mime };
}

/**
 * Rejects the polyglot tricks used to smuggle a script past a naive check: a
 * PDF or image must not contain an HTML `<script`, a PHP tag, or an ELF header.
 */
export function looksLikeExecutableOrScript(bytes: Buffer): boolean {
  const head = bytes.subarray(0, 64 * 1024).toString("latin1").toLowerCase();
  if (head.startsWith("\x7felf")) return true;
  const markers = ["<script", "<?php", "<!doctype html", "<html"];
  return markers.some((m) => head.includes(m));
}

/** Magic-byte check is not enough: make sure the last bytes look finished too. */
export function hasTruncatedTail(bytes: Buffer, kind: UploadKind): boolean {
  if (kind !== "pdf") return false;
  const tail = bytes.subarray(Math.max(0, bytes.length - 2048)).toString("latin1");
  return !tail.includes("%%EOF");
}
