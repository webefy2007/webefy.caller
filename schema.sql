-- Run this in Supabase SQL Editor
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'caller',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  assigned_to INTEGER REFERENCES users(id),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert Admin (password: admin123)
INSERT INTO users(name,email,password_hash,role) VALUES('Admin','admin@webefy.com','$2a$10$Qh3L4w6gXr8bK9yJtUvOeOY8v7c6d5e4f3g2h1i0j9k8l7m6n5o4p3q','admin');