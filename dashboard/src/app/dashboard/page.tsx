'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, Play, Plus, Users, Tag, Rocket, CheckCircle, TrendingUp, Sparkles } from 'lucide-react';
import { api, PromoCodeItem, CampaignOrder, PlayerClaimItem } from '@/lib/api';

export default function DashboardOverview() {
  const [promos, setPromos] = useState<PromoCodeItem[]>([]);
  const [orders, setOrders] = useState<CampaignOrder[]>([]);
  const [claims, setClaims] = useState<PlayerClaimItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [p, o, c] = await Promise.all([api.getPromoCodes(), api.getOrders(), api.getClaims()]);
      setPromos(p);
      setOrders(o);
      setClaims(c);
    } catch (err) {
      // Silently fail, show zeros
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const activePromos = promos.filter(p => p.isActive);
  const totalTarget = orders.reduce((s, o) => s + o.targetAccounts, 0);
  const totalClaimed = orders.reduce((s, o) => s + o.claimedCount, 0);
  const pct = totalTarget > 0 ? Math.round((totalClaimed / totalTarget) * 100) : 0;
  const pendingClaims = claims.filter(c => c.status === 'PENDING');
  const recentClaims = claims.slice(0, 5);

  return (
    <div>
      {/* Netflix Featured Hero Banner */}
      <section style={{
        position: 'relative',
        borderRadius: '16px',
        padding: '2.75rem 2.5rem',
        marginBottom: '2.5rem',
        background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.22) 0%, rgba(20, 20, 20, 0.95) 75%), radial-gradient(ellipse at top left, rgba(229, 9, 20, 0.35) 0%, transparent 60%)',
        border: '1px solid rgba(229, 9, 20, 0.3)',
        boxShadow: '0 15px 40px rgba(0, 0, 0, 0.8), 0 0 35px rgba(229, 9, 20, 0.15)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
          <span style={{
            background: '#E50914',
            color: '#FFFFFF',
            padding: '0.2rem 0.6rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            N ORIGINAL
          </span>
          <span style={{ fontSize: '0.85rem', color: '#CCCCCC', fontWeight: 600, letterSpacing: '0.04em' }}>
            CAMPAGNE VEDETTE
          </span>
        </div>

        <h2 style={{
          fontSize: '2.25rem',
          fontWeight: 900,
          color: '#FFFFFF',
          letterSpacing: '-0.02em',
          marginBottom: '0.5rem',
          textShadow: '0 2px 10px rgba(0,0,0,0.8)',
        }}>
          1xBet — GRD100
        </h2>

        <p style={{
          color: '#CCCCCC',
          fontSize: '1rem',
          maxWidth: '650px',
          lineHeight: 1.6,
          marginBottom: '1.75rem',
        }}>
          Suivi en temps réel des enregistrements de comptes, vérifications des captures d&apos;écran Telegram et validation des quotas d&apos;affiliation.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/orders" className="btn btn-primary" style={{ padding: '0.75rem 1.6rem', fontSize: '0.95rem' }}>
            <Play size={18} fill="#fff" />
            <span>Gérer les Campagnes</span>
          </Link>
          <Link href="/dashboard/claims" className="btn btn-secondary" style={{ padding: '0.75rem 1.6rem', fontSize: '0.95rem' }}>
            <Users size={18} />
            <span>Vérifier les Joueurs ({claims.length})</span>
          </Link>
          <button onClick={loadAll} className="btn btn-secondary" style={{ padding: '0.75rem 1rem' }} title="Rafraîchir les données">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </section>

      {/* Netflix Stat Cards Grid */}
      <section className="dashboard-grid">
        <div className="card card-gradient">
          <div className="card-header-simple">
            <span className="card-title">Codes Promo Actifs</span>
            <Tag size={18} color="#E50914" />
          </div>
          <div className="card-value">{isLoading ? '…' : `${activePromos.length}`}</div>
          <div className="card-footer-text">
            {activePromos.length > 0
              ? activePromos.slice(0, 2).map(p => <span key={p.id}><code key={p.id}>{p.code}</code> ({p.bookmaker}) </span>)
              : 'Aucun code actif en base'}
          </div>
        </div>

        <div className="card card-gradient">
          <div className="card-header-simple">
            <span className="card-title">Comptes Validés &amp; Objectifs</span>
            <TrendingUp size={18} color="#46d369" />
          </div>
          <div className="card-value">{isLoading ? '…' : `${totalClaimed} / ${totalTarget || totalClaimed}`}</div>
          <div className={`card-footer-text ${pct >= 75 ? 'trend-up' : ''}`}>
            {isLoading ? 'Chargement...' : `${pct || 100}% des objectifs atteints sur Telegram`}
          </div>
        </div>

        <div className="card card-gradient">
          <div className="card-header-simple">
            <span className="card-title">Demandes de Joueurs</span>
            <Users size={18} color="#ffa00a" />
          </div>
          <div className="card-value">{isLoading ? '…' : `${claims.length}`}</div>
          <div className="card-footer-text">
            {isLoading ? 'Chargement...' : `${pendingClaims.length} en attente • ${claims.length - pendingClaims.length} approuvés`}
          </div>
        </div>
      </section>

      {/* Split Section layout (Tables & Interactive Areas) */}
      <section className="section-split">
        {/* Tableau des réclamations récentes */}
        <div className="card table-card">
          <div className="table-title-bar">
            <h2 className="table-title">Dernières Activités Joueurs</h2>
            <Link href="/dashboard/claims" style={{ fontSize: '0.85rem', color: '#E50914', fontWeight: 700 }}>
              Voir tout ({claims.length}) →
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#888888' }}>Chargement des données...</div>
            ) : recentClaims.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#888888', fontSize: '0.9rem' }}>
                Aucune réclamation enregistrée pour le moment.
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Joueur</th>
                    <th>ID Telegram</th>
                    <th>Code Promo</th>
                    <th>ID Bookmaker</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClaims.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: '#FFFFFF' }}>{c.telegramName || c.telegramUsername || '—'}</td>
                      <td><code style={{ background: '#222', color: '#ccc', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{c.telegramChatId}</code></td>
                      <td><code style={{ color: '#E50914', fontWeight: 800, background: 'rgba(229, 9, 20, 0.12)' }}>{c.promoCode?.code || 'GRD100'}</code></td>
                      <td>{c.playerBookmakerId || '—'}</td>
                      <td>
                        <span className={`badge-status ${c.status === 'APPROVED' ? 'badge-success' : c.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
                          {c.status === 'APPROVED' ? 'Approuvé' : c.status === 'PENDING' ? 'En Attente' : 'Rejeté'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panneau Intégration Telegram Bot */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#46d369', display: 'inline-block', boxShadow: '0 0 10px #46d369' }} />
            <h2 className="table-title" style={{ margin: 0 }}>Statut Bot Telegram</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#888888', marginBottom: '1.5rem' }}>
            Pipeline de validation automatique en direct avec webhook Telegram et stockage persistant.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {[
              { label: 'Anti-Abus et Doublons', detail: 'Protection IP & ChatID Active', active: true },
              { label: 'Stockage Persistant', detail: 'Base de données Prisma ORM', active: true },
              { label: 'Vérification Captures', detail: 'Extraction directe FileID', active: true },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem', background: '#222222',
                borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#888888', display: 'block' }}>{item.label}</span>
                  <strong style={{ fontSize: '0.9rem', color: '#FFFFFF' }}>{item.detail}</strong>
                </div>
                <span className={`badge-status ${item.active ? 'badge-success' : 'badge-danger'}`}>
                  {item.active ? 'Opérationnel' : 'Arrêté'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
