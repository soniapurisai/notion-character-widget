// Mock data for development
const MOCK_ACCESSORIES_CATALOG = [
  { id: "hat_basic", name: "Basic Hat", type: "Head", cost: 100 },
  { id: "glasses_nerd", name: "Nerd Glasses", type: "Face", cost: 150 },
  { id: "cape_red", name: "Red Cape", type: "Back", cost: 250 },
  { id: "pet_cat", name: "Pet Cat", type: "Companion", cost: 500 }
];

// Try to get backend URL, fallback to empty string if not set
const BACKEND = import.meta.env?.VITE_BACKEND_URL || "";

// Check if we're in development mode without a backend
const IS_DEV_MODE = !BACKEND || BACKEND.includes("localhost");

export async function fetchState(userId = "default") {
  // If no backend URL is set or we're in dev mode, use mock data
  if (!BACKEND || IS_DEV_MODE) {
    console.log("Using mock data for development");
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Return mock state based on userState.json but with all required fields
    const mockState = {
      points: 2860,
      ownedAccessories: ["hat_basic", "glasses_nerd"],
      equippedAccessories: ["hat_basic", "glasses_nerd"],
      countedTasks: [
        "2523fa27-43e3-8000-b57f-dbbf7c3675cf",
        // ... (your existing tasks from userState.json)
      ],
      accessoriesCatalog: MOCK_ACCESSORIES_CATALOG,
      stats: {
        totalCompletedTasks: 150,
        pointsGainedThisSync: 50
      }
    };
    
    return mockState;
  }
  
  // Otherwise, try to call the real backend
  try {
    const res = await fetch(`${BACKEND}/api/state?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch state: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error("API fetch failed, falling back to mock data:", error);
    
    // Fallback to mock data
    const fallbackState = {
      points: 2860,
      ownedAccessories: ["hat_basic", "glasses_nerd"],
      equippedAccessories: ["hat_basic", "glasses_nerd"],
      countedTasks: [],
      accessoriesCatalog: MOCK_ACCESSORIES_CATALOG,
      stats: {
        totalCompletedTasks: 0,
        pointsGainedThisSync: 0
      }
    };
    
    return fallbackState;
  }
}

export async function buyAccessory(userId, accessoryId) {
  // If no backend URL is set or we're in dev mode, simulate the purchase
  if (!BACKEND || IS_DEV_MODE) {
    console.log("Simulating purchase of:", accessoryId);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Find the accessory
    const accessory = MOCK_ACCESSORIES_CATALOG.find(acc => acc.id === accessoryId);
    if (!accessory) {
      throw new Error("Accessory not found");
    }
    
    // For demo purposes, we'll use a hardcoded current points
    const currentPoints = 2860;
    if (currentPoints < accessory.cost) {
      throw new Error("Not enough points");
    }
    
    // Return mock response
    return {
      points: currentPoints - accessory.cost,
      ownedAccessories: ["hat_basic", "glasses_nerd", accessoryId]
    };
  }
  
  // Otherwise, call the real backend
  try {
    const res = await fetch(`${BACKEND}/api/buy-accessory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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
  // If no backend URL is set or we're in dev mode, simulate equipping
  if (!BACKEND || IS_DEV_MODE) {
    console.log("Simulating equip of:", accessoryId);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Return mock response
    return {
      equippedAccessories: ["hat_basic", "glasses_nerd", accessoryId]
    };
  }
  
  // Otherwise, call the real backend
  try {
    const res = await fetch(`${BACKEND}/api/equip-accessory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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