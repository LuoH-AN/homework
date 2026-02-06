import { requireEnv } from "./env";

const BOT_TOKEN = requireEnv("TELEGRAM_BOT_TOKEN");
const HOMEWORK_CHAT_ID = requireEnv("HOMEWORK_CHAT_ID");
const STORAGE_CHAT_ID = requireEnv("STORAGE_CHAT_ID");

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FILE_BASE = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

type TelegramResponse<T> =
  | { ok: true; result: T }
  | { ok: false; description?: string; error_code?: number };

async function telegramCall<T>(method: string, body?: FormData | Record<string, unknown>) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: isForm ? undefined : { "Content-Type": "application/json" },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });
  const payload = (await res.json()) as TelegramResponse<T>;
  if (!payload.ok) {
    throw new Error(payload.description || `Telegram API error: ${method}`);
  }
  return payload.result;
}

export async function sendHomeworkPhoto(file: File | Blob, caption: string) {
  const form = new FormData();
  form.append("chat_id", HOMEWORK_CHAT_ID);
  form.append("caption", caption);
  const filename = file instanceof File ? file.name : "homework.jpg";
  form.append("photo", file, filename);
  return telegramCall<any>("sendPhoto", form);
}

export async function sendHomeworkPhotos(files: Array<File | Blob>, caption: string) {
  if (files.length === 1) {
    const message = await sendHomeworkPhoto(files[0], caption);
    return [message];
  }

  const form = new FormData();
  form.append("chat_id", HOMEWORK_CHAT_ID);
  const media = files.map((file, index) => {
    const item: Record<string, string> = {
      type: "photo",
      media: `attach://file${index}`
    };
    if (index === 0) {
      item.caption = caption;
    }
    return item;
  });
  form.append("media", JSON.stringify(media));
  files.forEach((file, index) => {
    const filename = file instanceof File ? file.name : `homework-${index + 1}.jpg`;
    form.append(`file${index}`, file, filename);
  });
  return telegramCall<any[]>("sendMediaGroup", form);
}

export async function sendStorageDocument(content: string, filename: string) {
  const form = new FormData();
  form.append("chat_id", STORAGE_CHAT_ID);
  form.append("caption", "HOMEWORK_DATA");
  form.append("document", new Blob([content], { type: "application/json" }), filename);
  return telegramCall<any>("sendDocument", form);
}

export async function pinStorageMessage(messageId: number) {
  return telegramCall("pinChatMessage", {
    chat_id: STORAGE_CHAT_ID,
    message_id: messageId,
    disable_notification: true
  });
}

export async function getStoragePinnedMessage() {
  return telegramCall<any>("getChat", { chat_id: STORAGE_CHAT_ID });
}

export async function getFileInfo(fileId: string) {
  return telegramCall<{ file_path: string }>("getFile", { file_id: fileId });
}

export async function downloadFile(filePath: string) {
  const res = await fetch(`${FILE_BASE}/${filePath}`);
  if (!res.ok) {
    throw new Error("Failed to download Telegram file");
  }
  return res;
}

export async function getFileById(fileId: string) {
  const info = await getFileInfo(fileId);
  return downloadFile(info.file_path);
}
