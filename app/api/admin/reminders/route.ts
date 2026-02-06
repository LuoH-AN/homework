import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadData, saveData } from "@/lib/store";
import { normalizeReminders } from "@/lib/reminders";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = (await request.json().catch(() => ({}))) as {
    reminders?: unknown;
  };

  const reminders = normalizeReminders(body.reminders);

  const data = await loadData();
  data.reminders = reminders;
  await saveData(data);

  return NextResponse.json({ ok: true, reminders });
}
