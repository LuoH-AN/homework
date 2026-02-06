"use client";

import type { ChangeEvent } from "react";

type FilePickerProps = {
  id: string;
  label: string;
  files: File[];
  onChange: (files: File[]) => void;
  hint?: string;
  multiple?: boolean;
};

export default function FilePicker({
  id,
  label,
  files,
  onChange,
  hint,
  multiple = true
}: FilePickerProps) {
  const summary = files.length
    ? files.length === 1
      ? files[0].name
      : `已选择 ${files.length} 张图片`
    : hint ?? "支持上传多张图片";

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    onChange(selected);
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="file-picker">
        <input
          id={id}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleChange}
        />
        <div className="file-picker-body">
          <div className="file-picker-title">选择图片</div>
          <div className="file-picker-meta">{summary}</div>
        </div>
        <div className="file-picker-action">浏览</div>
      </div>
    </div>
  );
}
