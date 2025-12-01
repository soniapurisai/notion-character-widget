import React, { useEffect, useState, useCallback } from "react";
import { fetchState, buyAccessory, equipAccessory, unequipAccessory } from "./api";

const USER_ID = "default";

// Enhanced accessories catalog with more options
const DEFAULT_ACCESSORIES_CATALOG = [
  // Head
  { id: "hat_basic", name: "Basic Hat", type: "head", cost: 100, icon: "🎩" },
  { id: "hat_wizard", name: "Wizard Hat", type: "head", cost: 300, icon: "🧙" },
  { id: "hat_crown", name: "Royal Crown", type: "head", cost: 500, icon: "👑" },
  { id: "hat_cowboy", name: "Cowboy Hat", type: "head", cost: 200, icon: "🤠" },
  
  // Face
  { id: "glasses_nerd", name: "Nerd Glasses", type: "face", cost: 150, icon: "🤓" },
  { id: "glasses_sun", name: "Sunglasses", type: "face", cost: 200, icon: "😎" },
  { id: "mask_ninja", name: "Ninja Mask", type: "face", cost: 250, icon: "🥷" },
  
  // Body
  { id: "cape_red", name: "Red Cape", type: "body", cost: 250, icon: "🦸" },
  { id: "cape_royal", name: "Royal Cape", type: "body", cost: 400, icon: "👑" },
  { id: "armor_basic", name: "Basic Armor", type: "body", cost: 350, icon: "🛡️" },
  
  // Companions
  { id: "pet_cat", name: "Pet Cat", type: "companion", cost: 300, icon: "🐱" },
  { id: "pet_dragon", name: "Pet Dragon", type: "companion", cost: 800, icon: "🐉" },
  { id: "pet_dog", name: "Pet Dog", type: "companion", cost: 250, icon: "🐕" },
  
  // Weapons
  { id: "weapon_sword", name: "Sword", type: "weapon", cost: 400, icon: "⚔️" },
  { id: "weapon_shield", name: "Shield", type: "weapon", cost: 350, icon: "🛡️" },
  { id: "weapon_wand", name: "Magic Wand", type: "weapon", cost: 600, icon: "🪄" },
  
  // Auras (visual effects)
  { id: "aura_basic", name: "Basic Aura", type: "aura", cost: 200, icon: "✨" },
  { id: "aura_advanced", name: "Advanced Aura", type: "aura", cost: 500, icon: "🌟" },
  { id: "aura_fire", name: "Fire Aura", type: "aura", cost: 700, icon: "🔥" },
  
  // Special (unlocked at high points)
  { id: "special_wings", name: "Angel Wings", type: "special", cost: 1000, icon: "👼", unlockAt: 5000 },
  { id: "special_halo", name: "Divine Halo", type: "special", cost: 1500, icon: "😇", unlockAt: 7500 },
  { id: "special_rainbow", name: "Rainbow Trail", type: "special", cost: 2000, icon: "🌈", unlockAt: 10000 }
];

function App() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [shopOpen, setShopOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeSinceSync, setTimeSinceSync] = useState(0);

  const loadState = useCallback(async () => {
    setSyncing(true);
    setError("");
    try {
      const data = await fetchState(USER_ID);
      
      const fullState = {
        ...data,
        points: data.points || 0,
        ownedAccessories: data.ownedAccessories || [],
        equippedAccessories: data.equippedAccessories || [],
        countedTasks: data.countedTasks || [],
        accessoriesCatalog: data.accessoriesCatalog || DEFAULT_ACCESSORIES_CATALOG,
        stats: data.stats || { 
          totalCompletedTasks: 0, 
          pointsGainedThisSync: 0,
          streak: 0,
          level: 1
        }
      };
      
      setState(fullState);
      setTimeSinceSync(0);
    } catch (e) {
      console.error("Failed to load state:", e);
      setError(e.message || "Failed to load character data");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      setTimeSinceSync(prev => {
        if (prev >= 60) {
          loadState();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, loadState]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleBuy = async (accessoryId) => {
    setError("");
    try {
      const data = await buyAccessory(USER_ID, accessoryId);
      setState((prev) => ({
        ...prev,
        points: data.points,
        ownedAccessories: data.ownedAccessories
      }));
    } catch (e) {
      setError(e.message || "Failed to buy accessory");
    }
  };

  const handleEquip = async (accessoryId) => {
    setError("");
    try {
      const data = await equipAccessory(USER_ID, accessoryId);
      setState((prev) => ({
        ...prev,
        equippedAccessories: data.equippedAccessories
      }));
    } catch (e) {
      setError(e.message || "Failed to equip accessory");
    }
  };

  const handleUnequip = async (accessoryId) => {
    setError("");
    try {
      const data = await unequipAccessory(USER_ID, accessoryId);
      setState((prev) => ({
        ...prev,
        equippedAccessories: data.equippedAccessories
      }));
    } catch (e) {
      setError(e.message || "Failed to unequip accessory");
    }
  };

  const toggleShop = () => {
    setShopOpen((prev) => !prev);
    setActiveTab("all");
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
    if (!autoRefresh) {
      setTimeSinceSync(0);
    }
  };

  const getCharacterLevel = () => {
    if (!state) return "basic";
    const points = state.points;
    
    if (points >= 10000) return "expert";
    if (points >= 5000) return "advanced";
    if (points >= 2000) return "intermediate";
    return "basic";
  };

  const getFilteredAccessories = () => {
    if (!state) return [];
    
    const currentLevel = getCharacterLevel();
    return state.accessoriesCatalog.filter(acc => {
      // Filter by tab
      if (activeTab !== "all" && acc.type !== activeTab) return false;
      
      // Filter by unlock requirements
      if (acc.unlockAt && state.points < acc.unlockAt) return false;
      
      return true;
    });
  };

  if (loading) {
    return (
      <div className="widget-root">
        <div className="widget-card widget-loading">
          <div className="loading-spinner"></div>
          <div>Loading your focus buddy...</div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="widget-root">
        <div className="widget-card" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="widget-error" style={{ justifyContent: 'center' }}>
            ⚠ Failed to load character data
          </div>
          <button 
            className="widget-sync-btn" 
            onClick={loadState}
            style={{ marginTop: '16px' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { points, ownedAccessories, equippedAccessories, stats } = state;
  const characterLevel = getCharacterLevel();
  const equippedSet = new Set(equippedAccessories);
  const ownedSet = new Set(ownedAccessories);
  
  const tabs = [
    { id: "all", label: "All Items" },
    { id: "head", label: "Head" },
    { id: "face", label: "Face" },
    { id: "body", label: "Body" },
    { id: "weapon", label: "Weapons" },
    { id: "companion", label: "Pets" },
    { id: "special", label: "Special" }
  ];

  return (
    <div className="widget-root">
      <div className="widget-card">
        {/* Header */}
        <div className="widget-header">
          <div className="widget-brand">
            <div className="widget-logo">FB</div>
            <div>
              <div className="widget-title">Focus Buddy</div>
              <div className="widget-subtitle">Your productivity companion</div>
            </div>
          </div>
          
          <div className="widget-header-controls">
            <button
              className="widget-sync-btn"
              onClick={loadState}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" 
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M23 4v6h-6M1 20v-6h6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" 
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sync Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="widget-stats">
          <div className="stat-item">
            <div className="stat-label">Total Points</div>
            <div className="stat-value">
              {points.toLocaleString()}
              <span className="stat-icon">⭐</span>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Completed Tasks</div>
            <div className="stat-value stat-secondary">
              {stats.totalCompletedTasks}
              <span className="stat-icon">✅</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="widget-main">
          <div className="character-section">
            <div className="character-wrapper" onClick={toggleShop}>
              <CharacterDisplay 
                equippedAccessories={equippedAccessories} 
                characterLevel={characterLevel}
                points={points}
              />
            </div>
          </div>

          <div className="info-panel">
            <div className="task-stats">
              <div className="task-count">
                <span>Task Completion</span>
                <strong>{stats.totalCompletedTasks} tasks</strong>
              </div>
              <div className="progress-container">
                <div className="progress-label">
                  <span>Progress</span>
                  <span>{Math.min(100, Math.floor((stats.totalCompletedTasks / 100) * 100))}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${Math.min(100, Math.floor((stats.totalCompletedTasks / 100) * 100))}%` }}
                  ></div>
                </div>
              </div>
              
              {stats.pointsGainedThisSync > 0 && (
                <div className="recent-points">
                  <span>+{stats.pointsGainedThisSync} points earned!</span>
                </div>
              )}
            </div>

            <div className="equipped-items">
              <div className="equipped-title">
                <span>Currently Equipped</span>
                <span className="text-tertiary">{equippedAccessories.length}/6</span>
              </div>
              <div className="equipped-grid">
                {equippedAccessories.length > 0 ? (
                  equippedAccessories.map(accId => {
                    const accessory = state.accessoriesCatalog.find(a => a.id === accId);
                    return accessory ? (
                      <div key={accId} className="equipped-item">
                        <span>{accessory.icon}</span>
                        <span>{accessory.name}</span>
                        <button 
                          className="equipped-item-remove"
                          onClick={() => handleUnequip(accId)}
                          title="Unequip"
                        >
                          ×
                        </button>
                      </div>
                    ) : null;
                  })
                ) : (
                  <div className="text-tertiary" style={{ fontSize: '12px' }}>
                    No items equipped. Click character to shop!
                  </div>
                )}
              </div>
            </div>

            {/* Achievement Badges */}
            {points >= 1000 && (
              <div className="achievement-badges">
                <div className="badge">⭐ 1K Points</div>
                {points >= 5000 && <div className="badge">🌟 5K Master</div>}
                {points >= 10000 && <div className="badge">👑 10K Legend</div>}
              </div>
            )}

            {/* Auto-refresh Indicator */}
            <div className="auto-refresh">
              <div 
                className="refresh-dot" 
                style={{ 
                  backgroundColor: autoRefresh ? '#10B981' : '#9CA3AF',
                  animation: autoRefresh ? 'pulse-dot 2s infinite' : 'none'
                }}
              ></div>
              <span>
                {autoRefresh ? `Auto-refresh in ${60 - timeSinceSync}s` : 'Auto-refresh off'}
              </span>
              <button 
                onClick={toggleAutoRefresh}
                style={{ 
                  marginLeft: 'auto', 
                  fontSize: '11px', 
                  background: 'none', 
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer'
                }}
              >
                {autoRefresh ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="widget-error">
            <span>⚠</span>
            <span>{error}</span>
            <button 
              onClick={() => setError("")}
              style={{ 
                marginLeft: 'auto', 
                background: 'none', 
                border: 'none',
                color: 'inherit',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Shop Overlay */}
        {shopOpen && (
          <Shop
            points={points}
            accessories={getFilteredAccessories()}
            ownedAccessories={ownedAccessories}
            equippedAccessories={equippedAccessories}
            onBuy={handleBuy}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
            onClose={() => setShopOpen(false)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={tabs}
          />
        )}
      </div>
    </div>
  );
}

// Enhanced Character Display
function CharacterDisplay({ equippedAccessories = [], characterLevel = "basic", points = 0 }) {
  const equippedSet = new Set(equippedAccessories);
  
  // Character evolution based on points
  const getCharacterSize = () => {
    if (points >= 10000) return "180px";
    if (points >= 5000) return "160px";
    if (points >= 2000) return "140px";
    return "120px";
  };

  return (
    <div className={`character-root points-${characterLevel}`} style={{ width: getCharacterSize(), height: getCharacterSize() }}>
      {/* Aura Effects */}
      {equippedSet.has("aura_basic") && <div className="acc-aura-basic"></div>}
      {equippedSet.has("aura_advanced") && <div className="acc-aura-advanced"></div>}
      {equippedSet.has("aura_fire") && (
        <div className="accessory-layer" style={{ inset: '-20px', fontSize: '40px', textAlign: 'center', color: '#F59E0B' }}>
          🔥
        </div>
      )}

      {/* Body */}
      <div className="character-body">
        <div className="character-face">
          <div className="face-eyes">
            <div className="eye"></div>
            <div className="eye"></div>
          </div>
          <div className="face-mouth"></div>
        </div>
        <div className="character-torso"></div>
        <div className="character-legs"></div>
      </div>

      {/* Accessories */}
      {equippedSet.has("hat_basic") && <div className="acc-hat-basic">🎩</div>}
      {equippedSet.has("hat_wizard") && <div className="acc-hat-wizard">🧙</div>}
      {equippedSet.has("hat_crown") && <div className="acc-hat-crown">👑</div>}
      {equippedSet.has("hat_cowboy") && <div className="accessory-layer" style={{ top: '-15px', left: '50%', transform: 'translateX(-50%)', fontSize: '28px' }}>🤠</div>}
      
      {equippedSet.has("glasses_nerd") && <div className="acc-glasses-nerd">🤓</div>}
      {equippedSet.has("glasses_sun") && <div className="acc-glasses-sun">😎</div>}
      {equippedSet.has("mask_ninja") && <div className="accessory-layer" style={{ top: '25px', left: '50%', transform: 'translateX(-50%)', fontSize: '26px' }}>🥷</div>}
      
      {equippedSet.has("cape_red") && <div className="acc-cape-red">🦸</div>}
      {equippedSet.has("cape_royal") && <div className="acc-cape-royal">👑</div>}
      {equippedSet.has("armor_basic") && <div className="accessory-layer" style={{ top: '55px', left: '50%', transform: 'translateX(-50%)', fontSize: '30px' }}>🛡️</div>}
      
      {equippedSet.has("pet_cat") && <div className="acc-pet-cat">🐱</div>}
      {equippedSet.has("pet_dragon") && <div className="acc-pet-dragon">🐉</div>}
      {equippedSet.has("pet_dog") && <div className="accessory-layer" style={{ bottom: '10px', right: '20px', fontSize: '24px' }}>🐕</div>}
      
      {equippedSet.has("weapon_sword") && <div className="acc-weapon-sword">⚔️</div>}
      {equippedSet.has("weapon_shield") && <div className="acc-weapon-shield">🛡️</div>}
      {equippedSet.has("weapon_wand") && <div className="accessory-layer" style={{ bottom: '60px', left: '10px', fontSize: '26px' }}>🪄</div>}
      
      {equippedSet.has("special_wings") && <div className="accessory-layer" style={{ inset: '-30px', fontSize: '50px', textAlign: 'center', zIndex: 1 }}>👼</div>}
      {equippedSet.has("special_halo") && <div className="accessory-layer" style={{ top: '-40px', left: '50%', transform: 'translateX(-50%)', fontSize: '32px' }}>😇</div>}
      {equippedSet.has("special_rainbow") && <div className="accessory-layer" style={{ bottom: '-25px', left: '0', right: '0', fontSize: '36px' }}>🌈</div>}

      {/* Level Indicator */}
      {points >= 2000 && (
        <div className="accessory-layer" style={{
          bottom: '-25px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '10px',
          background: 'var(--primary)',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '12px',
          fontWeight: '600'
        }}>
          {characterLevel.toUpperCase()}
        </div>
      )}
    </div>
  );
}

// Shop Component
function Shop({ 
  points, 
  accessories, 
  ownedAccessories, 
  equippedAccessories, 
  onBuy, 
  onEquip, 
  onUnequip, 
  onClose, 
  activeTab, 
  onTabChange,
  tabs 
}) {
  const ownedSet = new Set(ownedAccessories);
  const equippedSet = new Set(equippedAccessories);

  return (
    <div className="shop-overlay">
      <div className="shop-card">
        <div className="shop-header">
          <div>
            <div className="shop-title">Accessory Shop</div>
            <div className="shop-subtitle">Customize your focus buddy</div>
          </div>
          <button className="shop-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="shop-balance">
          <div className="balance-label">Your Balance</div>
          <div className="balance-amount">{points.toLocaleString()} ⭐</div>
        </div>

        <div className="shop-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`shop-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="shop-grid">
          {accessories.map((acc) => {
            const owned = ownedSet.has(acc.id);
            const equipped = equippedSet.has(acc.id);
            const canAfford = points >= acc.cost;
            
            return (
              <div 
                key={acc.id} 
                className={`shop-item ${equipped ? 'equipped' : ''} ${owned ? 'shop-item-owned' : ''}`}
              >
                <div className="shop-item-icon">{acc.icon}</div>
                <div className="shop-item-name">{acc.name}</div>
                <div className="shop-item-type">{acc.type}</div>
                <div className="shop-item-cost">
                  {acc.cost} ⭐
                  {acc.unlockAt && points < acc.unlockAt && (
                    <span style={{ fontSize: '9px', color: '#EF4444', marginLeft: '4px' }}>
                      (Unlocks at {acc.unlockAt})
                    </span>
                  )}
                </div>
                <div className="shop-item-actions">
                  {!owned ? (
                    <button
                      className="shop-btn shop-btn-buy"
                      disabled={!canAfford || (acc.unlockAt && points < acc.unlockAt)}
                      onClick={() => onBuy(acc.id)}
                    >
                      {!canAfford ? 'Need Points' : 'Buy'}
                    </button>
                  ) : equipped ? (
                    <button
                      className="shop-btn shop-btn-unequip"
                      onClick={() => onUnequip(acc.id)}
                    >
                      Unequip
                    </button>
                  ) : (
                    <button
                      className="shop-btn shop-btn-equip"
                      onClick={() => onEquip(acc.id)}
                    >
                      Equip
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;