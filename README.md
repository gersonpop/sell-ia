This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Auth.js (Google, Facebook, LinkedIn)

1. Copy `.env.example` to `.env.local`.
2. Fill provider credentials:
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
   - `AUTH_FACEBOOK_ID`, `AUTH_FACEBOOK_SECRET`
   - `AUTH_LINKEDIN_ID`, `AUTH_LINKEDIN_SECRET`
3. Set `AUTH_SECRET` with a long random value.
4. `NEXTAUTH_URL` is optional in local development. If empty, Auth.js uses the current host/port from the request (for example `localhost:3001`).

OAuth callback URLs for all providers:

- `http://localhost:3001/api/auth/callback/google`
- `http://localhost:3001/api/auth/callback/facebook`
- `http://localhost:3001/api/auth/callback/linkedin`

If you also run on another port (e.g. `3000`), add those callback URLs too in each provider console.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
