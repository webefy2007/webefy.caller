const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.post('/api/login', async (req,res)=>{
  const { email, password } = req.body;
  const { data } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single();
  if(!data || data.password!== password) return res.status(401).json({error:'Invalid login'});
  res.json(data);
});

app.post('/api/import', async (req,res)=>{
  try{
    const { clients, assigned_to } = req.body;
    const batchName = `Bhopal-Batch-${Date.now()}`;
    const { data: batch } = await supabase.from('batches').insert({ batch_name: batchName, total_leads: clients.length, assigned_to }).select().single();
    let count=0;
    for(let i=0;i<clients.length;i++){
      const leadId = `WF-${Date.now()}-${i}`;
      const { error } = await supabase.from('clients').insert({
        lead_id: leadId, batch_id: batch.id,
        business_name: clients[i].name || clients[i].business_name,
        phone: clients[i].phone, assigned_to, call_status: 'Not Called'
      });
      if(!error) count++;
    }
    res.json({success:true, imported:count, batch:batchName});
  }catch(e){ res.status(500).json({error:e.message}) }
});

app.get('/api/leads/:email', async (req,res)=>{
  const { data } = await supabase.from('clients').select('*').eq('assigned_to', req.params.email);
  res.json(data||[]);
});

app.post('/api/update-status', async (req,res)=>{
  const { lead_id, call_status, notes, caller_email } = req.body;
  await supabase.from('clients').update({call_status, notes}).eq('lead_id', lead_id);
  await supabase.from('calls_history').insert({lead_id, caller_email, call_status, notes});
  res.json({success:true});
});

app.get('/api/test', (req,res)=> res.json({ok:true}));

module.exports = app;