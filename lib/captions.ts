import { formatMonthDay } from "./date";

function safeTag(value: string) {
  return value.replace(/\s+/g, "_").replace(/#/g, "");
}

export function buildSubmitCaption(params: {
  name: string;
  subject: string;
  when: Date;
}) {
  const dateTag = formatMonthDay(params.when);
  return `#${safeTag(params.name)} #${safeTag(params.subject)} #${dateTag}`;
}

export function buildEditCaption(params: {
  name: string;
  subject: string;
  updatedAt: Date;
}) {
  const dateTag = formatMonthDay(params.updatedAt);
  return `#${safeTag(params.name)} #${safeTag(params.subject)} #${dateTag} #已修改`;
}
