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

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});
const JWT_SECRET = process.env.JWT_SECRET || 'webefy_secret_123';

function auth(req,res,next){
  const h = req.headers.authorization;
  if(!h) return res.status(401).json({error:'No token'});
  try{ 
    req.user = jwt.verify(h.replace('Bearer ',''), JWT_SECRET); 
    next(); 
  }catch(e){ 
    return res.status(401).json({error:'Invalid token'}); 
  }
}

// 1. LOGIN
app.post('/api/login', async (req,res)=>{
  const {email,password} = req.body;
  try{
    const {rows} = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if(rows.length===0) return res.status(401).json({error:'Invalid credentials'});
    const user = rows[0];
    const ok = user.password.startsWith('$2') ? await bcrypt.compare(password, user.password) : user.password===password;
    if(!ok) return res.status(401).json({error:'Invalid credentials'});
    const token = jwt.sign({id:user.id, email:user.email}, JWT_SECRET, {expiresIn:'7d'});
    res.json({token});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// 2. GET ALL LEADS (for dashboard)
app.get('/api/clients', auth, async (req,res)=>{
  try{
    const {rows} = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
    res.json(rows);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/api/leads', auth, async (req,res)=>{
  try{
    const {rows} = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
    res.json(rows);
  }catch(e){ res.status(500).json({error:e.message}); }
});

// 3. ADD NEW LEAD - THIS IS WHAT WAS MISSING
app.post('/api/clients', auth, async (req,res)=>{
  const {name, phone, status} = req.body;
  try{
    const {rows} = await pool.query(
      'INSERT INTO clients (name, phone, status) VALUES ($1,$2,$3) RETURNING *',
      [name, phone, status || 'New']
    );
    res.json(rows[0]);
  }catch(e){ 
    console.log(e);
    res.status(500).json({error:e.message}); 
  }
});

// 4. DELETE LEAD
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