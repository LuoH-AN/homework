# 作业提交（Telegram 存储版）

该项目部署在 Vercel，所有数据仅存储在 Telegram 群组消息中。

## 必填环境变量

- `TELEGRAM_BOT_TOKEN`：Bot Token
- `HOMEWORK_CHAT_ID`：作业发布群组/频道 ID（图片发送到这里）
- `STORAGE_CHAT_ID`：存储群组 ID（JSON 文件发送并置顶）
- `SUBJECTS`：科目列表，逗号分隔，例如 `数学,英语,物理`
- `TIMEZONE`：时间格式化的时区（默认 `Asia/Shanghai`）

## 可选环境变量

- `ADMIN_SECRET`：启用管理后台与管理员恢复接口

## Telegram 群组要求

1. Bot 必须是 `HOMEWORK_CHAT_ID` 群组的成员，并允许发送图片。
2. Bot 必须是 `STORAGE_CHAT_ID` 群组的管理员，并拥有 **置顶消息** 权限。
3. 系统通过置顶的 JSON 文件作为唯一数据索引。每次更新会重新发送文件并置顶。

> Telegram Bot API 无法直接读取“最新消息”，因此使用置顶消息作为稳定入口。

## 管理后台

- 访问 `/admin` 输入 `ADMIN_SECRET` 登录
- 页面导航：
  - 概览：提交趋势、批改统计
  - 作业：新增 / 编辑 / 截止 / 删除作业
  - 批改：单个或批量批改、打回修正
  - 导出：按日期范围导出 Word（.docx）
  - 学生：增删改学生、今日作业完成标记

> 手动完成标记仅用于统计与导出，不会生成图片提交记录。

## 管理员恢复（不在 UI 显示）

当学生更换设备需要恢复身份时，管理员可以调用接口重新生成 token：

```bash
curl -X POST /api/admin/recover \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_SECRET" \
  -d '{"name":"张三","set_cookie":false}'
```

返回的新 token 可用于手动恢复（例如在浏览器里通过开发者工具设置 `hw_token` cookie），
或将 `set_cookie` 设为 `true` 由管理员在学生设备上执行该请求。

## 图片压缩说明

- 上传前会在浏览器端将图片压缩为 **JPEG**（最长边 1920，质量 0.5）
- 该格式为各浏览器通用格式，减小体积提升上传速度

## 本地启动

```bash
npm install
npm run dev
```

## 主要流程说明

- 学生首次进入绑定姓名（不可修改）
- 选择科目上传作业图片
- 图片发送到作业群组，并附带标签 `#名字 #科目 #日期`（日期格式 `YYYY-MM-DD`）
- 学生可在 72 小时内修改；被老师打回后也可重新提交
- 修改会重新发送图片并附加 `#时间 #名字 #已修改`（时间格式 `YYYY-MM-DD HH:mm`）
- 学生仅能看到自己的记录，图片通过后端代理 Telegram 文件展示
