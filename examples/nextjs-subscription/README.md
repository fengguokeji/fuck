# Next.js + 支付宝订阅示例

本示例展示如何使用 [Next.js](https://nextjs.org)、Vercel Postgres 以及本仓库提供的 [`alipay-sdk`](https://www.npmjs.com/package/alipay-sdk) 搭建订阅购买体验。示例演示了如何创建支付宝预订单、生成扫码支付二维码、处理支付宝异步通知，以及让用户通过邮箱查询订单。

## 功能特性

- 提供三档订阅套餐，可自定义价格与权益文案。
- 使用支付宝预创建接口生成二维码，支持桌面与移动扫码。
- 实现 `/api/alipay/notify` 回调，收到支付宝确认后自动更新订单状态。
- 支持通过邮箱查询历史订单，并重新获取二维码和使用引导链接。
- 在配置可用凭据时使用 Vercel Postgres 持久化数据。
- 本地开发未配置数据库时自动降级为内存存储，避免阻塞流程。
- 未提供支付宝密钥时自动切换为模拟网关，方便本地调试。

## 本地开发指南

1. 在示例目录中安装依赖：

   ```bash
   pnpm install
   # 或使用 npm install / yarn install
   ```

2. 将 `.env.example` 复制为 `.env.local` 并填写必要变量。若省略支付宝密钥，应用将运行在模拟模式。

3. 启动开发服务器：

   ```bash
   pnpm dev
   ```

4. 访问 http://localhost:3000 体验演示界面。

## 部署到 Vercel

1. 在 Vercel 控制台创建新项目并导入本示例目录。
2. 申请并配置 [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) 数据库，将连接串写入环境变量（参考 `.env.example`）。
3. 在支付宝开放平台配置应用信息与密钥，并设置对应环境变量。请将异步通知地址指向 `https://<your-domain>/api/alipay/notify`。
4. 部署项目。本示例使用适配 Edge Runtime 的 API，可直接运行在无服务器环境。

## 环境变量

完整列表见 `.env.example`。至少需要设置：

- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_ALIPAY_PUBLIC_KEY`（或证书路径）
- `ALIPAY_NOTIFY_URL`
- `POSTGRES_URL` / `POSTGRES_PRISMA_URL`（或其他 Vercel Postgres 密钥）

缺少上述变量时，应用会自动模拟支付成功，便于在无外部依赖的情况下调试界面。

## 注意事项

- 模拟模式不会请求支付宝，并会立即将订单标记为已支付。
- 在模拟模式下，回调端点会信任所有请求。上线前请务必启用真实凭据。
- 为突出集成逻辑，示例页面仅保留最小化样式。

## 许可协议

与上级仓库一致，均为 MIT 许可证。
