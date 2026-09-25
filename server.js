const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Login
app.post('/api/login', async (req, res) => {
  try{
    const { email, password } = req.body;
    const { data, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single();
    if (error ||!data || data.password!== password) return res.status(401).json({error: 'User not found'});
    res.json(data);
  }catch(e){ res.status(500).json({error:e.message}) }
});

// Import
app.post('/api/import', async (req, res) => {
  try{
    const { clients, assigned_to } = req.body;
    const batchName = `Bhopal-Dental-Batch-${Date.now().toString().slice(-4)}`;
    const { data: batch } = await supabase.from('batches').insert({ batch_name: batchName, total_leads: clients.length, assigned_to }).select().single();
    let count=0;
    for(let i=0;i<clients.length;i++){
      const leadId = `WF-BPL-DEN-${String(i+1).padStart(3,'0')}-${Date.now().toString().slice(-3)}`;
      const { error } = await supabase.from('clients').insert({
        lead_id: leadId,
        batch_id: batch.id,
        business_name: clients[i].name,
        phone: clients[i].phone,
        assigned_to,
        call_status: 'Not Called'
      });
      if(!error) count++;
    }
    res.json({ success:true, imported:count, batch:batchName });
  }catch(e){ res.status(500).json({error:e.message}) }
});

// Get leads
app.get('/api/leads/:email', async (req, res) => {
  const { data } = await supabase.from('clients').select('*').eq('assigned_to', req.params.email).order('id');
  res.json(data || []);
});

// Update status
app.post('/api/update-status', async (req, res) => {
  const { lead_id, call_status, notes, caller_email } = req.body;
  await supabase.from('clients').update({ call_status, notes }).eq('lead_id', lead_id);
  await supabase.from('calls_history').insert({ lead_id, caller_email, call_status, notes });
  res.json({ success:true });
});

app.get('/api/test', (req,res)=> res.json({ok:true, env:!!process.env.SUPABASE_URL}));

module.exports = app;