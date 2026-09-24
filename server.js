import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const SECRET = process.env.SESSION_SECRET || 'change-this-webefy-secret-12345';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function token(u){
  const payload = Buffer.from(JSON.stringify({ id: u.id, role: u.role, name: u.name, exp: Date.now()+1000*60*60*12 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return payload+'.'+sig;
}
function auth(req,res,next){
  try{
    const t=req.cookies.webefy_session;
    if(!t) return res.status(401).json({error:'Login required'});
    const [p,s]=t.split('.');
    const good = crypto.timingSafeEqual(Buffer.from(s), Buffer.from(crypto.createHmac('sha256',SECRET).update(p).digest('base64url')));
    const u=JSON.parse(Buffer.from(p,'base64url').toString());
    if(!good || u.exp<Date.now()) throw 0;
    req.user=u; next();
  }catch{ res.status(401).json({error:'Session expired'}) }
}
function admin(req,res,next){ if(req.user.role!=='admin') return res.status(403).json({error:'Admin only'}); next(); }

async function seed(){
  try{
    const { data } = await supabase.from('users').select('id').limit(1);
    if(data && data.length>0) return;
    const hash1 = await bcrypt.hash('Admin@123', 10);
    const hash2 = await bcrypt.hash('Caller@123', 10);
    await supabase.from('users').insert([
      { name:'Webefy Admin', email:'admin@webefy.in', password_hash:hash1, role:'admin' },
      { name:'Demo Caller', email:'caller@webefy.in', password_hash:hash2, role:'caller' }
    ]);
    console.log('Seeded admin/caller');
  }catch(e){ console.log('Seed skip:', e.message) }
}
seed();

app.post('/api/login', async (req,res)=>{
  const email = String(req.body.email||'').toLowerCase().trim();
  const { data:u } = await supabase.from('users').select('*').eq('email',email).eq('active',true).single();
  if(!u || !await bcrypt.compare(String(req.body.password||''), u.password_hash)) return res.status(401).json({error:'Invalid email or password'});
  res.cookie('webefy_session', token(u), { httpOnly:true, sameSite:'lax', secure: process.env.NODE_ENV==='production', maxAge:43200000 });
  res.json({ user:{ id:u.id, name:u.name, email:u.email, role:u.role }});
});
app.post('/api/logout',(req,res)=>{ res.clearCookie('webefy_session'); res.json({ok:true}) });
app.get('/api/me', auth, (req,res)=>res.json({user:req.user}));

app.get('/api/users', auth, admin, async (req,res)=>{
  const { data } = await supabase.from('users').select('id,name,email,role,active').order('id',{ascending:false});
  res.json(data||[]);
});
app.post('/api/users', auth, admin, async (req,res)=>{
  try{
    const hash = await bcrypt.hash(req.body.password,10);
    const { data, error } = await supabase.from('users').insert({ name:req.body.name, email:req.body.email.toLowerCase(), password_hash:hash, role: req.body.role==='admin'?'admin':'caller' }).select('id').single();
    if(error) throw error; res.json({id:data.id});
  }catch(e){ res.status(400).json({error:e.message}) }
});

app.get('/api/leads', auth, async (req,res)=>{
  let query = supabase.from('leads').select('*, users!leads_caller_id_fkey(name), batches(name)').order('id',{ascending:false});
  if(req.user.role==='caller') query = query.eq('caller_id', req.user.id);
  const { data } = await query;
  res.json((data||[]).map(l=>({...l, caller_name:l.users?.name, batch_name:l.batches?.name})));
});
app.post('/api/leads', auth, admin, async (req,res)=>{
  const { count } = await supabase.from('leads').select('id',{count:'exact', head:true});
  const code = 'WF-'+String((count||0)+1).padStart(4,'0');
  const { data, error } = await supabase.from('leads').insert({ lead_code:code, caller_id:req.body.caller_id||null, business_name:req.body.business_name, phone:req.body.phone||'', location:req.body.location||'' }).select('id').single();
  if(error) return res.status(400).json({error:error.message});
  res.json({id:data.id, lead_code:code});
});
app.patch('/api/leads/:id', auth, async (req,res)=>{
  const { data:l } = await supabase.from('leads').select('*').eq('id', req.params.id).single();
  if(!l) return res.status(404).json({error:'Lead not found'});
  if(req.user.role!=='admin' && l.caller_id!==req.user.id) return res.status(403).json({error:'Not your lead'});
  const upd = {}; if(req.body.status) upd.status=req.body.status; if(req.body.qualified!=null) upd.qualified=!!req.body.qualified; if(req.body.notes!=null) upd.notes=req.body.notes; if(req.body.follow_up_at) upd.follow_up_at=req.body.follow_up_at; upd.updated_at=new Date().toISOString();
  const { error } = await supabase.from('leads').update(upd).eq('id', req.params.id);
  if(error) return res.status(400).json({error:error.message}); res.json({ok:true});
});
app.post('/api/leads/:id/calls', auth, async (req,res)=>{
  const { data:l } = await supabase.from('leads').select('*').eq('id', req.params.id).single();
  if(!l || req.user.role!=='admin' && l.caller_id!==req.user.id) return res.status(403).json({error:'Not allowed'});
  await supabase.from('calls').insert({ lead_id:l.id, user_id:req.user.id, status:req.body.status||'connected', notes:req.body.notes||'' });
  if(req.body.status) await supabase.from('leads').update({ status:req.body.status, updated_at:new Date().toISOString() }).eq('id', l.id);
  res.json({ok:true});
});
app.get('/api/calls/:leadId', auth, async (req,res)=>{
  const { data } = await supabase.from('calls').select('*, users(name)').eq('lead_id', req.params.leadId).order('id',{ascending:false});
  res.json((data||[]).map(c=>({...c, user_name:c.users?.name})));
});
app.post('/api/sales', auth, async (req,res)=>{
  const { data:l } = await supabase.from('leads').select('*').eq('id', req.body.lead_id).single();
  if(!l || req.user.role!=='admin' && l.caller_id!==req.user.id) return res.status(403).json({error:'Not allowed'});
  const callerId = l.caller_id || req.user.id;
  const { count:qCount } = await supabase.from('leads').select('id',{count:'exact', head:true}).eq('caller_id', callerId).eq('qualified', true);
  const value = Number(req.body.sale_value);
  if(!value || value<10000) return res.status(400).json({error:'Minimum sale value is ₹10,000'});
  const { data, error } = await supabase.from('sales').insert({ lead_id:l.id, caller_id:callerId, sale_value:value }).select('id').single();
  if(error) return res.status(400).json({error:error.message});
  await supabase.from('leads').update({ status:'won', updated_at:new Date().toISOString() }).eq('id', l.id);
  const qualified = qCount||0; const rate = qualified>=20?0.20:qualified>=10?0.15:0.10;
  res.json({ id:data.id, rate, qualified });
});
app.get('/api/sales', auth, async (req,res)=>{
  let q = supabase.from('sales').select('*, leads!inner(lead_code,business_name), users!inner(name)').order('id',{ascending:false});
  if(req.user.role==='caller') q = q.eq('caller_id', req.user.id);
  const { data } = await q;
  const rows = await Promise.all((data||[]).map(async s=>{
    const { data:pay } = await supabase.from('payments').select('amount').eq('sale_id', s.id);
    const paid = (pay||[]).reduce((a,b)=>a+Number(b.amount),0);
    return { ...s, lead_code:s.leads.lead_code, business_name:s.leads.business_name, caller_name:s.users.name, paid };
  }));
  res.json(rows);
});
app.post('/api/payments', auth, async (req,res)=>{
  const { data:s } = await supabase.from('sales').select('*').eq('id', req.body.sale_id).single();
  if(!s || req.user.role!=='admin' && s.caller_id!==req.user.id) return res.status(403).json({error:'Not allowed'});
  const amount = Number(req.body.amount); if(amount<=0) return res.status(400).json({error:'Invalid amount'});
  const { error } = await supabase.from('payments').insert({ sale_id:s.id, amount, note:req.body.note||'' });
  if(error) return res.status(400).json({error:error.message}); res.json({ok:true});
});
app.post('/api/commission/pay', auth, admin, async (req,res)=>{
  const { data:s } = await supabase.from('sales').select('*').eq('id', req.body.sale_id).single();
  if(!s) return res.status(404).json({error:'Sale not found'});
  const { count:q } = await supabase.from('leads').select('id',{count:'exact', head:true}).eq('caller_id', s.caller_id).eq('qualified', true);
  const rate = (q||0)>=20?0.2:(q||0)>=10?0.15:0.1;
  const { data:pay } = await supabase.from('payments').select('amount').eq('sale_id', s.id);
  const received = (pay||[]).reduce((a,b)=>a+Number(b.amount),0);
  const { data:com } = await supabase.from('commission_payments').select('amount').eq('sale_id', s.id);
  const already = (com||[]).reduce((a,b)=>a+Number(b.amount),0);
  const payable = Math.max(0, received*rate - already);
  if(payable<=0) return res.status(400).json({error:'No commission payable yet'});
  await supabase.from('commission_payments').insert({ caller_id:s.caller_id, sale_id:s.id, amount:payable });
  res.json({ paid:payable, rate });
});
app.get('/api/dashboard', auth, async (req,res)=>{
  let leadQ = supabase.from('leads').select('id',{count:'exact', head:true});
  let qualQ = supabase.from('leads').select('id',{count:'exact', head:true}).eq('qualified', true);
  let saleQ = supabase.from('sales').select('sale_value');
  let commQ = supabase.from('commission_payments').select('amount');
  if(req.user.role==='caller'){ leadQ=leadQ.eq('caller_id', req.user.id); qualQ=qualQ.eq('caller_id', req.user.id); saleQ=saleQ.eq('caller_id', req.user.id); commQ=commQ.eq('caller_id', req.user.id); }
  const [{count:leads},{count:qualified},{data:sales}, {data:comms}] = await Promise.all([leadQ, qualQ, saleQ, commQ]);
  const saleAmount = (sales||[]).reduce((a,b)=>a+Number(b.sale_value),0);
  const commissionPaid = (comms||[]).reduce((a,b)=>a+Number(b.amount),0);
  const rate = (qualified||0)>=20?0.2:(qualified||0)>=10?0.15:0.1;
  res.json({ leads:leads||0, qualified:qualified||0, sales:sales?.length||0, saleAmount, commissionPaid, rate });
});

app.get('*', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
const PORT = process.env.PORT||3000;
if(process.env.VERCEL!=="1") app.listen(PORT,()=>console.log(`Running http://localhost:${PORT}`));
export default app;