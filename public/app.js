const API = '/api';
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user')||'null');

function saveAuth(t,u){ token=t; user=u; localStorage.setItem('token',t); localStorage.setItem('user',JSON.stringify(u)); }
function logout(){ localStorage.clear(); location.reload(); }
function headers(){ return { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token } }

const app = document.getElementById('app');
const userBox = document.getElementById('userBox');

async function api(path, opts={}){
  opts.headers = headers();
  const r = await fetch(API+path, opts);
  if(r.status===401) logout();
  return r.json();
}

function renderLogin(){
  app.innerHTML = `<div class="login-wrap card"><h2>Webefy CRM Login</h2>
  <input id="email" class="input" placeholder="Email" value="admin@webefy.com">
  <input id="pass" class="input" type="password" placeholder="Password" value="admin123">
  <button class="btn" id="loginBtn" style="width:100%;margin-top:10px">Login</button>
  <p style="margin-top:10px;font-size:13px;color:#64748b">Default admin: admin@webefy.com / admin123</p>
  </div>`;
  document.getElementById('loginBtn').onclick = async ()=>{
    const email=document.getElementById('email').value;
    const password=document.getElementById('pass').value;
    const res=await fetch(API+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const data=await res.json();
    if(data.token){ saveAuth(data.token,data.user); render(); } else alert(data.error||'Login failed');
  }
}

async function renderDashboard(){
  userBox.innerHTML = `${user.name} (${user.role}) <button class="btn btn-sm" onclick="localStorage.clear();location.reload()">Logout</button>`;
  const stats = await api('/stats');
  const leads = await api('/leads');
  const users = user.role==='admin' ? await api('/users') : [];
  let usersOptions = users.map(u=>`<option value="${u.id}">${u.name} - ${u.role}</option>`).join('');
  app.innerHTML = `
  <div class="grid">
    <div class="card"><h3>Total Leads</h3><h1>${stats.total}</h1></div>
    <div class="card"><h3>Today</h3><h1>${stats.today}</h1></div>
    <div class="card"><h3>My Role</h3><h1>${user.role}</h1></div>
  </div>
  <div class="card">
    <div class="flex"><h2>Add Lead</h2></div>
    <div class="flex">
      <input id="lname" class="input" placeholder="Name">
      <input id="lphone" class="input" placeholder="Phone">
      <select id="lstatus" class="input"><option>new</option><option>callback</option><option>won</option><option>lost</option></select>
      ${user.role==='admin'? `<select id="lassign" class="input"><option value="">Assign to</option>${usersOptions}</select>` : ''}
      <button class="btn" id="addLead">Add</button>
    </div>
  </div>
  ${user.role==='admin'? `
  <div class="card">
    <h2>Add User (Caller/Admin)</h2>
    <div class="flex">
      <input id="uname" class="input" placeholder="Name">
      <input id="uemail" class="input" placeholder="Email">
      <input id="upass" class="input" placeholder="Password">
      <select id="urole" class="input"><option value="caller">caller</option><option value="admin">admin</option></select>
      <button class="btn" id="addUser">Create User</button>
    </div>
  </div>` : ''}
  <div class="card">
    <h2>Leads (${leads.length})</h2>
    <div style="overflow:auto">
    <table class="table"><thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead><tbody>
    ${leads.map(l=>`<tr>
      <td>${l.id}</td><td>${l.name}</td><td>${l.phone}</td>
      <td><span class="badge badge-${l.status}">${l.status}</span></td>
      <td><input class="input" value="${l.notes||''}" onchange="updateNote(${l.id},this.value,'${l.name}','${l.phone}','${l.status}')" style="margin:0;padding:6px"></td>
      <td><select onchange="updateStatus(${l.id},'${l.name}','${l.phone}',this.value,'${l.notes||''}')" class="input" style="margin:0;padding:6px"><option ${l.status==='new'?'selected':''}>new</option><option ${l.status==='callback'?'selected':''}>callback</option><option ${l.status==='won'?'selected':''}>won</option><option ${l.status==='lost'?'selected':''}>lost</option></select> <button class="btn btn-sm btn-danger" onclick="delLead(${l.id})">X</button></td>
    </tr>`).join('')}
    </tbody></table></div>
  </div>`;
  document.getElementById('addLead')?.addEventListener('click', async ()=>{
    const name=document.getElementById('lname').value; const phone=document.getElementById('lphone').value;
    const status=document.getElementById('lstatus').value; const assigned_to=document.getElementById('lassign')?.value||null;
    if(!name||!phone) return alert('Name Phone required');
    await api('/leads',{method:'POST',body:JSON.stringify({name,phone,status,assigned_to})}); renderDashboard();
  });
  document.getElementById('addUser')?.addEventListener('click', async ()=>{
    const name=document.getElementById('uname').value; const email=document.getElementById('uemail').value;
    const password=document.getElementById('upass').value; const role=document.getElementById('urole').value;
    await api('/users',{method:'POST',body:JSON.stringify({name,email,password,role})}); alert('User created'); renderDashboard();
  });
}

window.updateStatus = async (id,name,phone,status,notes)=>{ await api('/leads/'+id,{method:'PUT',body:JSON.stringify({name,phone,status,notes})}); };
window.updateNote = async (id,value,name,phone,status)=>{ await api('/leads/'+id,{method:'PUT',body:JSON.stringify({name,phone,status,notes:value})}); };
window.delLead = async (id)=>{ if(confirm('Delete?')){ await api('/leads/'+id,{method:'DELETE'}); renderDashboard(); } };

function render(){ if(!token) renderLogin(); else renderDashboard(); }
render();