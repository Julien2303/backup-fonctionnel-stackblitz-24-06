'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isButtonHovered, setIsButtonHovered] = useState<boolean>(false); // Ajout pour gérer le survol
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    console.log('Tentative de connexion avec:', { email, password });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Erreur de connexion:', error.message);
      setError(error.message);
    } else {
      console.log('Connexion réussie:', data);
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('Session après connexion:', sessionData.session);
      console.log('Cookies après connexion:', document.cookie);
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '50px auto 0',
        padding: '20px',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          width: '100%',
          border: '1px solid #e5e7eb',
        }}
      >
        <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>Connexion</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '16px' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="submit"
              style={{
                padding: '10px 24px',
                background: isButtonHovered ? '#1d4ed8' : '#2563eb', // Gestion du survol
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={() => setIsButtonHovered(true)}
              onMouseLeave={() => setIsButtonHovered(false)}
            >
              Se connecter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
