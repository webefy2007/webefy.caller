import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { Pool } = pg;
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const JWT_SECRET = process.env.JWT_SECRET || 'webefy_secret_123';

function auth(req,res,next){
  const h = req.headers.authorization;
  if(!h) return res.status(401).json({error:'No token'});
  try{ req.user = jwt.verify(h.replace('Bearer ',''), JWT_SECRET); next(); }
  catch(e){ return res.status(401).json({error:'Invalid token'}); }
}

app.post('/api/login', async (req,res)=>{
  const {email,password} = req.body;
  try{
    const {rows} = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if(!rows.length) return res.status(401).json({error:'User not found'});
    const user = rows[0];
    const ok = user.password.startsWith('$2a$') || user.password.startsWith('$2b$') ? await bcrypt.compare(password, user.password) : user.password===password;
    if(!ok) return res.status(401).json({error:'Wrong password'});
    const token = jwt.sign({id:user.id, email:user.email, role:user.role||'caller'}, JWT_SECRET, {expiresIn:'7d'});
    res.json({token, role:user.role||'caller', email:user.email});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// SYSTEM B - FILTER BY ROLE
app.get('/api/clients', auth, async (req,res)=>{
  try{
    let q = 'SELECT * FROM clients ORDER BY created_at DESC';
    let p = [];
    if(req.user.role !== 'admin'){
      q = 'SELECT * FROM clients WHERE assigned_to=$1 ORDER BY created_at DESC';
      p = [req.user.email];
    }
    const {rows} = await pool.query(q, p);
    res.json(rows);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/clients', auth, async (req,res)=>{
  const {name, phone, status, notes, assigned_to} = req.body;
  try{
    // If admin assigns to someone, use that. If caller adds, assign to himself.
    let owner = req.user.role==='admin' && assigned_to ? assigned_to : req.user.email;
    const {rows} = await pool.query(
      'INSERT INTO clients (name, phone, status, notes, assigned_to) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, phone, status||'New', notes||'', owner]
    );
    res.json(rows[0]);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.patch('/api/clients/:id', auth, async (req,res)=>{
  try{
    const {status, notes, assigned_to} = req.body;
    if(assigned_to && req.user.role!=='admin') return res.status(403).json({error:'Only admin can re-assign'});
    await pool.query(
      'UPDATE clients SET status=COALESCE($1,status), notes=COALESCE($2,notes), assigned_to=COALESCE($3,assigned_to) WHERE id=$4',
      [status, notes, assigned_to, req.params.id]
    );
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/clients/:id', auth, async (req,res)=>{
  try{
    await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id]);
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/api/users', auth, async (req,res)=>{
  if(req.user.role!=='admin') return res.status(403).json([]);
  const {rows} = await pool.query("SELECT email FROM users WHERE role='caller'");
  res.json(rows);
});

app.get('*', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
const PORT = process.env.PORT || 3000;
if(process.env.NODE_ENV!=='production') app.listen(PORT, ()=>console.log('Running '+PORT));
export default app;