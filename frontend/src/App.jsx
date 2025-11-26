import React, { useEffect, useState } from "react";
import { fetchState, buyAccessory, equipAccessory } from "./api";

const USER_ID = "default"; // later you can make this dynamic / per Notion user

function App() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [shopOpen, setShopOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadState = async () => {
    setSyncing(true);
    setError("");
    try {
      const data = await fetchState(USER_ID);
      setState(data);
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

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
      setError(e.message);
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
      setError(e.message);
    }
  };

  const toggleShop = () => {
    setShopOpen((prev) => !prev);
  };

  if (loading) {
    return (
      <div className="widget-root">
        <div className="widget-card">Loading character...</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="widget-root">
        <div className="widget-card">No state loaded.</div>
      </div>
    );
  }

  const { points, accessoriesCatalog, ownedAccessories, equippedAccessories, stats } = state;

  const equippedSet = new Set(equippedAccessories || []);
  const ownedSet = new Set(ownedAccessories || []);

  return (
    <div className="widget-root">
      <div className="widget-card">
        {/* Top bar */}
        <div className="widget-header">
          <div className="widget-title">Focus Buddy</div>
          <button
            className="widget-sync-btn"
            onClick={loadState}
            disabled={syncing}
          >
            {syncing ? "Syncing..." : "Sync"}
          </button>
        </div>

        {/* Character + points */}
        <div className="widget-main">
          <div className="character-wrapper" onClick={toggleShop}>
            <CharacterDisplay equippedAccessories={equippedAccessories} />
          </div>

          <div className="widget-info">
            <div className="points-display">
              <span className="points-label">Points</span>
              <span className="points-value">{points}</span>
            </div>
            <div className="task-stats">
              <div>Completed tasks: {stats?.totalCompletedTasks ?? 0}</div>
              {stats?.pointsGainedThisSync > 0 && (
                <div className="task-recent">
                  +{stats.pointsGainedThisSync} pts from new tasks!
                </div>
              )}
              <div className="hint-text">
                Click the character to open the shop.
              </div>
            </div>
          </div>
        </div>

        {error && <div className="widget-error">⚠ {error}</div>}

        {/* Shop overlay */}
        {shopOpen && (
          <div className="shop-overlay">
            <div className="shop-card">
              <div className="shop-header">
                <span>Accessory Shop</span>
                <button
                  className="shop-close-btn"
                  onClick={() => setShopOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="shop-points">Points: {points}</div>

              <div className="shop-grid">
                {accessoriesCatalog.map((acc) => {
                  const owned = ownedSet.has(acc.id);
                  const equipped = equippedSet.has(acc.id);

                  return (
                    <div className="shop-item" key={acc.id}>
                      <div className="shop-item-name">{acc.name}</div>
                      <div className="shop-item-type">{acc.type}</div>
                      <div className="shop-item-cost">{acc.cost} pts</div>
                      <div className="shop-item-actions">
                        {!owned ? (
                          <button
                            className="shop-btn"
                            disabled={points < acc.cost}
                            onClick={() => handleBuy(acc.id)}
                          >
                            {points < acc.cost ? "Not enough" : "Buy"}
                          </button>
                        ) : (
                          <button
                            className={`shop-btn ${
                              equipped ? "shop-btn-equipped" : ""
                            }`}
                            onClick={() => handleEquip(acc.id)}
                          >
                            {equipped ? "Equipped" : "Equip"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ====== Character display ======
function CharacterDisplay({ equippedAccessories = [] }) {
  const equippedSet = new Set(equippedAccessories);

  return (
    <div className="character-root">
      {/* Body */}
      <div className="character-body">
        <div className="character-face">
          <div className="face-eyes">
            <span>◕</span>
            <span>◕</span>
          </div>
          <div className="face-mouth">﹏</div>
        </div>
        <div className="character-torso"></div>
        <div className="character-legs"></div>
      </div>

      {/* Accessories */}
      {equippedSet.has("hat_basic") && <div className="acc-hat-basic">🎩</div>}
      {equippedSet.has("glasses_nerd") && (
        <div className="acc-glasses-nerd">🤓</div>
      )}
      {equippedSet.has("cape_red") && <div className="acc-cape-red">🦸</div>}
      {equippedSet.has("pet_cat") && <div className="acc-pet-cat">🐱</div>}
    </div>
  );
}

export default App;
