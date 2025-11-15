# Next.js + 支付宝订阅示例

本示例展示如何使用 [Next.js](https://nextjs.org/)、[Vercel Postgres](https://vercel.com/postgres) 以及本仓库提供的 [`alipay-sdk`](https://www.npmjs.com/package/alipay-sdk) 搭建一套可直接部署到 Vercel 的订阅购买站点。示例涵盖创建支付宝预订单、展示扫码支付二维码、处理支付宝异步通知，以及让用户通过邮箱查询历史订单的完整流程。

## 功能特性

- 提供四档订阅套餐（¥20/月、¥80/半年、¥120/年、¥360/不限时），可自定义权益文案与教程链接。
- 使用支付宝预创建接口生成二维码，支持桌面与移动扫码。
- 下单后自动识别桌面/移动端：桌面自动跳转到支付宝生成的扫码页面并提供备用二维码，移动端直接尝试唤起支付宝客户端，支付完成后自动跳转订单详情。
- 实现 `/api/alipay/notify` 异步通知端点，支付成功后自动更新订单状态。
- 右上角提供订单查询入口，跳转到独立页面使用邮箱检索历史订单并直接获取二维码与使用教程。
- 集成在线客服快捷入口，一键跳转到客服对话窗口。
- 在部署到 Vercel 时默认对接 Vercel Postgres，保证无状态函数环境下的数据持久化。
- 本地开发未配置数据库时自动降级为内存存储，其余支付流程均直接调用支付宝官方 OpenAPI，不依赖第三方二维码服务。

## 目录说明

```
examples/nextjs-subscription
├── app/                 # Next.js App Router 页面与 API 路由
├── lib/                 # 支付宝、订单、套餐与存储的业务逻辑
├── next.config.mjs      # Next.js 配置
├── package.json         # 独立示例的依赖与脚本
└── README.md            # 当前文档
```

## 快速开始（本地开发）

1. 进入示例目录并安装依赖：

   ```bash
   cd examples/nextjs-subscription
   pnpm install
   # 或使用 npm install / yarn install
   ```

2. 将 `.env.example` 复制为 `.env.local` 并按需填写变量。请务必配置 `ALIPAY_APP_ID`、`ALIPAY_PRIVATE_KEY` 以及支付宝公钥或证书路径，否则示例会直接拒绝创建订单；`ORDERS_FORCE_MEMORY=true` 仍可用于本地演示下单流程，但不会影响支付是否直连支付宝。

3. 启动开发服务器：

   ```bash
   pnpm dev
   ```

4. 访问 <http://localhost:3000> 即可体验界面。若想在本地使用 Vercel Postgres，可先在 Vercel 上创建数据库后执行 `vercel env pull .env.local`（需安装 [Vercel CLI](https://vercel.com/docs/cli) 并登录）。

## 部署到 Vercel（详尽步骤）

1. **准备代码仓库**
   - 将本仓库推送到你自己的 GitHub/GitLab/Bitbucket 账号，或直接 fork。

2. **在 Vercel 创建新项目**
   - 访问 [Vercel 控制台](https://vercel.com/dashboard) 并点击 **New Project**。
   - 选择刚刚的仓库。
   - 在导入设置中，将 **Root Directory** 设置为 `examples/nextjs-subscription`，以便仅部署该示例目录。
   - Vercel 会自动识别为 Next.js 项目，保持默认的 `Install Command`（可用 `pnpm install` 或 `npm install`）与 `Build Command`（`next build`）。

3. **配置 Vercel Postgres**
   - 在项目导入流程或项目的 **Storage → Add** 中选择 **Postgres** 并创建数据库。
   - 创建完成后，在数据库详情页点击 **Connect**，选择 **Next.js** 或 **Environment Variables** 模式，将生成的以下变量绑定到项目的环境中：
     - `POSTGRES_URL`
     - `POSTGRES_PRISMA_URL`
     - `POSTGRES_URL_NON_POOLING`
     - `POSTGRES_USER`
     - `POSTGRES_HOST`
     - `POSTGRES_PASSWORD`
     - `POSTGRES_DATABASE`
   - 首次部署或首次收到订单请求时，应用会自动在数据库中创建 `subscription_orders` 表，无需额外迁移脚本。
   - **若在 Vercel 中添加的是 Supabase Postgres：** 集成会额外注入 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_JWT_SECRET` 以及 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 等变量，同时同样提供 `POSTGRES_*` 连接串。本示例会在检测到这些变量或 `supabase.co` 域名时自动切换到 `pg` 连接池驱动，整个下单/回调流程依旧可以自动建表与读写，无需额外改动。

4. **配置支付宝参数**
   - 在 [支付宝开放平台](https://open.alipay.com/) 创建应用并获取以下信息：
     - `ALIPAY_APP_ID`
     - `ALIPAY_PRIVATE_KEY`
     - `ALIPAY_ALIPAY_PUBLIC_KEY`（或证书路径：`ALIPAY_APP_CERT_PATH`、`ALIPAY_ALIPAY_PUBLIC_CERT_PATH`、`ALIPAY_ALIPAY_ROOT_CERT_PATH`）
   - 将异步通知地址设置为 `https://<你的 Vercel 域名>/api/alipay/notify`。
   - 若希望使用沙箱，可将 `ALIPAY_USE_SANDBOX` 设为 `true` 并配置沙箱密钥。

5. **设置站点展示信息（可选）**
   - 根据需求设置 `NEXT_PUBLIC_SITE_NAME` 与 `NEXT_PUBLIC_SUPPORT_EMAIL` 等变量，控制页面上显示的站点名称与支持邮箱。

6. **触发部署**
   - 完成环境变量配置后点击 **Deploy**。
   - 部署完成后访问 Vercel 分配的域名，即可使用真实的支付宝预下单与扫码支付流程。

## 部署后验证

1. 打开部署后的站点并填写邮箱，选择任意套餐创建订单。
2. 若配置了真实密钥，桌面端会自动打开支付宝官方扫码页面（同时在站点内展示备用二维码），移动端会自动唤起支付宝客户端，支付完成后页面会自动跳转到订单详情。
3. 通过右上角“订单查询”按钮跳转到查询页，输入下单邮箱即可再次获取二维码与教程链接。

## 自定义套餐二维码与教程

- 套餐的名称、价格、权益展示位于 [`lib/plans.ts`](./lib/plans.ts)，这些字段会在客户端渲染，可放心调整文案。
- 教程跳转链接在套餐定义中的 `tutorialUrl` 字段，同样可根据产品上线后的使用说明进行替换。

## 实时订单查询接口

- `GET /api/orders/[orderId]?email=<下单邮箱>`：校验邮箱后返回订单当前状态、二维码原始内容与渲染后的图片地址及最新更新时间，供前端轮询。下单页会调用该接口以判断是否需要刷新二维码或跳转详情页。

## 环境变量速查

`.env.example` 列出了完整变量，以下为常用项：

| 变量 | 说明 |
| --- | --- |
| `ALIPAY_APP_ID` | 支付宝开放平台应用 App ID（生产或沙箱）。|
| `ALIPAY_PRIVATE_KEY` | 应用私钥，需为 PKCS8 格式。|
| `ALIPAY_ALIPAY_PUBLIC_KEY` | 支付宝公钥（或改用证书配置）。|
| `ORDERS_FORCE_MEMORY` | 设为 `true` 时跳过 Postgres，转而使用内存存储，适合本地演示或尚未准备数据库的场景。|
| `ALIPAY_NOTIFY_URL` | 支付宝服务端通知回调地址；部署到 Vercel 后可留空，由应用自动推导。|
| `ALIPAY_USE_SANDBOX` | `true` 时使用沙箱网关，适合调试。|
| `POSTGRES_URL` 等 | Vercel Postgres 或 Supabase Postgres 连接信息，详见上文。|
| `SUPABASE_URL` 等 | 使用 Vercel × Supabase 集成时提供的变量，绑定后示例会自动启用兼容 Supabase 的数据库驱动。|
| `NEXT_PUBLIC_SITE_NAME` | 页面展示的站点名称。|
| `NEXT_PUBLIC_SUPPORT_EMAIL` | 页面展示的支持邮箱。|

缺失支付宝配置时，接口会直接报错并拒绝下单；缺失数据库配置时，订单仅存储在内存中，不会跨函数或重启保留。

## 注意事项

- 示例会严格校验支付宝密钥配置，只有在补齐 App ID、私钥与公钥/证书后才会真正发起请求，请务必使用与你的账号匹配的密钥材料。
- 若使用 Vercel Postgres，需确保项目至少绑定了 `POSTGRES_URL`。其它别名变量建议一并配置，以兼容 `@vercel/postgres` 的运行逻辑。
- 在中国大陆访问 Vercel 可能需要额外的网络配置，部署域名也可能因 DNS 解析产生延迟。

## 许可协议

与上级仓库一致，代码基于 MIT 许可证发布。
