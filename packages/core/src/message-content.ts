import type { ChatMessage, ImageAttachment, MessageContentPart } from "./contract";
import { TinyClawApiError } from "./api-error";

export const MAX_IMAGES_PER_MESSAGE = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const TOKENS_PER_IMAGE_ESTIMATE = 1_500;

const ALLOWED_IMAGE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export function isMessageContentPartArray(
  content: string | MessageContentPart[],
): content is MessageContentPart[] {
  return Array.isArray(content);
}

export function normalizeUserContent(
  message: string,
  images?: ImageAttachment[],
): string | MessageContentPart[] {
  if (!images?.length) {
    return message;
  }

  validateImageAttachments(images);

  const parts: MessageContentPart[] = [];

  if (message.trim()) {
    parts.push({ type: "text", text: message });
  }

  for (const image of images) {
    parts.push({
      type: "image",
      mediaType: image.mediaType,
      data: image.data,
    });
  }

  if (parts.length === 0) {
    throw new TinyClawApiError("Message must include text or at least one image.", 400);
  }

  return parts;
}

export function validateImageAttachments(images: ImageAttachment[]): void {
  if (images.length > MAX_IMAGES_PER_MESSAGE) {
    throw new TinyClawApiError(
      `At most ${MAX_IMAGES_PER_MESSAGE} images per message.`,
      400,
    );
  }

  for (const image of images) {
    if (!ALLOWED_IMAGE_MEDIA_TYPES.has(image.mediaType)) {
      throw new TinyClawApiError(
        `Unsupported image type: ${image.mediaType}. Allowed: jpeg, png, gif, webp.`,
        400,
      );
    }

    const raw = image.data.trim();

    if (!raw) {
      throw new TinyClawApiError("Image data must not be empty.", 400);
    }

    const base64 = raw.includes(",") ? (raw.split(",")[1] ?? "") : raw;
    const byteLength = estimateBase64DecodedLength(base64);

    if (byteLength > MAX_IMAGE_BYTES) {
      throw new TinyClawApiError(
        `Each image must be at most ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`,
        400,
      );
    }
  }
}

function estimateBase64DecodedLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function getUserMessageText(content: string | MessageContentPart[]): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((part): part is Extract<MessageContentPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function countUserImages(content: string | MessageContentPart[]): number {
  if (typeof content === "string") {
    return 0;
  }

  return content.filter((part) => part.type === "image").length;
}

export function messageContentHasImages(content: string | MessageContentPart[]): boolean {
  return countUserImages(content) > 0;
}

export function messagesIncludeUserImages(messages: readonly ChatMessage[]): boolean {
  return messages.some(
    (message) => message.role === "user" && messageContentHasImages(message.content),
  );
}

export function estimateUserContentTokens(content: string | MessageContentPart[]): number {
  const text = getUserMessageText(content);
  const textTokens = Math.ceil(text.length / 4);
  const imageTokens = countUserImages(content) * TOKENS_PER_IMAGE_ESTIMATE;
  return textTokens + imageTokens;
}

export function stripImagesForCompaction(messages: readonly ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (message.role !== "user" || typeof message.content === "string") {
      return message;
    }

    const text = getUserMessageText(message.content);
    const imageCount = countUserImages(message.content);
    const suffix =
      imageCount > 0 ? `\n[${imageCount} image${imageCount === 1 ? "" : "s"} omitted from summary]` : "";

    return {
      role: "user",
      content: `${text}${suffix}`.trim() || "[image]",
    };
  });
}

export function parseDataUrl(dataUrl: string): ImageAttachment | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim());

  if (!match) {
    return null;
  }

  return {
    mediaType: match[1]!,
    data: match[2]!,
  };
}

export function toDataUrl(mediaType: string, base64: string): string {
  return `data:${mediaType};base64,${base64}`;
}

export function imageAttachmentFromBase64(
  mediaType: string,
  base64: string,
): ImageAttachment {
  const data = base64.includes(",") ? (base64.split(",")[1] ?? base64) : base64;
  return { mediaType, data };
}

export function toAnthropicUserContent(
  content: string | MessageContentPart[],
): string | Array<Record<string, unknown>> {
  if (typeof content === "string") {
    return content;
  }

  return content.map((part) => {
    if (part.type === "text") {
      return { type: "text", text: part.text };
    }

    return {
      type: "image",
      source: {
        type: "base64",
        media_type: part.mediaType,
        data: part.data,
      },
    };
  });
}

export function toOpenAIChatUserContent(
  content: string | MessageContentPart[],
): string | Array<Record<string, unknown>> {
  if (typeof content === "string") {
    return content;
  }

  return content.map((part) => {
    if (part.type === "text") {
      return { type: "text", text: part.text };
    }

    return {
      type: "image_url",
      image_url: { url: toDataUrl(part.mediaType, part.data) },
    };
  });
}

export function toOpenAIResponsesUserContent(
  content: string | MessageContentPart[],
): string | Array<Record<string, unknown>> {
  if (typeof content === "string") {
    return content;
  }

  return content.map((part) => {
    if (part.type === "text") {
      return { type: "input_text", text: part.text };
    }

    return {
      type: "input_image",
      image_url: toDataUrl(part.mediaType, part.data),
    };
  });
}
