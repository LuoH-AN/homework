import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadData } from "@/lib/store";
import { formatDate } from "@/lib/date";
import { getSubjects } from "@/lib/env";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle
} from "docx";

export const runtime = "nodejs";

// 格式化时间为人性化格式
function formatClock(iso: string) {
  const date = new Date(iso);
  const timeZone = process.env.TIMEZONE || "Asia/Shanghai";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const timeZone = process.env.TIMEZONE || "Asia/Shanghai";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start")?.trim();
  const endDate = searchParams.get("end")?.trim();
  const today = formatDate(new Date());

  // 默认导出今天
  const start = startDate || today;
  const end = endDate || start;

  const data = await loadData();
  const submissions = Object.values(data.submissions).filter(Boolean);
  const students = data.students ?? {};
  const ignoredNames = new Set(["组长"]);
  const configuredSubjects = getSubjects();

  // 获取日期范围内的提交
  const filteredSubmissions = submissions.filter((submission) => {
    const createdDate = formatDate(new Date(submission.created_at));
    return (
      createdDate >= start &&
      createdDate <= end &&
      !ignoredNames.has(submission.student_name)
    );
  });
  const subjectList = configuredSubjects.length
    ? configuredSubjects
    : Array.from(new Set(filteredSubmissions.map((submission) => submission.subject)));

  // 获取所有学生名单
  const allStudents: string[] = [];
  const studentSet = new Set<string>();
  Object.values(students).forEach((student) => {
    if (!ignoredNames.has(student.name) && !studentSet.has(student.name)) {
      studentSet.add(student.name);
      allStudents.push(student.name);
    }
  });
  filteredSubmissions.forEach((submission) => {
    if (!studentSet.has(submission.student_name)) {
      studentSet.add(submission.student_name);
      allStudents.push(submission.student_name);
    }
  });

  const latestByStudentSubject = new Map<string, (typeof filteredSubmissions)[number]>();
  filteredSubmissions.forEach((submission) => {
    const key = `${submission.student_name}||${submission.subject}`;
    const existing = latestByStudentSubject.get(key);
    if (
      !existing ||
      new Date(submission.created_at).getTime() >
        new Date(existing.created_at).getTime()
    ) {
      latestByStudentSubject.set(key, submission);
    }
  });

  // 创建表格行
  const tableRows: TableRow[] = [];

  // 表头
  tableRows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "日期", bold: true })] })],
          width: { size: 15, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "时间", bold: true })] })],
          width: { size: 20, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "姓名", bold: true })] })],
          width: { size: 20, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "科目", bold: true })] })],
          width: { size: 20, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "是否提交", bold: true })] })],
          width: { size: 25, type: WidthType.PERCENTAGE }
        })
      ]
    })
  );

  if (allStudents.length && subjectList.length) {
    allStudents.forEach((studentName) => {
      subjectList.forEach((subject) => {
        const key = `${studentName}||${subject}`;
        const submission = latestByStudentSubject.get(key);
        const date = submission ? formatDate(new Date(submission.created_at)) : "-";
        const time = submission ? formatClock(submission.created_at) : "-";
        const status = submission ? "已提交" : "未提交";

        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ text: date })]
              }),
              new TableCell({
                children: [new Paragraph({ text: time })]
              }),
              new TableCell({
                children: [new Paragraph({ text: studentName })]
              }),
              new TableCell({
                children: [new Paragraph({ text: subject })]
              }),
              new TableCell({
                children: [new Paragraph({ text: status })]
              })
            ]
          })
        );
      });
    });
  } else {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: start === end ? start : `${start} 至 ${end}` })]
          }),
          new TableCell({
            children: [new Paragraph({ text: "-" })]
          }),
          new TableCell({
            children: [new Paragraph({ text: "-" })]
          }),
          new TableCell({
            children: [new Paragraph({ text: "-" })]
          }),
          new TableCell({
            children: [new Paragraph({ text: "暂无提交" })]
          })
        ]
      })
    );
  }

  // 创建文档
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "作业提交记录",
                bold: true,
                size: 32
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: start === end ? `日期：${start}` : `日期范围：${start} 至 ${end}`,
                size: 24
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `共 ${filteredSubmissions.length} 条提交记录`,
                size: 20,
                italics: true
              })
            ],
            spacing: { before: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `导出时间：${formatTime(new Date().toISOString())}`,
                size: 20,
                italics: true
              })
            ]
          })
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = start === end ? `homework-${start}.docx` : `homework-${start}-to-${end}.docx`;

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename=${filename}`
    }
  });
}
