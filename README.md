# Webefy CRM

Simple CRM built for Webefy

## Stack
- Node.js + Express
- Postgres (Supabase)
- Vercel Hosting

## Setup
1. Clone repo
2. npm install
3. Add .env file: DATABASE_URL, JWT_SECRET
4. Run schema.sql in Supabase
5. npm start

## Default Login
admin@webefy.com / admin123

## Features
- Role based: admin / caller
- Leads CRUD
- Assign leads to callers
- Stats
- JWT Auth

## Deploy on Vercel
- Connect GitHub repo
- Add Env Variables: DATABASE_URL, JWT_SECRET, NODE_ENV=production
- Deploy

## Author
Webefy