# Next.js + Alipay Subscription Demo

This example shows how to build a subscription checkout experience with [Next.js](https://nextjs.org), Vercel Postgres, and the [`alipay-sdk`](https://www.npmjs.com/package/alipay-sdk) from this repository. It demonstrates how to issue Alipay pre-orders, render QR codes for payment, handle asynchronous payment notifications, and allow customers to retrieve their orders via email.

## Features

- Three subscription tiers with customizable pricing and benefits copy.
- Creates Alipay pre-orders and renders QR codes for desktop or mobile scanning.
- Implements an `/api/alipay/notify` webhook to update orders when Alipay confirms the payment.
- Email-based order lookup lets customers retrieve QR codes and onboarding links.
- Uses Vercel Postgres for persistence when credentials are available.
- Falls back to an in-memory data store during local development when no database is configured.
- Automatically switches to a mock Alipay gateway when cryptographic credentials are missing, simplifying local testing.

## Getting Started Locally

1. Install dependencies inside the example directory:

   ```bash
   pnpm install
   # or npm install / yarn install
   ```

2. Copy `.env.example` to `.env.local` and provide the required variables. When the Alipay keys are omitted the app will run in mock mode.

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Visit http://localhost:3000 to explore the demo UI.

## Deployment on Vercel

1. Create a new project in the Vercel dashboard and import this example folder.
2. Provision a [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) database and add the connection string as environment variables (see `.env.example`).
3. Configure your Alipay open platform application and set the corresponding environment variables. Point the notify URL to `https://<your-domain>/api/alipay/notify`.
4. Deploy. The project uses the Edge Runtime friendly APIs so it works in serverless environments.

## Environment Variables

See `.env.example` for the full list. At minimum set:

- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_ALIPAY_PUBLIC_KEY` (or certificate paths)
- `ALIPAY_NOTIFY_URL`
- `POSTGRES_URL` / `POSTGRES_PRISMA_URL` (or other Vercel Postgres secrets)

When the values are missing the app will automatically simulate successful payments so you can iterate on the UI without external dependencies.

## Caveats

- The mock mode does not contact Alipay and instantly marks orders as paid.
- The webhook endpoint trusts any payload in mock mode. Enable real credentials before going live.
- This demo intentionally keeps the styling minimal to focus on the integration details.

## License

MIT — same as the parent repository.
