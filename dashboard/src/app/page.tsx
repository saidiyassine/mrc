'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Shield, Lock, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate backend auth check
    setTimeout(() => {
      if (email === 'admin@example.com' && password === 'password123') {
        router.push('/dashboard');
      } else {
        setError('Email ou mot de passe incorrect. Utilisez admin@example.com / password123');
        setIsLoading(false);
      }
    }, 600);
  };

  return (
    <div className="auth-container">
      {/* Top Brand Nav */}
      <div style={{
        position: 'absolute',
        top: '2rem',
        left: '3rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        zIndex: 10,
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          background: 'linear-gradient(135deg, #E50914 0%, #990000 100%)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(229, 9, 20, 0.6)',
          fontWeight: 900,
          color: '#fff',
          fontSize: '1.2rem',
        }}>
          N
        </div>
        <span style={{
          fontSize: '1.75rem',
          fontWeight: 900,
          letterSpacing: '0.1em',
          color: '#E50914',
          textTransform: 'uppercase',
          textShadow: '0 0 20px rgba(229, 9, 20, 0.5)',
        }}>
          MRC FLIX
        </span>
      </div>

      <main className="auth-card">
        <header className="auth-header">
          <div className="auth-brand">S&apos;IDENTIFIER</div>
          <p className="auth-subtitle">
            Accédez au centre de contrôle des campagnes, codes promo et bots Telegram.
          </p>
        </header>

        <form onSubmit={handleLogin}>
          {error && (
            <div style={{
              background: 'rgba(229, 9, 20, 0.15)',
              color: '#ff4d4d',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              border: '1px solid rgba(229, 9, 20, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <Shield size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Adresse E-mail</label>
            <input
              id="email-input"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Mot de passe</label>
            <input
              id="password-input"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.95rem',
              marginTop: '1.75rem',
              fontSize: '1rem',
              letterSpacing: '0.03em',
            }}
          >
            {isLoading ? (
              <span>Connexion en cours...</span>
            ) : (
              <>
                <Play size={18} fill="#fff" />
                <span>Entrer dans le Dashboard</span>
              </>
            )}
          </button>

          <div style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: '#777777',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Lock size={13} color="#E50914" />
              <span>Connexion Sécurisée</span>
            </div>
            <span>v2.0 Netflix Edition</span>
          </div>
        </form>
      </main>
    </div>
  );
}
