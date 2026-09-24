Webefy Caller CRM — Final Full Stack
This is the final single-codebase CRM for Webefy's caller workflow. It uses a real Supabase/PostgreSQL database and a server-side API. The browser never talks to the service-role key.
Features
Admin + Caller login and role permissions
Real persistent database
Lead assignment and caller-only lead visibility
50-lead / 3-day batches
Lead status, qualification, follow-up, notes and call history
Sale creation with ₹10,000 minimum
Installment payment tracking
Commission slabs: 0–9 = 10%, 10–19 = 15%, 20+ = 20%
Commission rate is determined from qualified leads in the sale's batch and applies to all sales in that batch
Commission payment ledger
Webefy-branded responsive dashboard
Setup
Create a Supabase project.
Open Supabase SQL Editor and run supabase/schema.sql.
Copy .env.example to .env and add your Supabase URL, service-role key, and a strong SESSION_SECRET.
Run npm install then npm start for a local preview.
For Vercel, import this repository and add the same environment variables in Project Settings.
Never commit SUPABASE_SERVICE_ROLE_KEY.
Demo accounts: admin@webefy.in / Admin@123 and caller@webefy.in / Caller@123. Change them after setup.
A normal website cannot automatically record regular mobile calls. Recording/click-to-call needs a telephony provider and appropriate consent/privacy handling. Manual call logging is included now.