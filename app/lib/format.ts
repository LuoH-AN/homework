export function formatLocal(iso: string) {
  const date = new Date(iso);
  const now = new Date();

  // 获取日期部分（不含时间）
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((todayOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  });

  if (diffDays === 0) {
    return `今天 ${timeStr}`;
  } else if (diffDays === 1) {
    return `昨天 ${timeStr}`;
  } else if (diffDays === 2) {
    return `前天 ${timeStr}`;
  } else if (diffDays > 2 && diffDays <= 7) {
    return `${diffDays}天前 ${timeStr}`;
  } else if (diffDays === -1) {
    return `明天 ${timeStr}`;
  } else if (diffDays === -2) {
    return `后天 ${timeStr}`;
  } else {
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }
}

export function formatDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}
