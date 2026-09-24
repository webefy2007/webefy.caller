async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const btn = document.getElementById('loginBtn');
  const msg = document.getElementById('msg');

  if (!email ||!password) { msg.innerText = 'Enter email & password'; return; }

  btn.innerText = 'Logging in...';
  btn.disabled = true;
  msg.innerText = '';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    localStorage.setItem('token', data.token);
    msg.style.color = 'green';
    msg.innerText = 'Success! Redirecting...';
    setTimeout(() => window.location.href = '/dashboard.html', 500);
  } catch (e) {
    msg.style.color = 'red';
    msg.innerText = e.message;
    btn.innerText = 'Login';
    btn.disabled = false;
  }
}

document.getElementById('loginBtn')?.addEventListener('click', login);