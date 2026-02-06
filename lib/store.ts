import { nowIso } from "./date";
import type { DataFile } from "./types";
import { getStoragePinnedMessage, getFileById, pinStorageMessage, sendStorageDocument } from "./telegram";

function createEmptyData(): DataFile {
  return {
    version: 1,
    updated_at: nowIso(),
    students: {},
    name_index: {},
    submissions: {},
    student_submissions: {}
  };
}

export async function loadData(): Promise<DataFile> {
  const chat = await getStoragePinnedMessage();
  const pinned = chat?.pinned_message;
  const document = pinned?.document;

  if (!document?.file_id) {
    const fresh = createEmptyData();
    await saveData(fresh);
    return fresh;
  }

  const fileRes = await getFileById(document.file_id);
  const text = await fileRes.text();
  try {
    const parsed = JSON.parse(text) as DataFile;
    if (!parsed.version) {
      throw new Error("Invalid data file");
    }
    return parsed;
  } catch (err) {
    throw new Error("Failed to parse storage data file");
  }
}

export async function saveData(data: DataFile) {
  const payload = {
    ...data,
    updated_at: nowIso()
  } satisfies DataFile;
  const content = JSON.stringify(payload, null, 2);
  const message = await sendStorageDocument(content, `homework-data-${Date.now()}.json`);
  if (message?.message_id) {
    await pinStorageMessage(message.message_id);
  }
}
