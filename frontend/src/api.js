const BACKEND = import.meta.env.VITE_BACKEND_URL;

export async function fetchState(userId = "default") {
  const res = await fetch(`${BACKEND}/api/state?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error("Failed to fetch state");
  }
  return res.json();
}

export async function buyAccessory(userId, accessoryId) {
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
}

export async function equipAccessory(userId, accessoryId) {
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
}
