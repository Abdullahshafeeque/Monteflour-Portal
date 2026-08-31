# Monteflour Portal — Setup Guide

Next.js app (App Router + TypeScript). Checkout page, Razorpay payment,
coupon system, and a Supabase-Auth-protected admin portal — deployed on
Vercel, database on Supabase, editable in VS Code via git.

Build was verified locally (`next build` completes clean, no type errors)
before this was handed to you.

## 1. Push this to GitHub

```bash
cd monteflour-portal
git init
git add .
git commit -m "Initial commit: Monteflour checkout + admin portal"
```
Create an empty repo on GitHub, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/monteflour-portal.git
git branch -M main
git push -u origin main
```

## 2. Set up Supabase

1. Create a project at https://supabase.com (if you haven't already).
2. Go to **SQL Editor > New Query**, paste in the contents of `supabase/schema.sql`,
   and run it. This creates the `orders` and `coupons` tables, with Row Level
   Security locked down (see note below) and one example coupon (`WELCOME10`).
3. Go to **Project Settings > API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this one secret — never
     put it in a `NEXT_PUBLIC_` variable or in client-side code)

### Create your admin login
Go to **Authentication > Users > Add User** in the Supabase dashboard, and create
yourself an admin account directly there with an email and password (check
"Auto Confirm User" so you don't need to click an email link). That's it — no
separate signup flow needed. This is the login you'll use at `/admin-login`.

## 3. Set up Razorpay

1. Get your **Key ID** and **Key Secret** from https://dashboard.razorpay.com
   under Settings > API Keys. Start with **Test Mode** keys.

## 4. Deploy to Vercel

1. Go to https://vercel.com/new and import your GitHub repo.
2. Vercel auto-detects Next.js — no build config needed.
3. Before deploying, add these Environment Variables (Project Settings > Environment Variables):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase (server only) |
| `RAZORPAY_KEY_ID` | from Razorpay |
| `RAZORPAY_KEY_SECRET` | from Razorpay (server only) |
| `NEXT_PUBLIC_PRODUCT_NAME` | e.g. `Monteflour — 8 Grain Multigrain Flour (1kg)` |
| `NEXT_PUBLIC_PRODUCT_PRICE` | your real price per box, in rupees — **check this carefully** |
| `NEXT_PUBLIC_SHIPPING_FEE` | flat shipping fee in rupees, `0` for free |
| `NEXT_PUBLIC_FREE_SHIPPING_ABOVE` | order value that unlocks free shipping, `0` to disable |

4. Deploy. Vercel gives you a `*.vercel.app` URL immediately.

### Point your domain at it (optional, when ready)
In Vercel, go to Project > Settings > Domains and add something like
`checkout.monteflour.com` (a subdomain), then add the CNAME record Vercel
gives you in Hostinger's DNS settings. Your main site stays on Hostinger;
only the checkout subdomain points to Vercel.

## 5. Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in real values
npm run dev
```
Visit `http://localhost:3000/checkout` and `http://localhost:3000/admin-login`.

## 6. Making changes going forward

Standard git workflow — edit in VS Code, then:
```bash
git add .
git commit -m "describe your change"
git push
```
Vercel automatically rebuilds and redeploys on every push to `main`. You can
also open a branch/PR and Vercel will give you a preview URL to check changes
before merging.

## 7. Point your "Buy Now" buttons at the new checkout

In your existing site files on Hostinger (`index.html`, `faqs.html`,
`recipes.html`, `more.html`), every "Buy on Amazon" button currently points to:
```
https://www.amazon.in/dp/B0FYFSJZPZ
```
Replace every instance of that URL with your deployed checkout URL, e.g.:
```
https://checkout.monteflour.com
```
(or the `*.vercel.app` URL until your custom domain is set up). You'll
probably also want to change the button text from "Buy on Amazon" to "Buy Now".

## 8. Test end-to-end before going live

1. With Razorpay in Test Mode, place a test order. Use test card
   `4111 1111 1111 1111`, any future expiry, any CVV.
2. Confirm the order shows up in `/admin/dashboard` as "Paid".
3. Try the `WELCOME10` coupon and confirm the discount applies.
4. Once everything works, switch `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
   in Vercel's environment variables to your **Live Mode** keys and redeploy.

## How the security model works

- The **service role key** (which can read/write anything, bypassing Row Level
  Security) is only ever used inside API routes, Server Components, and Server
  Actions — code that runs on Vercel's servers, never in the browser.
- The **anon key** (safe to expose, and it's fine that it's `NEXT_PUBLIC_`) is
  used only for admin sign-in via Supabase Auth. Since RLS is enabled on
  `orders` and `coupons` with no policies defined, the anon key has **zero**
  direct read/write access to that data — even if someone extracted it from
  your JS bundle, they couldn't query your customer data with it.
- `/admin/*` routes are protected by middleware that checks for a valid
  Supabase Auth session before rendering anything.
- Order totals are always recalculated server-side in `create-order`, and
  payments are verified with Razorpay's HMAC signature before being marked
  paid — a customer can't tamper with the price from dev tools.

## What's not built yet (for later)

- **Influencer portals** for per-order commission tracking. The schema is
  simple enough to extend — e.g. an `influencer_code` column on `coupons`
  tied to a separate Supabase Auth role that only sees orders using their
  code. Happy to build this whenever you're ready.
- Order status beyond pending/paid (shipped/delivered, etc.) — easy to add
  as a new enum value and a dashboard action.
- Email/SMS order confirmations — currently the on-screen success page is
  the only confirmation the customer gets.
