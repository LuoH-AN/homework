import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadData } from "@/lib/store";
import { formatDate } from "@/lib/date";
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
function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
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
  const subjects = new Set<string>();

  // 收集所有科目
  submissions.forEach((s) => subjects.add(s.subject));

  // 获取日期范围内的提交
  const filteredSubmissions = submissions.filter((submission) => {
    const createdDate = formatDate(new Date(submission.created_at));
    return createdDate >= start && createdDate <= end;
  });

  // 按日期分组
  const submissionsByDate = new Map<string, typeof filteredSubmissions>();
  filteredSubmissions.forEach((submission) => {
    const date = formatDate(new Date(submission.created_at));
    if (!submissionsByDate.has(date)) {
      submissionsByDate.set(date, []);
    }
    submissionsByDate.get(date)!.push(submission);
  });

  // 获取所有学生名单
  const allStudents = Object.values(students).map((s) => s.name);

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

  // 按日期排序
  const sortedDates = Array.from(submissionsByDate.keys()).sort();

  sortedDates.forEach((date) => {
    const daySubmissions = submissionsByDate.get(date)!;

    daySubmissions.forEach((submission) => {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: date })]
            }),
            new TableCell({
              children: [new Paragraph({ text: formatTime(submission.created_at) })]
            }),
            new TableCell({
              children: [new Paragraph({ text: submission.student_name })]
            }),
            new TableCell({
              children: [new Paragraph({ text: submission.subject })]
            }),
            new TableCell({
              children: [new Paragraph({ text: "已提交" })]
            })
          ]
        })
      );
    });
  });

  // 如果没有任何提交，添加一行空数据说明
  if (tableRows.length === 1) {
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
