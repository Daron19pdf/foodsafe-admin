const API = 'https://haccp3-0-backend.vercel.app';

export async function login(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

function headers(token, etablissementId) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-etablissement': etablissementId || '',
  };
}

export async function getCommunes(token) {
  const res = await fetch(`${API}/admin/communes`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

export async function getUsers(token, etablissementId) {
  const res = await fetch(`${API}/admin/users/${etablissementId}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

export async function getEtablissements(token, communeId) {
  const res = await fetch(`${API}/admin/etablissements/${communeId}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

export async function getSaveData(token, etablissementId, startDate, endDate) {
  const res = await fetch(`${API}/saveData?startDate=${startDate}&endDate=${endDate}`, {
    headers: headers(token, etablissementId),
  });
  return res.json();
}

export async function createUser(token, data) {
  const res = await fetch(`${API}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteUser(token, userId) {
  const res = await fetch(`${API}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function resetPassword(token, userId, password) {
  const res = await fetch(`${API}/admin/users/${userId}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  });
  return res.json();
}

export async function updateUserRole(token, userId, role) {
  const res = await fetch(`${API}/admin/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role }),
  });
  return res.json();
}
