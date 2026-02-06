import { formatDate, formatDateTime } from "./date";

function safeTag(value: string) {
  return value.replace(/\s+/g, "_").replace(/#/g, "");
}

export function buildSubmitCaption(params: {
  name: string;
  subject: string;
  when: Date;
}) {
  const dateTag = formatDate(params.when);
  const lineTags = `#${safeTag(params.name)} #${safeTag(params.subject)} #${dateTag}`;
  const lineInfo = `时间: ${formatDateTime(params.when)}`;
  return `${lineTags}\n${lineInfo}`;
}

export function buildEditCaption(params: {
  name: string;
  subject: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const timeTag = formatDateTime(params.updatedAt).replace(" ", "_");
  const lineTags = `#${timeTag} #${safeTag(params.name)} #已修改`;
  const lineInfo = `科目: ${params.subject}\n原提交: ${formatDateTime(
    params.createdAt
  )}\n修改: ${formatDateTime(params.updatedAt)}`;
  return `${lineTags}\n${lineInfo}`;
}
