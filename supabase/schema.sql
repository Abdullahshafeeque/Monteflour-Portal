-- ============================================================
-- MONTEFLOUR PORTAL — SUPABASE SCHEMA
-- Run this in Supabase Dashboard > SQL Editor (New Query > Run)
-- ============================================================

create table if not exists orders (
  id bigint generated always as identity primary key,
  order_number text not null unique,
  customer_name text not null,
  phone text not null,
  email text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  coupon_code text,
  discount_amount numeric(10,2) not null default 0,
  shipping_fee numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null,
  razorpay_order_id text,
  razorpay_payment_id text,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed')),
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id bigint generated always as identity primary key,
  code text not null unique,
  discount_type text not null default 'percent' check (discount_type in ('percent','flat')),
  discount_value numeric(10,2) not null,
  max_uses integer,
  used_count integer not null default 0,
  min_order_amount numeric(10,2) not null default 0,
  expires_at date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Row Level Security: lock these tables down completely.
-- The Next.js app talks to the database using the SERVICE ROLE key on the
-- server only (in API routes and Server Components/Actions), which bypasses
-- RLS. The public anon key gets zero direct table access — nobody can read
-- or write orders/coupons straight from the browser, even with your project URL.
alter table orders enable row level security;
alter table coupons enable row level security;

-- Example starter coupon — edit or delete this later from the admin portal.
insert into coupons (code, discount_type, discount_value, active)
values ('WELCOME10', 'percent', 10, true)
on conflict (code) do nothing;
