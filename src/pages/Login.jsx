import React, { useState } from 'react'
import { login } from '../api'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      if (data.result) {
        if (!['chefService', 'superAdmin'].includes(data.role)) {
          setError('Accès réservé aux administrateurs');
          setLoading(false);
          return;
        }
        onLogin({
          token: data.token,
          role: data.role,
          nom: data.nom,
          prenom: data.prenom,
          etablissements: data.etablissements,
        });
      } else {
        setError(data.error || 'Identifiant ou mot de passe incorrect');
      }
    } catch {
      setError('Erreur réseau');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>FoodSafe</h1>
        <p>Administration — Connexion</p>
        <input
          type="text"
          placeholder="Identifiant"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
        {error && <div className="login-error">{error}</div>}
      </form>
    </div>
  );
}
