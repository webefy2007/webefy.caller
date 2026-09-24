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

// --- LOGIN - FOR ALL USERS ---
app.post('/api/login', async (req,res)=>{
  const {email,password} = req.body;
  try{
    const {rows} = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if(!rows.length) return res.status(401).json({error:'User not found'});
    const user = rows[0];
    const ok = user.password.startsWith('$2a$') || user.password.startsWith('$2b$')? await bcrypt.compare(password, user.password) : user.password===password;
    if(!ok) return res.status(401).json({error:'Wrong password'});
    const token = jwt.sign({id:user.id, email:user.email, role:user.role||'caller'}, JWT_SECRET, {expiresIn:'7d'});
    res.json({token, role:user.role||'caller', email:user.email});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// --- CLIENTS / LEADS ---
app.get('/api/clients', auth, async (req,res)=>{
  try{
    const {rows} = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
    res.json(rows);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/clients', auth, async (req,res)=>{
  const {name, phone, status, notes} = req.body;
  try{
    const {rows} = await pool.query(
      'INSERT INTO clients (name, phone, status, notes, assigned_to) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, phone, status||'New', notes||'', req.user.email]
    );
    res.json(rows[0]);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.patch('/api/clients/:id', auth, async (req,res)=>{
  try{
    const {status, notes} = req.body;
    await pool.query('UPDATE clients SET status=COALESCE($1,status), notes=COALESCE($2,notes) WHERE id=$3', [status, notes, req.params.id]);
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/clients/:id', auth, async (req,res)=>{
  try{
    await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id]);
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.get('*', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
const PORT = process.env.PORT || 3000;
if(process.env.NODE_ENV!=='production') app.listen(PORT, ()=>console.log('Running '+PORT));
export default app;