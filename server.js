import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'webefy-secret-123';

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);
    const check = await pool.query("SELECT * FROM users WHERE email='admin@webefу.com' OR email='admin@webefу.com' OR email='admin@webefy.com'");
    // We will ensure correct email exists
    await pool.query("DELETE FROM users WHERE email LIKE '%webef%'");
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query("INSERT INTO users (email, password) VALUES ($1, $2)", ['admin@webefy.com', hash]);
    console.log('Admin ready: admin@webefy.com / admin123');
  } catch (e) {
    console.error('DB Init Error:', e.message);
  }
}
initDB();

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', email);
  if (!email ||!password) return res.status(400).json({ error: 'Missing fields' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email.trim()]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email' });

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Running on', PORT));
export default app;