import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

import type { FileAttachment } from "@mains/contracts/runs";

const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export interface ComposerAttachment {
  id: string;
  name: string;
  type: "image" | "document";
  uri: string;
  mimeType: string;
  size?: number;
}

function imageMimeType(name: string, reportedType?: string | null): string {
  if (reportedType) return reportedType;
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  switch (extension) {
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    default:
      return "image/jpeg";
  }
}

function extensionForImageMime(mimeType: string): string {
  return mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
}

/** Pick phone-local images, matching the desktop's image attachment source. */
export async function pickComposerImages(): Promise<ComposerAttachment[]> {
  // PHPicker presents the photo library without granting the app blanket
  // access; iOS only hands us the assets the user explicitly selects.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsMultipleSelection: true,
    selectionLimit: 0,
    orderedSelection: true,
    quality: 1,
    shouldDownloadFromNetwork: true,
  });
  if (result.canceled) return [];

  return result.assets.map((asset, index) => {
    const fallbackMimeType = imageMimeType("image.jpg", asset.mimeType);
    const name =
      asset.fileName?.trim() ||
      `image-${Date.now()}-${index + 1}.${extensionForImageMime(fallbackMimeType)}`;
    return {
      id: `image:${asset.assetId ?? asset.uri}`,
      name,
      type: "image" as const,
      uri: asset.uri,
      mimeType: imageMimeType(name, asset.mimeType),
      size: asset.fileSize,
    };
  });
}

/** Pick the same document families the desktop composer accepts. */
export async function pickComposerDocuments(): Promise<ComposerAttachment[]> {
  const result = await File.pickFileAsync({
    mimeTypes: [...DOCUMENT_MIME_TYPES],
    multipleFiles: true,
  });
  if (result.canceled) return [];

  return result.result.map((file) => ({
    id: `document:${file.uri}`,
    name: file.name,
    type: "document" as const,
    uri: file.uri,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  }));
}

/** Preserve insertion order while ignoring the same picked file twice. */
export function mergeComposerAttachments(
  current: ComposerAttachment[],
  picked: ComposerAttachment[],
): ComposerAttachment[] {
  const ids = new Set(current.map((attachment) => attachment.id));
  const merged = [...current];
  for (const attachment of picked) {
    if (ids.has(attachment.id)) continue;
    ids.add(attachment.id);
    merged.push(attachment);
  }
  return merged;
}

/** Read bytes only at send time so idle composer state stays lightweight. */
export async function serializeComposerAttachments(
  attachments: ComposerAttachment[],
): Promise<FileAttachment[]> {
  return Promise.all(
    attachments.map(async (attachment) => ({
      name: attachment.name,
      type: attachment.type,
      data: await new File(attachment.uri).base64(),
      mimeType: attachment.mimeType,
    })),
  );
}
