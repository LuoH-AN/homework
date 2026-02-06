import { nowIso } from "./date";
import type { DataFile } from "./types";
import { getStoragePinnedMessage, getFileById, pinStorageMessage, sendStorageDocument } from "./telegram";
import { defaultReminders, normalizeReminders } from "./reminders";

function createEmptyData(): DataFile {
  return {
    version: 3,
    updated_at: nowIso(),
    students: {},
    name_index: {},
    submissions: {},
    student_submissions: {},
    manual_completions: {},
    assignments: [],
    reminders: defaultReminders()
  };
}

function normalizeSubmissions(rawSubmissions: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(rawSubmissions ?? {}).map(([id, submission]) => {
      if (!submission) return [id, submission];
      const photoFileIds = submission.photo_file_ids ?? [];
      const photoUniqueIds = submission.photo_unique_ids ?? [];
      const messageIds = submission.tg_message_ids ?? [];

      const normalized = {
        ...submission,
        photo_file_ids:
          photoFileIds.length > 0
            ? photoFileIds
            : submission.photo_file_id
              ? [submission.photo_file_id]
              : [],
        photo_unique_ids:
          photoUniqueIds.length > 0
            ? photoUniqueIds
            : submission.photo_unique_id
              ? [submission.photo_unique_id]
              : undefined,
        tg_message_ids:
          messageIds.length > 0
            ? messageIds
            : submission.tg_message_id
              ? [submission.tg_message_id]
              : [],
        history: (submission.history ?? []).map((entry: any) => ({
          ...entry,
          photo_file_ids:
            entry.photo_file_ids?.length > 0
              ? entry.photo_file_ids
              : entry.photo_file_id
                ? [entry.photo_file_id]
                : [],
          photo_unique_ids:
            entry.photo_unique_ids?.length > 0
              ? entry.photo_unique_ids
              : entry.photo_unique_id
                ? [entry.photo_unique_id]
                : undefined,
          tg_message_ids:
            entry.tg_message_ids?.length > 0
              ? entry.tg_message_ids
              : entry.tg_message_id
                ? [entry.tg_message_id]
                : []
        }))
      };

      delete normalized.photo_file_id;
      delete normalized.photo_unique_id;
      delete normalized.tg_message_id;

      return [id, normalized];
    })
  );
}

function migrateData(raw: any): DataFile {
  if (raw?.version === 3) {
    return {
      ...raw,
      manual_completions: raw.manual_completions ?? {},
      assignments: raw.assignments ?? [],
      reminders: normalizeReminders(raw.reminders)
    } as DataFile;
  }

  if (raw?.version !== 1 && raw?.version !== 2) {
    throw new Error("Invalid data file");
  }

  const submissions = normalizeSubmissions(raw.submissions ?? {});

  return {
    version: 3,
    updated_at: raw.updated_at ?? nowIso(),
    students: raw.students ?? {},
    name_index: raw.name_index ?? {},
    submissions,
    student_submissions: raw.student_submissions ?? {},
    manual_completions: raw.manual_completions ?? {},
    assignments: raw.assignments ?? [],
    reminders: defaultReminders()
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
    return migrateData(parsed);
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
