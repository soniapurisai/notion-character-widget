// Mock data for development
const MOCK_ACCESSORIES_CATALOG = [
  { id: "hat_basic", name: "Basic Hat", type: "head", cost: 100, icon: "🎩" },
  { id: "hat_wizard", name: "Wizard Hat", type: "head", cost: 300, icon: "🧙" },
  { id: "hat_crown", name: "Royal Crown", type: "head", cost: 500, icon: "👑" },
  { id: "glasses_nerd", name: "Nerd Glasses", type: "face", cost: 150, icon: "🤓" },
  { id: "glasses_sun", name: "Sunglasses", type: "face", cost: 200, icon: "😎" },
  { id: "cape_red", name: "Red Cape", type: "body", cost: 250, icon: "🦸" },
  { id: "cape_royal", name: "Royal Cape", type: "body", cost: 400, icon: "👑" },
  { id: "pet_cat", name: "Pet Cat", type: "companion", cost: 300, icon: "🐱" },
  { id: "pet_dragon", name: "Pet Dragon", type: "companion", cost: 800, icon: "🐉" },
  { id: "weapon_sword", name: "Sword", type: "weapon", cost: 400, icon: "⚔️" },
  { id: "weapon_shield", name: "Shield", type: "weapon", cost: 350, icon: "🛡️" },
  { id: "aura_basic", name: "Basic Aura", type: "aura", cost: 200, icon: "✨" },
  { id: "aura_advanced", name: "Advanced Aura", type: "aura", cost: 500, icon: "🌟" },
  { id: "special_wings", name: "Angel Wings", type: "special", cost: 1000, icon: "👼", unlockAt: 5000 },
  { id: "special_halo", name: "Divine Halo", type: "special", cost: 1500, icon: "😇", unlockAt: 7500 },
  { id: "special_rainbow", name: "Rainbow Trail", type: "special", cost: 2000, icon: "🌈", unlockAt: 10000 }
];

const BACKEND = import.meta.env?.VITE_BACKEND_URL || "";
const IS_DEV_MODE = !BACKEND || BACKEND.includes("localhost");

// Mock state for development
let mockState = {
  points: 2860,
  ownedAccessories: ["hat_basic", "glasses_nerd"],
  equippedAccessories: ["hat_basic", "glasses_nerd"],
  countedTasks: [],
  stats: {
    totalCompletedTasks: 150,
    pointsGainedThisSync: 0,
    streak: 7,
    level: 2
  }
};

export async function fetchState(userId = "default") {
  if (!BACKEND || IS_DEV_MODE) {
    console.log("Using mock data for development");
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      ...mockState,
      accessoriesCatalog: MOCK_ACCESSORIES_CATALOG
    };
  }
  
  try {
    const res = await fetch(`${BACKEND}/api/state?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error(`Failed to fetch state: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("API fetch failed:", error);
    return {
      ...mockState,
      accessoriesCatalog: MOCK_ACCESSORIES_CATALOG
    };
  }
}

export async function buyAccessory(userId, accessoryId) {
  if (!BACKEND || IS_DEV_MODE) {
    console.log("Simulating purchase of:", accessoryId);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const accessory = MOCK_ACCESSORIES_CATALOG.find(acc => acc.id === accessoryId);
    if (!accessory) throw new Error("Accessory not found");
    
    if (mockState.points < accessory.cost) {
      throw new Error("Not enough points");
    }
    
    // Update mock state
    mockState.points -= accessory.cost;
    if (!mockState.ownedAccessories.includes(accessoryId)) {
      mockState.ownedAccessories.push(accessoryId);
    }
    
    return {
      points: mockState.points,
      ownedAccessories: [...mockState.ownedAccessories]
    };
  }
  
  try {
    const res = await fetch(`${BACKEND}/api/buy-accessory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, accessoryId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to buy accessory");
    }

    return res.json();
  } catch (error) {
    console.error("API buy failed:", error);
    throw error;
  }
}

export async function equipAccessory(userId, accessoryId) {
  if (!BACKEND || IS_DEV_MODE) {
    console.log("Simulating equip of:", accessoryId);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Check if owned
    if (!mockState.ownedAccessories.includes(accessoryId)) {
      throw new Error("You don't own this accessory");
    }
    
    // Add to equipped if not already
    if (!mockState.equippedAccessories.includes(accessoryId)) {
      mockState.equippedAccessories.push(accessoryId);
    }
    
    return {
      equippedAccessories: [...mockState.equippedAccessories]
    };
  }
  
  try {
    const res = await fetch(`${BACKEND}/api/equip-accessory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, accessoryId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to equip accessory");
    }

    return res.json();
  } catch (error) {
    console.error("API equip failed:", error);
    throw error;
  }
}

export async function unequipAccessory(userId, accessoryId) {
  if (!BACKEND || IS_DEV_MODE) {
    console.log("Simulating unequip of:", accessoryId);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Remove from equipped
    mockState.equippedAccessories = mockState.equippedAccessories.filter(id => id !== accessoryId);
    
    return {
      equippedAccessories: [...mockState.equippedAccessories]
    };
  }
  
  try {
    const res = await fetch(`${BACKEND}/api/unequip-accessory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, accessoryId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to unequip accessory");
    }

    return res.json();
  } catch (error) {
    console.error("API unequip failed:", error);
    throw error;
  }
}