import type { DocumentAttachment, ImageAttachment, MessageContentPart } from "@tinyclaw/core/contract";
import { normalizeDocumentMediaType, parseDataUrl, parseDocumentDataUrl } from "@tinyclaw/core/message-content";
import type { FileUIPart } from "ai";
import {
  documentDisplayFromContentPart,
  documentDisplayFromFilePart,
  type DisplayDocument,
} from "@/lib/pasted-text";

export const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp";

export const DOCUMENT_ACCEPT =
  ".pdf,.docx,.csv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv";

export const ALL_ATTACHMENT_ACCEPT = `${IMAGE_ACCEPT},${DOCUMENT_ACCEPT}`;

export function isImageFilePart(file: FileUIPart): boolean {
  return Boolean(file.mediaType?.startsWith("image/"));
}

export function isDocumentFilePart(file: FileUIPart): boolean {
  if (isImageFilePart(file)) {
    return false;
  }

  const filename = file.filename ?? "";
  const mediaType = normalizeDocumentMediaType(file.mediaType ?? "", filename);
  return (
    mediaType === "application/pdf" ||
    mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mediaType === "text/plain" ||
    mediaType === "text/csv"
  );
}

export function filePartsToImageAttachments(files: FileUIPart[]): ImageAttachment[] {
  const images: ImageAttachment[] = [];

  for (const file of files) {
    if (!isImageFilePart(file)) {
      continue;
    }

    const parsed = parseDataUrl(file.url);

    if (parsed) {
      images.push(parsed);
    }
  }

  return images;
}

export function filePartsToDocumentAttachments(files: FileUIPart[]): DocumentAttachment[] {
  const documents: DocumentAttachment[] = [];

  for (const file of files) {
    if (!isDocumentFilePart(file)) {
      continue;
    }

    const filename = file.filename?.trim() || "document";
    const parsed = parseDocumentDataUrl(file.url, filename);

    if (parsed) {
      documents.push(parsed);
    }
  }

  return documents;
}

export function userContentToDisplayImages(
  content: string | MessageContentPart[],
): Array<{ url: string; mediaType: string }> {
  if (typeof content === "string") {
    return [];
  }

  return content
    .filter((part): part is Extract<typeof part, { type: "image" }> => part.type === "image")
    .map((part) => ({
      mediaType: part.mediaType,
      url: `data:${part.mediaType};base64,${part.data}`,
    }));
}

export function filePartsToDisplayDocuments(files: FileUIPart[]): DisplayDocument[] {
  const documents: DisplayDocument[] = [];

  for (const file of files) {
    if (!isDocumentFilePart(file)) {
      continue;
    }

    documents.push(documentDisplayFromFilePart(file));
  }

  return documents;
}

export function userContentToDisplayDocuments(
  content: string | MessageContentPart[],
): DisplayDocument[] {
  if (typeof content === "string") {
    return [];
  }

  return content
    .filter((part): part is Extract<typeof part, { type: "document" }> => part.type === "document")
    .map((part) => documentDisplayFromContentPart(part));
}
