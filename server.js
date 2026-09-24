import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'webefy_secret_123';

// AUTH MIDDLEWARE
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, role: user.role, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// USERS
app.get('/api/users', auth, async (req, res) => {
  if (req.user.role!== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { rows } = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY id');
  res.json(rows);
});

app.post('/api/users', auth, async (req, res) => {
  if (req.user.role!== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, email, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role', [name, email, hash, role || 'caller']);
  res.json(rows[0]);
});

// LEADS
app.get('/api/leads', auth, async (req, res) => {
  let q = 'SELECT * FROM leads ORDER BY id DESC';
  let params = [];
  if (req.user.role === 'caller') {
    q = 'SELECT * FROM leads WHERE assigned_to=$1 ORDER BY id DESC';
    params = [req.user.id];
  }
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

app.post('/api/leads', auth, async (req, res) => {
  const { name, phone, status, assigned_to, notes } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO leads(name,phone,status,assigned_to,notes,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
    [name, phone, status || 'new', assigned_to || req.user.id, notes || '', req.user.id]
  );
  res.json(rows[0]);
});

app.put('/api/leads/:id', auth, async (req, res) => {
  const { name, phone, status, notes } = req.body;
  const { rows } = await pool.query('UPDATE leads SET name=$1, phone=$2, status=$3, notes=$4 WHERE id=$5 RETURNING *', [name, phone, status, notes, req.params.id]);
  res.json(rows[0]);
});

app.delete('/api/leads/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM leads WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/stats', auth, async (req, res) => {
  const total = await pool.query('SELECT COUNT(*) FROM leads' + (req.user.role === 'caller'? ' WHERE assigned_to=$1' : ''), req.user.role === 'caller'? [req.user.id] : []);
  const today = await pool.query(`SELECT COUNT(*) FROM leads WHERE DATE(created_at)=CURRENT_DATE` + (req.user.role === 'caller'? ' AND assigned_to=$1' : ''), req.user.role === 'caller'? [req.user.id] : []);
  res.json({ total: total.rows[0].count, today: today.rows[0].count });
});

// SERVE FRONTEND
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV!== 'production') {
  app.listen(PORT, () => console.log('Running on ' + PORT));
}

export default app;