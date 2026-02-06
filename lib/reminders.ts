import type { Reminder } from "./types";

export function defaultReminders(): Reminder[] {
  return [
    {
      title: "上传时间",
      body: "建议在当天 22:00 前完成提交。",
      meta: "{today}"
    },
    {
      title: "修改窗口",
      body: "提交后 3 天内可上传新版图片。",
      meta: "支持自动标记更新"
    },
    {
      title: "图片质量",
      body: "保持清晰，避免过度裁剪或反光。",
      meta: "推荐横向拍摄"
    }
  ];
}

export function normalizeReminders(raw?: unknown): Reminder[] {
  if (!Array.isArray(raw)) return defaultReminders();
  const cleaned = raw.map((item) => ({
    title: typeof item?.title === "string" ? item.title.trim() : "",
    body: typeof item?.body === "string" ? item.body.trim() : "",
    meta: typeof item?.meta === "string" ? item.meta.trim() : ""
  }));
  return cleaned.length ? cleaned : defaultReminders();
}
