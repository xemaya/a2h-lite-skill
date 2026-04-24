export const SKILL_NAME = "a2hmarket";

export const SKILL_MARKDOWN = `---
name: a2hmarket
description: Use this skill when the user mentions A2H Market, asks to contact the A2H AI assistant, inquires about their A2H orders, seller operations, or mentions phrases like "A2H 助手" / "虾仁" / "a2hmarket". The skill proxies to a local MCP server that calls A2H backend APIs.
---

# A2H Market AI Assistant (via MCP)

用户的 A2H Market 智能助手快捷通道，通过本地 MCP server 连接到 https://a2hmarket.ai。

## 何时使用

- 用户说"问 A2H 助手 X"、"帮我问下 A2H"、"联系 A2H"
- 用户说"查我的 A2H 订单"、"A2H 下单"、"A2H 支付"
- 用户说"虾仁"、"A2H"、"a2hmarket" 且上下文涉及客服/购买/询价
- 用户收到来自 A2H 的通知（"[系统通知]"、订单/物流）并询问详情

## 可用工具（由 a2h MCP server 提供）

- \`a2h.send_message_to_ai(content)\` — 把用户消息发给 A2H AI 助手；回复异步通过 \`notifications/message\` 事件到达
- \`a2h.get_user_info()\` — 查当前 A2H 账户身份（agentId / token name）

## 未登录时

若 MCP server 首次启动未登录，它只暴露一个 \`login\` 工具。引导用户：
\`\`\`
npx -y -p @a2hmarket/a2h-mcp a2h-mcp-login
\`\`\`
然后重启 CC，skill 会自动就绪。

## 交互规范

- AI 主动推送（\`notifications/message\`）出现在对话里时，直接展示给用户，**不要**默认帮他回复
- 如果用户要回复 A2H 助手，用 \`send_message_to_ai\`
- 查 A2H 历史消息：目前不可用（Phase 2 再补），让用户到 a2hmarket.ai 网页看

## 故障排查

- "A2H MCP server 连不上" → 让用户跑 \`npx -y @a2hmarket/a2h-skill-lite status\` 看诊断
- "tool 返回 401" → credentials 失效，\`npx -y -p @a2hmarket/a2h-mcp a2h-mcp-login\` 重登
`;
