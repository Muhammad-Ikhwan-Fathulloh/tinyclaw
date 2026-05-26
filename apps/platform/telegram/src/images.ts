import type { Context } from "grammy";
import type { ImageAttachment } from "@tinyclaw/core";
import { MAX_IMAGE_BYTES } from "@tinyclaw/core";

export interface TelegramImageInput {
  message: string;
  images: ImageAttachment[];
}

export async function buildTelegramImageInput(ctx: Context): Promise<TelegramImageInput | null> {
  const photos = ctx.message?.photo;

  if (photos?.length) {
    const largest = photos[photos.length - 1]!;

    return {
      message: ctx.message?.caption?.trim() ?? "",
      images: [await downloadTelegramImage(ctx, largest.file_id)],
    };
  }

  const document = ctx.message?.document;

  if (document?.mime_type?.startsWith("image/")) {
    return {
      message: ctx.message?.caption?.trim() ?? "",
      images: [await downloadTelegramImage(ctx, document.file_id)],
    };
  }

  return null;
}

export async function downloadTelegramImage(
  ctx: Context,
  fileId: string,
): Promise<ImageAttachment> {
  const file = await ctx.api.getFile(fileId);

  if (!file.file_path) {
    throw new Error("Telegram did not return a file path.");
  }

  const token = ctx.api.token;
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status}).`);
  }

  const bytes = await response.arrayBuffer();

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large. Maximum size is 5 MB.");
  }

  const mediaType = inferMediaType(file.file_path, response.headers.get("content-type"));

  return {
    mediaType,
    data: Buffer.from(bytes).toString("base64"),
  };
}

function inferMediaType(filePath: string, headerType: string | null): string {
  if (headerType?.startsWith("image/")) {
    return headerType.split(";")[0]!.trim();
  }

  const extension = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}
