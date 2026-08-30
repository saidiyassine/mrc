'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Tag, 
  Rocket, 
  Users, 
  Bot, 
  LogOut, 
  Bell, 
  Sparkles,
  Database,
  BarChart3,
  Loader2,
  CheckCircle2,
  X,
  RefreshCw,
  TrendingUp,
  Server,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  Cpu,
  Search,
  Plus,
  Trash2,
  UserMinus,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  ImageIcon,
  Check,
  RotateCcw,
  ShieldCheck,
  Send,
  Copy,
  ExternalLink,
  UserCheck,
  History,
  Zap,
} from 'lucide-react';
import { api, DatabaseStats, PromoCodeItem, DetailedPromoCodeItem, RecoveredCandidate, RecoveryScanResult } from '@/lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);

  // Stats Modal State
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');

  // Detailed Promo Codes Modal State
  const [showPromoDetailsModal, setShowPromoDetailsModal] = useState(false);
  const [promoDetailsList, setPromoDetailsList] = useState<DetailedPromoCodeItem[]>([]);
  const [loadingPromoDetails, setLoadingPromoDetails] = useState(false);
  const [promoSearch, setPromoSearch] = useState('');
  const [promoStatusFilter, setPromoStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [expandedPromoId, setExpandedPromoId] = useState<string | null>(null);

  // Recovery Hub State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryData, setRecoveryData] = useState<RecoveryScanResult | null>(null);
  const [loadingRecovery, setLoadingRecovery] = useState(false);
  const [isRestoringGrd100, setIsRestoringGrd100] = useState(false);
  const [restorationNotice, setRestorationNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recoverySearch, setRecoverySearch] = useState('');
  const [recoveryBookmaker, setRecoveryBookmaker] = useState('1xBet');
  const [recoveryStatus, setRecoveryStatus] = useState<'APPROVED' | 'PENDING'>('APPROVED');
  const [pingingChatId, setPingingChatId] = useState<string | null>(null);
  const [copiedChatId, setCopiedChatId] = useState<string | null>(null);
  const [bulkPasteIds, setBulkPasteIds] = useState('');
  
  // Manual Verify in Recovery Hub
  const [manualChatIdInput, setManualChatIdInput] = useState('');
  const [manualVerifying, setManualVerifying] = useState(false);
  const [manualVerifiedResult, setManualVerifiedResult] = useState<any | null>(null);

  // Bulk Add Consumptions State
  const [promoCodesList, setPromoCodesList] = useState<PromoCodeItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPromoId, setSelectedPromoId] = useState('');
  const [userInputs, setUserInputs] = useState('');
  const [consumptionStatus, setConsumptionStatus] = useState<'APPROVED' | 'PENDING' | 'REJECTED'>('APPROVED');
  const [isAdding, setIsAdding] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [data, promos] = await Promise.all([
        api.getDatabaseStats(),
        api.getPromoCodes(),
      ]);
      setStats(data);
      setPromoCodesList(promos);
      if (promos.length > 0 && !selectedPromoId) {
        setSelectedPromoId(promos[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load database stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [selectedPromoId]);

  const fetchRecoveryScan = useCallback(async () => {
    setLoadingRecovery(true);
    setRestorationNotice(null);
    try {
      const data = await api.getRecoveryScan();
      setRecoveryData(data);
    } catch (err: any) {
      console.error('Failed to load recovery scan:', err);
      setRestorationNotice({ type: 'error', text: `Erreur scan: ${err.message}` });
    } finally {
      setLoadingRecovery(false);
    }
  }, []);

  const handleOpenRecovery = () => {
    setShowRecoveryModal(true);
    fetchRecoveryScan();
  };

  const handleRestoreTopTen = async () => {
    setIsRestoringGrd100(true);
    setRestorationNotice(null);
    try {
      const res = await api.restoreTopTenGrd100({
        bookmaker: recoveryBookmaker,
        status: recoveryStatus,
      });
      setRestorationNotice({
        type: 'success',
        text: `🎉 Succès ! ${res.newlyCreatedCount + res.updatedCount} joueurs ont été restaurés avec le code promo ${res.promoCode} (${res.bookmaker}) en statut ${recoveryStatus}.`,
      });
      await fetchRecoveryScan();
      fetchStats();
    } catch (err: any) {
      setRestorationNotice({ type: 'error', text: `Erreur lors de la restauration: ${err.message}` });
    } finally {
      setIsRestoringGrd100(false);
    }
  };

  const handleRestoreSinglePlayer = async (cand: RecoveredCandidate) => {
    try {
      await api.restoreCustomPlayers({
        promoCode: 'GRD100',
        bookmaker: recoveryBookmaker,
        status: recoveryStatus,
        players: [{
          telegramChatId: cand.telegramChatId,
          telegramUsername: cand.telegramUsername || cand.telegramProfile.username || null,
          telegramName: cand.telegramName || cand.telegramProfile.firstName || null,
          playerBookmakerId: cand.playerBookmakerId || `ID: ${1781100000 + Math.floor(Math.random() * 90000)}`,
          screenshotUrl: cand.screenshotUrl || null,
        }],
      });
      setRestorationNotice({
        type: 'success',
        text: `Joueur ${cand.telegramName} (${cand.telegramChatId}) restauré avec succès pour GRD100 !`,
      });
      await fetchRecoveryScan();
      fetchStats();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handlePingUser = async (chatId: string) => {
    setPingingChatId(chatId);
    try {
      await api.pingTelegramUser({
        telegramChatId: chatId,
        message: `✅ <b>تأكيد استعادة الحساب</b>\n\nمرحباً بك! تم تأكيد وتفعيل حسابك بنجاح للرمز الترويجي <code>GRD100</code> في لوحة التحكم. 🎉`,
      });
      alert(`✅ Message de confirmation envoyé avec succès à l'utilisateur ${chatId} via Telegram !`);
    } catch (err: any) {
      alert(`⚠️ Impossible d'envoyer le message: ${err.message}`);
    } finally {
      setPingingChatId(null);
    }
  };

  const handleManualVerify = async () => {
    if (!manualChatIdInput.trim()) return;
    setManualVerifying(true);
    setManualVerifiedResult(null);
    try {
      const res = await api.verifyTelegramChat(manualChatIdInput.trim());
      setManualVerifiedResult(res);
    } catch (err: any) {
      setManualVerifiedResult({ error: err.message });
    } finally {
      setManualVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChatId(text);
    setTimeout(() => setCopiedChatId(null), 2000);
  };

  const handleOpenStats = () => {
    setShowStatsModal(true);
    fetchStats();
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPromoId) {
      alert('Veuillez sélectionner un code promo.');
      return;
    }
    if (!userInputs.trim()) {
      alert('Veuillez entrer au moins un User ID ou un nombre.');
      return;
    }

    setIsAdding(true);
    setActionNotice(null);
    try {
      const res = await api.bulkAddConsumptions({
        promoCodeId: selectedPromoId,
        userInputs,
        status: consumptionStatus,
      });
      setActionNotice({ type: 'success', text: res.message });
      setUserInputs('');
      setShowAddModal(false);
      await fetchStats();
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || 'Erreur lors de l\'ajout des consommations' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteUserPromo = async (telegramChatId: string, promoCodeId?: string, promoCodeName?: string) => {
    const confirmMsg = promoCodeId
      ? `Êtes-vous sûr de vouloir supprimer la consommation du code ${promoCodeName} pour l'utilisateur ${telegramChatId} ? Il pourra consommer ce code à nouveau.`
      : `Êtes-vous sûr de vouloir supprimer TOUTES les consommations de l'utilisateur ${telegramChatId} ?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await api.deleteUserClaims(telegramChatId, promoCodeId);
      setActionNotice({ type: 'success', text: res.message || 'Consommation supprimée avec succès.' });
      await fetchStats();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      alert(`Erreur lors de la suppression: ${err.message}`);
    }
  };

  const filteredPlayers = (stats?.players || []).filter(p => {
    if (!playerSearch) return true;
    const q = playerSearch.toLowerCase();
    return (
      p.telegramChatId.toLowerCase().includes(q) ||
      (p.telegramName && p.telegramName.toLowerCase().includes(q)) ||
      (p.telegramUsername && p.telegramUsername.toLowerCase().includes(q)) ||
      p.promoCodes.some(c => 
        c.code.toLowerCase().includes(q) || 
        c.bookmaker.toLowerCase().includes(q) || 
        (c.playerBookmakerId && c.playerBookmakerId.toLowerCase().includes(q))
      )
    );
  });

  const fetchPromoDetails = useCallback(async () => {
    setLoadingPromoDetails(true);
    try {
      const data = await api.getPromoCodesDetailed();
      setPromoDetailsList(data);
    } catch (err: any) {
      console.error('Failed to load promo code details:', err);
    } finally {
      setLoadingPromoDetails(false);
    }
  }, []);

  const handleOpenPromoDetails = () => {
    setShowPromoDetailsModal(true);
    fetchPromoDetails();
  };

  const handleTogglePromoActive = async (id: string) => {
    try {
      const updated = await api.togglePromoCode(id);
      setPromoDetailsList(prev => prev.map(p => p.id === id ? { ...p, isActive: updated.isActive } : p));
      fetchStats();
    } catch (err: any) {
      alert(`Erreur lors de la mise à jour: ${err.message}`);
    }
  };

  const filteredDetailedPromos = promoDetailsList.filter(p => {
    if (promoStatusFilter === 'ACTIVE' && !p.isActive) return false;
    if (promoStatusFilter === 'INACTIVE' && p.isActive) return false;
    if (!promoSearch) return true;
    const q = promoSearch.toLowerCase();
    return (
      p.code.toLowerCase().includes(q) ||
      p.bookmaker.toLowerCase().includes(q) ||
      p.claims.some(c => 
        c.telegramChatId.toLowerCase().includes(q) || 
        (c.telegramUsername && c.telegramUsername.toLowerCase().includes(q)) ||
        (c.telegramName && c.telegramName.toLowerCase().includes(q)) ||
        (c.playerBookmakerId && c.playerBookmakerId.toLowerCase().includes(q))
      )
    );
  });

  // Image Lightbox & Upload State
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [uploadingPromoImageId, setUploadingPromoImageId] = useState<string | null>(null);

  const handleUploadPromoImage = async (promoId: string, file: File) => {
    setUploadingPromoImageId(promoId);
    try {
      const uploadRes = await api.uploadPromoImage(file);
      await api.updatePromoCodeImage(promoId, uploadRes.url);
      await fetchPromoDetails();
      await fetchStats();
    } catch (err: any) {
      alert(`Erreur lors du téléversement de l'image: ${err.message}`);
    } finally {
      setUploadingPromoImageId(null);
    }
  };

  const handleBackup = async () => {
    try {
      setIsBackingUp(true);
      await api.downloadBackup();
      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 3000);
    } catch (err: any) {
      alert(`Erreur lors de la sauvegarde: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const menuItems = [
    { name: 'Vue Générale', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Codes Promo', href: '/dashboard/promocodes', icon: Tag },
    { name: 'Ordres & Campagnes', href: '/dashboard/orders', icon: Rocket },
    { name: 'Joueurs & Vérifications', href: '/dashboard/claims', icon: Users },
    { name: 'Simulateur Bot', href: '/dashboard/simulator', icon: Bot },
  ];

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Sparkles size={18} color="#fff" />
          </div>
          <span>AFFILIATE HUB</span>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className={`sidebar-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Recovery Hub Button */}
            <button
              onClick={handleOpenRecovery}
              className="sidebar-item"
              style={{
                width: '100%',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(234, 88, 12, 0.12) 100%)',
                color: '#fbbf24',
                cursor: 'pointer',
                fontWeight: 700,
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 10px rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <RotateCcw size={18} color="#fbbf24" />
              <span>Restaurer Joueurs (GRD100)</span>
            </button>

            {/* Promo Codes Details Button */}
            <button
              onClick={handleOpenPromoDetails}
              className="sidebar-item"
              style={{
                width: '100%',
                border: 'none',
                background: 'rgba(99, 102, 241, 0.08)',
                color: 'var(--accent-primary, #6366f1)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              <Tag size={18} />
              <span>Détails Codes Promo</span>
            </button>

            {/* Stats Button */}
            <button
              onClick={handleOpenStats}
              className="sidebar-item"
              style={{
                width: '100%',
                border: 'none',
                background: 'rgba(6, 182, 212, 0.08)',
                color: 'var(--accent-secondary, #06b6d4)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              <BarChart3 size={18} />
              <span>Statistiques BDD</span>
            </button>

            {/* Backup Button */}
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              className="sidebar-item"
              style={{
                width: '100%',
                border: 'none',
                background: backupSuccess 
                  ? 'rgba(34, 197, 94, 0.15)' 
                  : 'rgba(255, 255, 255, 0.04)',
                color: backupSuccess ? '#22c55e' : 'var(--text-secondary)',
                cursor: isBackingUp ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              {isBackingUp ? (
                <Loader2 size={18} className="animate-spin" />
              ) : backupSuccess ? (
                <CheckCircle2 size={18} color="#22c55e" />
              ) : (
                <Database size={18} />
              )}
              <span>
                {isBackingUp 
                  ? 'Exportation...' 
                  : backupSuccess 
                  ? 'Sauvegardé !' 
                  : 'Sauvegarder BDD'}
              </span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">AM</div>
          <div className="user-info">
            <span className="user-name">Affiliate Manager</span>
            <span className="user-role">Gambling Operations</span>
          </div>
          <Link href="/" style={{ marginLeft: 'auto', display: 'flex', color: 'var(--text-muted)' }} className="btn-icon">
            <LogOut size={16} />
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="header">
          <div className="header-title-container">
            <h1 className="header-title">Gambling Affiliate Control Center</h1>
            <p className="header-subtitle">Gestion automatique des codes promo, ordres de comptes &amp; bot Telegram</p>
          </div>

          <div className="header-actions">
            <button 
              onClick={handleOpenRecovery} 
              className="btn" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                padding: '0.6rem 1.1rem',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 88, 12, 0.15) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fbbf24',
                fontWeight: 600,
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)',
              }}
            >
              <RotateCcw size={16} color="#fbbf24" />
              <span>Restaurer Joueurs (GRD100)</span>
            </button>
            <button 
              onClick={handleOpenPromoDetails} 
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}
            >
              <Tag size={16} color="var(--accent-primary)" />
              <span>Détails Codes Promo</span>
            </button>
            <button 
              onClick={handleOpenStats} 
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}
            >
              <Activity size={16} color="var(--accent-secondary)" />
              <span>Statistiques BDD</span>
            </button>
            <div className="badge-wrapper">
              <button className="btn-icon" aria-label="Notifications">
                <Bell size={18} />
              </button>
              <div className="badge-dot" />
            </div>
          </div>
        </header>

        <main className="content-body">
          {children}
        </main>
      </div>

      {/* Recovery Hub & GRD100 Restore Modal */}
      {showRecoveryModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1.5rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRecoveryModal(false);
          }}
        >
          <div 
            className="card"
            style={{
              width: '100%',
              maxWidth: '1200px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '16px',
              background: '#0d1117',
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.75rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(13, 17, 23, 0.8) 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                }}>
                  <RotateCcw size={22} color="#fbbf24" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Hub de Récupération Telegram &amp; Restauration GRD100
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '20px', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
                      Bot Connecté
                    </span>
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                    Détection automatique des utilisateurs via les conversations du bot, captures Telegram et restauration en 1 clic.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={fetchRecoveryScan}
                  disabled={loadingRecovery}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
                >
                  <RefreshCw size={14} className={loadingRecovery ? 'animate-spin' : ''} />
                  <span>Re-scanner</span>
                </button>
                <button
                  onClick={() => setShowRecoveryModal(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    borderRadius: '8px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#94a3b8',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Notice Banner */}
              {restorationNotice && (
                <div style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '10px',
                  background: restorationNotice.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${restorationNotice.type === 'success' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  color: restorationNotice.type === 'success' ? '#4ade80' : '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {restorationNotice.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span style={{ fontWeight: 500 }}>{restorationNotice.text}</span>
                  </div>
                  <button onClick={() => setRestorationNotice(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Stats & Overview Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Users size={14} color="#60a5fa" />
                    <span>Total Joueurs Détectés</span>
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.3rem' }}>
                    {recoveryData?.stats.totalFound ?? (loadingRecovery ? '...' : 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Issus des conversations bot &amp; logs
                  </div>
                </div>

                <div style={{ padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Zap size={14} color="#fbbf24" />
                    <span>Prêts à Restaurer (GRD100)</span>
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.3rem' }}>
                    {recoveryData?.stats.readyToRestore ?? (loadingRecovery ? '...' : 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '0.2rem' }}>
                    Non encore assignés à GRD100
                  </div>
                </div>

                <div style={{ padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldCheck size={14} color="#4ade80" />
                    <span>Déjà Restaurés (GRD100)</span>
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4ade80', marginTop: '0.3rem' }}>
                    {recoveryData?.stats.alreadyRestoredGrd100 ?? (loadingRecovery ? '...' : 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.2rem' }}>
                    Présents dans les demandes actives
                  </div>
                </div>

                <div style={{ padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(147, 51, 234, 0.05)', border: '1px solid rgba(147, 51, 234, 0.2)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ImageIcon size={14} color="#c084fc" />
                    <span>Captures Récupérées</span>
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c084fc', marginTop: '0.3rem' }}>
                    {recoveryData?.stats.diskScreenshotsCount ?? 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9333ea', marginTop: '0.2rem' }}>
                    Preuves images sur le serveur
                  </div>
                </div>
              </div>

              {/* 1-Click Action Bar */}
              <div style={{
                padding: '1.25rem 1.5rem',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fef3c7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={18} color="#fbbf24" />
                    Restauration Automatique des 10 Joueurs GRD100
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#fde68a' }}>
                    Restaure en un clic les 10 joueurs trouvés avec le code promo <b>GRD100</b>, leurs identifiants bookmaker et statut <b>APPROUVÉ</b>.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#fde68a' }}>Bookmaker :</label>
                    <input
                      type="text"
                      value={recoveryBookmaker}
                      onChange={(e) => setRecoveryBookmaker(e.target.value)}
                      className="input"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', width: '110px', background: 'rgba(0, 0, 0, 0.4)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#fde68a' }}>Statut :</label>
                    <select
                      value={recoveryStatus}
                      onChange={(e: any) => setRecoveryStatus(e.target.value)}
                      className="input"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', background: 'rgba(0, 0, 0, 0.4)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                    >
                      <option value="APPROVED">APPROUVÉ ✅</option>
                      <option value="PENDING">EN ATTENTE ⏳</option>
                    </select>
                  </div>

                  <button
                    onClick={handleRestoreTopTen}
                    disabled={isRestoringGrd100 || loadingRecovery}
                    className="btn"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: '#000',
                      fontWeight: 700,
                      padding: '0.65rem 1.4rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      borderRadius: '8px',
                      cursor: isRestoringGrd100 ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
                    }}
                  >
                    {isRestoringGrd100 ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Restauration en cours...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck size={16} />
                        <span>Restaurer les 10 Joueurs (GRD100)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Live Telegram Lookup Tool */}
              <div style={{
                padding: '1rem 1.25rem',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Bot size={16} color="#60a5fa" />
                    Vérification Directe Telegram Bot API (Recherche d&apos;ID)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Interroge les serveurs Telegram en temps réel
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Entrez un Telegram Chat ID (ex: 8655088287, 8541029191)..."
                    value={manualChatIdInput}
                    onChange={(e) => setManualChatIdInput(e.target.value)}
                    className="input"
                    style={{ flex: 1, padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
                  />
                  <button
                    onClick={handleManualVerify}
                    disabled={manualVerifying || !manualChatIdInput.trim()}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    {manualVerifying ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    <span>Vérifier sur Telegram</span>
                  </button>
                </div>

                {manualVerifiedResult && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: manualVerifiedResult.found ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${manualVerifiedResult.found ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    {manualVerifiedResult.found ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ShieldCheck size={18} color="#4ade80" />
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                            {manualVerifiedResult.profile.first_name} {manualVerifiedResult.profile.last_name || ''}
                            {manualVerifiedResult.profile.username && (
                              <span style={{ color: '#60a5fa', marginLeft: '0.4rem' }}>@{manualVerifiedResult.profile.username}</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Chat ID : <code>{manualVerifiedResult.chatId}</code> • Type : {manualVerifiedResult.profile.type}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#f87171', fontSize: '0.85rem' }}>
                        ❌ Utilisateur non trouvé sur Telegram ou bot non démarré avec cet ID ({manualVerifiedResult.error || 'Chat introuvable'}).
                      </div>
                    )}

                    {manualVerifiedResult.found && (
                      <button
                        onClick={() => handleRestoreSinglePlayer({
                          telegramChatId: manualVerifiedResult.chatId,
                          telegramName: `${manualVerifiedResult.profile.first_name || ''} ${manualVerifiedResult.profile.last_name || ''}`.trim(),
                          telegramUsername: manualVerifiedResult.profile.username || null,
                          playerBookmakerId: `ID: ${1781100000 + Math.floor(Math.random() * 90000)}`,
                          screenshotUrl: null,
                          hasActiveClaimForGrd100: false,
                          existingClaimsCount: 0,
                          existingClaims: [],
                          telegramProfile: { isFoundOnTelegram: true },
                          source: 'manual',
                        })}
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        Restaurer avec GRD100
                      </button>
                    )}
                  </div>
                )}

                {/* Bulk Paste Box */}
                <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Plus size={12} color="#fbbf24" />
                    <span>Coller plusieurs Chat IDs Telegram en masse (séparés par des virgules ou retours à la ligne) :</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <input
                      type="text"
                      placeholder="ex: 1490527403, 8510886882, 8655112548, 8541029191, 8655088287..."
                      value={bulkPasteIds}
                      onChange={(e) => setBulkPasteIds(e.target.value)}
                      className="input"
                      style={{ flex: 1, padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                    />
                    <button
                      onClick={async () => {
                        if (!bulkPasteIds.trim()) return;
                        const ids = bulkPasteIds.split(/[\s,;\n]+/).filter(Boolean);
                        if (ids.length === 0) return;
                        try {
                          await api.restoreCustomPlayers({
                            promoCode: 'GRD100',
                            bookmaker: recoveryBookmaker,
                            status: recoveryStatus,
                            players: ids.map((id, idx) => ({
                              telegramChatId: id.trim(),
                              playerBookmakerId: `ID: ${1781100000 + idx * 1234}`,
                            })),
                          });
                          setRestorationNotice({
                            type: 'success',
                            text: `🎉 ${ids.length} joueurs ont été ajoutés et restaurés pour le code promo GRD100 (${recoveryBookmaker}) !`,
                          });
                          setBulkPasteIds('');
                          await fetchRecoveryScan();
                          fetchStats();
                        } catch (err: any) {
                          alert(`Erreur: ${err.message}`);
                        }
                      }}
                      disabled={!bulkPasteIds.trim()}
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    >
                      Ajouter &amp; Restaurer
                    </button>
                  </div>
                </div>
              </div>

              {/* Table Search & List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                    Liste des Joueurs Détectés ({recoveryData?.candidates.length ?? 0})
                  </h3>
                  <div style={{ position: 'relative', width: '280px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                      type="text"
                      placeholder="Filtrer par nom, username, ID..."
                      value={recoverySearch}
                      onChange={(e) => setRecoverySearch(e.target.value)}
                      className="input"
                      style={{ paddingLeft: '2rem', paddingRight: '0.8rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.85rem', width: '100%' }}
                    />
                  </div>
                </div>

                {/* Candidates Table */}
                <div style={{
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: 'rgba(255, 255, 255, 0.01)',
                }}>
                  {loadingRecovery ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem auto', color: '#fbbf24' }} />
                      <div>Scan approfondi des conversations Telegram et fichiers en cours...</div>
                    </div>
                  ) : !recoveryData || recoveryData.candidates.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                      Aucun utilisateur détecté pour le moment.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', textAlign: 'left' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>#</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Profil Telegram</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Telegram Chat ID</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Bookmaker ID</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Capture d&apos;écran</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Statut GRD100</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recoveryData.candidates
                          .filter((c) => {
                            if (!recoverySearch) return true;
                            const q = recoverySearch.toLowerCase();
                            return (
                              c.telegramChatId.toLowerCase().includes(q) ||
                              c.telegramName.toLowerCase().includes(q) ||
                              (c.telegramUsername && c.telegramUsername.toLowerCase().includes(q)) ||
                              (c.playerBookmakerId && c.playerBookmakerId.toLowerCase().includes(q))
                            );
                          })
                          .map((cand, idx) => {
                            const isCopied = copiedChatId === cand.telegramChatId;
                            const isPinging = pingingChatId === cand.telegramChatId;
                            return (
                              <tr
                                key={cand.telegramChatId}
                                style={{
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                  background: cand.hasActiveClaimForGrd100 ? 'rgba(34, 197, 94, 0.03)' : idx < 10 ? 'rgba(245, 158, 11, 0.03)' : 'transparent',
                                }}
                              >
                                <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: 600 }}>
                                  {idx + 1}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      background: cand.telegramProfile.isFoundOnTelegram ? 'rgba(34, 197, 94, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                                      color: cand.telegramProfile.isFoundOnTelegram ? '#4ade80' : '#818cf8',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 700,
                                      fontSize: '0.8rem',
                                    }}>
                                      {cand.telegramName ? cand.telegramName.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        {cand.telegramName}
                                        {cand.telegramProfile.isFoundOnTelegram && (
                                          <span title="Profil vérifié sur Telegram" style={{ color: '#4ade80', fontSize: '0.75rem' }}>✓</span>
                                        )}
                                      </div>
                                      {cand.telegramUsername ? (
                                        <a
                                          href={`https://t.me/${cand.telegramUsername}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{ fontSize: '0.75rem', color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                        >
                                          @{cand.telegramUsername}
                                          <ExternalLink size={10} />
                                        </a>
                                      ) : (
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Pas de @username</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <code style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.4rem', borderRadius: '4px', color: '#cbd5e1' }}>
                                      {cand.telegramChatId}
                                    </code>
                                    <button
                                      onClick={() => copyToClipboard(cand.telegramChatId)}
                                      title="Copier le Chat ID"
                                      style={{ background: 'none', border: 'none', color: isCopied ? '#4ade80' : '#64748b', cursor: 'pointer', padding: '2px' }}
                                    >
                                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <span style={{ color: cand.playerBookmakerId ? '#f8fafc' : '#64748b' }}>
                                    {cand.playerBookmakerId || 'Auto-généré à la restauration'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  {cand.screenshotUrl ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <img
                                        src={cand.screenshotUrl}
                                        alt="Preuve"
                                        style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover', border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer' }}
                                        onClick={() => setPreviewImageUrl(cand.screenshotUrl)}
                                      />
                                      <button
                                        onClick={() => setPreviewImageUrl(cand.screenshotUrl)}
                                        style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                                      >
                                        Voir
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Aucune</span>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  {cand.hasActiveClaimForGrd100 ? (
                                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '20px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', fontSize: '0.75rem', border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: 600 }}>
                                      Restauré GRD100 ✅
                                    </span>
                                  ) : idx < 10 ? (
                                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '20px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontSize: '0.75rem', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600 }}>
                                      Prêt pour GRD100 ⚡
                                    </span>
                                  ) : (
                                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8', fontSize: '0.75rem' }}>
                                      Détecté
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    <button
                                      onClick={() => handlePingUser(cand.telegramChatId)}
                                      disabled={isPinging}
                                      title="Envoyer un message de test via le Bot"
                                      className="btn btn-secondary"
                                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                    >
                                      {isPinging ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                      <span>Tester Ping</span>
                                    </button>

                                    <button
                                      onClick={() => handleRestoreSinglePlayer(cand)}
                                      className="btn btn-primary"
                                      style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }}
                                    >
                                      {cand.hasActiveClaimForGrd100 ? 'Re-valider' : 'Restaurer'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.25rem 1.75rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
            }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                💡 Astuce : Après la restauration, les joueurs apparaîtront immédiatement dans l&apos;onglet <b>Joueurs &amp; Vérifications</b>.
              </div>
              <button
                onClick={() => setShowRecoveryModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.6rem 1.5rem' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Statistics Modal */}
      {showStatsModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowStatsModal(false);
          }}
        >
          <div 
            style={{
              background: 'var(--card-bg, #161722)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
              borderRadius: 'var(--radius-lg, 16px)',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              background: 'var(--card-bg, #161722)',
              zIndex: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--accent-secondary, #06b6d4), var(--accent-primary, #6366f1))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}>
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Statistiques de la Base de Données
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#22c55e',
                      background: 'rgba(34, 197, 94, 0.12)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                      PostgreSQL Connecté
                    </span>
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                    Base: <code>{stats?.database || 'boot_dashboard'}</code> • Synchronisation en temps réel
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={fetchStats}
                  disabled={loadingStats}
                  className="btn-icon"
                  title="Rafraîchir les statistiques"
                  style={{ padding: '0.5rem', background: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <RefreshCw size={16} className={loadingStats ? 'animate-spin' : ''} color="var(--accent-secondary)" />
                </button>
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="btn-icon"
                  style={{ padding: '0.5rem', background: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {loadingStats && !stats ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--accent-primary)' }} />
                  <p>Chargement des statistiques de la base de données...</p>
                </div>
              ) : stats ? (
                <>
                  {/* Top KPI Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div className="card" style={{ padding: '1.2rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <Users size={15} color="var(--accent-secondary)" />
                        <span>Identifiants (User IDs)</span>
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {stats.overview.totalKnownUserIds}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {stats.overview.uniquePlayersWithClaims} joueurs avec réclamations
                      </div>
                    </div>

                    <div className="card" style={{ padding: '1.2rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <Tag size={15} color="#8b5cf6" />
                        <span>Codes Promo</span>
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#8b5cf6' }}>
                        {stats.overview.activePromoCodes} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {stats.overview.totalPromoCodes}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Codes actifs en distribution
                      </div>
                    </div>

                    <div className="card" style={{ padding: '1.2rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <Rocket size={15} color="#f59e0b" />
                        <span>Objectif Campagnes</span>
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>
                        {stats.overview.fulfillmentRate}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {stats.overview.totalClaimedAccounts} / {stats.overview.totalTargetAccounts} comptes atteints
                      </div>
                    </div>

                    <div className="card" style={{ padding: '1.2rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <CheckCircle size={15} color="#22c55e" />
                        <span>Taux d'Approbation</span>
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#22c55e' }}>
                        {stats.overview.approvalRate}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {stats.overview.approvedClaims} validés sur {stats.overview.totalClaims}
                      </div>
                    </div>
                  </div>

                  {/* Section: Détail des User IDs & Codes Promo Consommés */}
                  <div className="card" style={{ padding: '1.25rem' }}>
                    {/* Action Notice Alert */}
                    {actionNotice && (
                      <div style={{
                        padding: '0.75rem 1rem',
                        marginBottom: '1rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        background: actionNotice.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: actionNotice.type === 'success' ? '#22c55e' : '#ef4444',
                        border: `1px solid ${actionNotice.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      }}>
                        {actionNotice.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        <span>{actionNotice.text}</span>
                        <button
                          onClick={() => setActionNotice(null)}
                          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {/* Table Header Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Users size={16} color="var(--accent-secondary)" />
                          Détail des Utilisateurs ({stats.overview.totalKnownUserIds} User IDs) &amp; Consommations
                        </h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>
                          Ajoutez ou supprimez des consommations pour gérer les accès aux codes promo
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* Toggle Add Modal Button */}
                        <button
                          onClick={() => setShowAddModal(!showAddModal)}
                          className="btn btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                        >
                          <Plus size={15} />
                          <span>{showAddModal ? 'Fermer Ajout' : 'Injecter Consommations'}</span>
                        </button>

                        {/* Search Bar */}
                        <div style={{ position: 'relative', minWidth: '220px' }}>
                          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                          <input
                            type="text"
                            placeholder="Filtrer User ID, nom, code..."
                            value={playerSearch}
                            onChange={(e) => setPlayerSearch(e.target.value)}
                            className="form-input"
                            style={{
                              padding: '0.4rem 0.75rem 0.4rem 2.2rem',
                              fontSize: '0.85rem',
                              width: '100%',
                              background: 'rgba(255, 255, 255, 0.04)',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Injection Drawer / Form */}
                    {showAddModal && (
                      <form 
                        onSubmit={handleBulkAdd}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: '10px',
                          padding: '1.25rem',
                          marginBottom: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Plus size={16} />
                            Ajouter / Injecter des Consommations de Code Promo
                          </h5>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Permet de marquer des User IDs comme ayant déjà consommé un code
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                              Code Promo à Consommer *
                            </label>
                            <select
                              value={selectedPromoId}
                              onChange={(e) => setSelectedPromoId(e.target.value)}
                              className="form-input"
                              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
                              required
                            >
                              {promoCodesList.map((p) => (
                                <option key={p.id} value={p.id} style={{ background: '#161722', color: '#fff' }}>
                                  {p.code} ({p.bookmaker}) {p.isActive ? '— Actif 🟢' : '— Inactif 🔴'}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                              Statut de la Réclamation
                            </label>
                            <select
                              value={consumptionStatus}
                              onChange={(e) => setConsumptionStatus(e.target.value as any)}
                              className="form-input"
                              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
                            >
                              <option value="APPROVED" style={{ background: '#161722', color: '#fff' }}>Approuvé / Validé ✅ (Par défaut)</option>
                              <option value="PENDING" style={{ background: '#161722', color: '#fff' }}>En Attente ⏳</option>
                              <option value="REJECTED" style={{ background: '#161722', color: '#fff' }}>Rejeté ❌</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                            Identifiants Telegram (User IDs) ou Nombre de Joueurs *
                          </label>
                          <textarea
                            value={userInputs}
                            onChange={(e) => setUserInputs(e.target.value)}
                            placeholder="Exemples :&#10;• Tapez un nombre : 10 (génère 10 joueurs ayant consommé ce code)&#10;• Ou collez des User IDs : 1490527403, 8541029191, 8655088287"
                            rows={3}
                            className="form-input"
                            style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', resize: 'vertical' }}
                            required
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => setShowAddModal(false)}
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            disabled={isAdding}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1.25rem', fontSize: '0.85rem' }}
                          >
                            {isAdding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            <span>{isAdding ? 'Injection en cours...' : 'Injecter Consommation(s)'}</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Table */}
                    <div style={{ overflowX: 'auto', maxHeight: '450px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))', color: 'var(--text-secondary)', textAlign: 'left' }}>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>User ID (Telegram)</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Nom / Username</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, textAlign: 'center' }}>Total</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Codes Promo Consommés &amp; Actions</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPlayers.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Aucun utilisateur correspondant à la recherche.
                              </td>
                            </tr>
                          ) : (
                            filteredPlayers.map((player) => (
                              <tr 
                                key={player.telegramChatId} 
                                style={{ 
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                  transition: 'background 0.2s',
                                }}
                              >
                                <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                                  <code>{player.telegramChatId}</code>
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {player.telegramName || 'Inconnu'}
                                  </div>
                                  {player.telegramUsername && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                      @{player.telegramUsername}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <span 
                                    className="badge" 
                                    style={{
                                      background: player.consumedCount > 0 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                      color: player.consumedCount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                                      fontWeight: 700,
                                      padding: '0.2rem 0.6rem',
                                    }}
                                  >
                                    {player.consumedCount} code{player.consumedCount > 1 ? 's' : ''}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {player.promoCodes.length === 0 ? (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      En session (aucun code consommé)
                                    </span>
                                  ) : (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                      {player.promoCodes.map((c, idx) => {
                                        const statusBadge = c.status === 'APPROVED' 
                                          ? { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', label: 'Validé ✅' }
                                          : c.status === 'REJECTED'
                                          ? { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Rejeté ❌' }
                                          : { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: 'En attente ⏳' };

                                        // Find promo code ID if available
                                        const matchedPromo = promoCodesList.find(p => p.code.toUpperCase() === c.code.toUpperCase());
                                        const promoId = matchedPromo?.id;

                                        return (
                                          <div
                                            key={`${c.code}-${idx}`}
                                            style={{
                                              background: 'rgba(255, 255, 255, 0.04)',
                                              border: '1px solid rgba(255, 255, 255, 0.08)',
                                              borderRadius: '6px',
                                              padding: '0.25rem 0.5rem',
                                              fontSize: '0.75rem',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.35rem',
                                            }}
                                          >
                                            <strong style={{ color: 'var(--text-primary)' }}>{c.code}</strong>
                                            <span style={{ color: 'var(--text-muted)' }}>({c.bookmaker})</span>
                                            {c.playerBookmakerId && (
                                              <span style={{ color: 'var(--accent-secondary)', fontSize: '0.7rem' }}>
                                                [{c.playerBookmakerId}]
                                              </span>
                                            )}
                                            <span style={{
                                              fontSize: '0.65rem',
                                              fontWeight: 600,
                                              padding: '0.1rem 0.35rem',
                                              borderRadius: '4px',
                                              backgroundColor: statusBadge.bg,
                                              color: statusBadge.color,
                                            }}>
                                              {statusBadge.label}
                                            </span>

                                            {/* Delete specific promo consumption button */}
                                            {promoId && (
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteUserPromo(player.telegramChatId, promoId, c.code)}
                                                title={`Supprimer la consommation de ${c.code} pour cet utilisateur`}
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  padding: '0 0.15rem',
                                                  cursor: 'pointer',
                                                  color: '#ef4444',
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  opacity: 0.7,
                                                  transition: 'opacity 0.2s',
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                                              >
                                                <X size={13} />
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                  {player.consumedCount > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUserPromo(player.telegramChatId)}
                                      title="Supprimer toutes les consommations de cet utilisateur"
                                      className="btn btn-danger"
                                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                    >
                                      <Trash2 size={13} />
                                      <span>Réinitialiser</span>
                                    </button>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
                  Impossible de charger les statistiques. Vérifiez que le backend est en ligne.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
            }}>
              <button
                onClick={handleBackup}
                disabled={isBackingUp}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
              >
                <Database size={15} />
                <span>Exporter Sauvegarde Complète</span>
              </button>

              <button
                onClick={() => setShowStatsModal(false)}
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.5rem' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promo Codes Details Modal */}
      {showPromoDetailsModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPromoDetailsModal(false);
          }}
        >
          <div 
            style={{
              background: 'var(--card-bg, #161722)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
              borderRadius: 'var(--radius-lg, 16px)',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Tag size={20} color="var(--accent-primary, #6366f1)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                    Détails des Codes Promo ({promoDetailsList.length} en Base)
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                    Consultez l'historique complet, les campagnes actives et la liste des joueurs par code promo
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={fetchPromoDetails}
                  disabled={loadingPromoDetails}
                  className="btn-icon"
                  style={{ width: '32px', height: '32px' }}
                  title="Rafraîchir"
                >
                  <RefreshCw size={14} className={loadingPromoDetails ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => setShowPromoDetailsModal(false)}
                  className="btn-icon"
                  style={{ width: '32px', height: '32px' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Search and Filters */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ position: 'relative', flex: '1 1 240px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Filtrer par code, bookmaker ou joueur..."
                    value={promoSearch}
                    onChange={(e) => setPromoSearch(e.target.value)}
                    className="form-input"
                    style={{
                      padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                      fontSize: '0.85rem',
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.04)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setPromoStatusFilter(filter)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid',
                        cursor: 'pointer',
                        borderColor: promoStatusFilter === filter ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
                        background: promoStatusFilter === filter ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        color: promoStatusFilter === filter ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {filter === 'ALL' ? 'Tous' : filter === 'ACTIVE' ? 'Actifs 🟢' : 'Inactifs 🔴'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Promo Cards List */}
              {loadingPromoDetails ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
                  <span>Chargement des détails des codes promo...</span>
                </div>
              ) : filteredDetailedPromos.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Tag size={32} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
                  <p>Aucun code promo correspondant trouvé.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '520px', overflowY: 'auto' }}>
                  {filteredDetailedPromos.map((promo) => {
                    const isExpanded = expandedPromoId === promo.id;
                    const approvedCount = promo.claims.filter(c => c.status === 'APPROVED').length;
                    const pendingCount = promo.claims.filter(c => c.status === 'PENDING').length;
                    const rejectedCount = promo.claims.filter(c => c.status === 'REJECTED').length;
                    const totalTarget = promo.orders.reduce((acc, o) => acc + o.targetAccounts, 0);
                    const totalClaimed = promo.orders.reduce((acc, o) => acc + o.claimedCount, 0);

                    return (
                      <div
                        key={promo.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.025)',
                          border: `1px solid ${promo.isActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.07)'}`,
                          borderRadius: '12px',
                          padding: '1.25rem',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {/* Header Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              fontSize: '1.1rem',
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              padding: '0.3rem 0.75rem',
                              borderRadius: '8px',
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: 'var(--accent-primary)',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                            }}>
                              {promo.code}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{promo.bookmaker}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                ID: <code>{promo.id.slice(0, 8)}...</code> {promo.createdAt ? `• Ajouté le ${new Date(promo.createdAt).toLocaleDateString('fr-FR')}` : ''}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => handleTogglePromoActive(promo.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.3rem 0.65rem',
                                borderRadius: '999px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: 'none',
                                background: promo.isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: promo.isActive ? '#22c55e' : '#ef4444',
                              }}
                            >
                              {promo.isActive ? 'Actif 🟢 (Cliquer pour désactiver)' : 'Inactif 🔴 (Cliquer pour activer)'}
                            </button>

                            <button
                              type="button"
                              onClick={() => setExpandedPromoId(isExpanded ? null : promo.id)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <span>{promo.claims.length} Joueur(s)</span>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {/* Quick Stats Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: '0.75rem',
                          marginTop: '1rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        }}>
                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Campagnes (Ordres)</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {promo.orders.length} ordre{promo.orders.length > 1 ? 's' : ''}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Comptes Atteints</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b' }}>
                              {totalClaimed} / {totalTarget}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(34, 197, 94, 0.08)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#22c55e' }}>Validés / Approuvés</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#22c55e' }}>
                              {approvedCount}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#f59e0b' }}>En Attente</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b' }}>
                              {pendingCount}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>Rejetés</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444' }}>
                              {rejectedCount}
                            </div>
                          </div>
                        </div>

                        {/* Example Screenshot / Image Info */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: '8px',
                          padding: '0.6rem 0.85rem',
                          marginTop: '0.75rem',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          border: '1px solid rgba(255, 255, 255, 0.04)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <ImageIcon size={16} color="var(--accent-secondary)" />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Image d'Exemple (Bot Telegram) :</span>
                            {promo.exampleImageUrl ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                                  const fullUrl = promo.exampleImageUrl!.startsWith('http') ? promo.exampleImageUrl! : `${baseUrl}${promo.exampleImageUrl}`;
                                  setPreviewImageUrl(fullUrl);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'rgba(6, 182, 212, 0.15)',
                                  color: 'var(--accent-secondary)',
                                  border: '1px solid rgba(6, 182, 212, 0.3)',
                                  cursor: 'pointer',
                                }}
                              >
                                <Eye size={13} />
                                <span>📸 Voir l'image ({promo.exampleImageUrl.split('/').pop()})</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                ⚠️ Aucune photo enregistrée
                              </span>
                            )}
                          </div>

                          {/* Upload / Replace Button */}
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-secondary)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: uploadingPromoImageId === promo.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              disabled={uploadingPromoImageId === promo.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadPromoImage(promo.id, file);
                              }}
                            />
                            {uploadingPromoImageId === promo.id ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Téléversement...</span>
                              </>
                            ) : (
                              <>
                                <Plus size={13} />
                                <span>{promo.exampleImageUrl ? 'Changer Photo' : 'Ajouter Photo'}</span>
                              </>
                            )}
                          </label>
                        </div>

                        {/* Expandable Player Claims List */}
                        {isExpanded && (
                          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.07)' }}>
                            <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-secondary)' }}>
                              Joueurs ayant consommé le code "{promo.code}" ({promo.claims.length}) :
                            </h5>

                            {promo.claims.length === 0 ? (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                                Aucun joueur n'a encore réclamé ce code.
                              </div>
                            ) : (
                              <div style={{ overflowX: 'auto', maxHeight: '200px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                      <th style={{ padding: '0.4rem 0.5rem' }}>User ID Telegram</th>
                                      <th style={{ padding: '0.4rem 0.5rem' }}>Nom / Username</th>
                                      <th style={{ padding: '0.4rem 0.5rem' }}>ID Bookmaker</th>
                                      <th style={{ padding: '0.4rem 0.5rem' }}>Date</th>
                                      <th style={{ padding: '0.4rem 0.5rem' }}>Statut</th>
                                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {promo.claims.map((claim) => (
                                      <tr key={claim.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                                        <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                                          <code>{claim.telegramChatId}</code>
                                        </td>
                                        <td style={{ padding: '0.4rem 0.5rem' }}>
                                          {claim.telegramName || 'Inconnu'} {claim.telegramUsername ? `(@${claim.telegramUsername})` : ''}
                                        </td>
                                        <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace' }}>
                                          {claim.playerBookmakerId || '—'}
                                        </td>
                                        <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>
                                          {new Date(claim.createdAt).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td style={{ padding: '0.4rem 0.5rem' }}>
                                          <span style={{
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: claim.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.15)' : claim.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                            color: claim.status === 'APPROVED' ? '#22c55e' : claim.status === 'REJECTED' ? '#ef4444' : '#f59e0b',
                                          }}>
                                            {claim.status === 'APPROVED' ? 'Validé ✅' : claim.status === 'REJECTED' ? 'Rejeté ❌' : 'En attente ⏳'}
                                          </span>
                                        </td>
                                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              await handleDeleteUserPromo(claim.telegramChatId, promo.id, promo.code);
                                              await fetchPromoDetails();
                                            }}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              color: '#ef4444',
                                              cursor: 'pointer',
                                              padding: '0.2rem',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                            }}
                                            title="Supprimer cette consommation"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'rgba(255, 255, 255, 0.02)',
            }}>
              <button
                onClick={() => setShowPromoDetailsModal(false)}
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.5rem' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Example Image Lightbox Modal */}
      {previewImageUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '2rem',
          }}
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImageUrl(null)}
              style={{
                position: 'absolute',
                top: '-2.5rem',
                right: '0',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#fff',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
            <img
              src={previewImageUrl}
              alt="Exemple de Code Promo"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
