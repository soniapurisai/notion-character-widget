import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Client } from "@notionhq/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const STATUS_PROP = process.env.NOTION_STATUS_PROPERTY || "Status";
const DONE_VALUE = process.env.NOTION_DONE_VALUE || "Done";
const POINTS_PER_TASK = parseInt(process.env.POINTS_PER_TASK || "10", 10);

const DATA_FILE = path.join(__dirname, "data", "userState.json");

// ====== Helpers for persistence ======
function loadState() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// state structure:
// {
//   "default": {
//     "points": 0,
//     "ownedAccessories": ["hat_basic"],
//     "equippedAccessories": ["hat_basic"],
//     "countedTasks": ["notion-page-id-1", ...]
//   }
// }

let userState = loadState();

function getUserState(userId = "default") {
  if (!userState[userId]) {
    userState[userId] = {
      points: 0,
      ownedAccessories: [],
      equippedAccessories: [],
      countedTasks: []
    };
  }
  return userState[userId];
}

// ====== Middleware ======
app.use(express.json());
app.use(
  cors({
    origin: "*", // if you want to lock down, put your frontend URL here
  })
);

// ====== Notion helpers ======
async function fetchCompletedTasks() {
  if (!DATABASE_ID) {
    throw new Error("NOTION_DATABASE_ID is not set");
  }

  let hasMore = true;
  let startCursor = undefined;
  const completed = [];

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: startCursor,
      filter: {
        property: "Done",
        checkbox: {
          equals: true
        }
      }                
    });

    for (const page of response.results) {
      completed.push({
        id: page.id,
        last_edited_time: page.last_edited_time
      });
    }

    hasMore = response.has_more;
    startCursor = response.next_cursor || undefined;
  }

  return completed;
}

// ====== Accessories definition (shop catalog) ======
const ACCESSORY_CATALOG = [
  {
    id: "hat_basic",
    name: "Basic Hat",
    cost: 20,
    type: "hat"
  },
  {
    id: "glasses_nerd",
    name: "Nerd Glasses",
    cost: 40,
    type: "face"
  },
  {
    id: "cape_red",
    name: "Red Cape",
    cost: 60,
    type: "back"
  },
  {
    id: "pet_cat",
    name: "Tiny Cat Companion",
    cost: 80,
    type: "pet"
  }
];

// ====== Routes ======

// GET /api/state?userId=optional
// Returns character + points + accessories + synced task summary
app.get("/api/state", async (req, res) => {
  const userId = req.query.userId || "default";
  const state = getUserState(userId);

  try {
    const completedTasks = await fetchCompletedTasks();

    // Determine which completed tasks are "new"
    const known = new Set(state.countedTasks);
    const newCompleted = completedTasks.filter((t) => !known.has(t.id));

    const pointsToAdd = newCompleted.length * POINTS_PER_TASK;

    if (pointsToAdd > 0) {
      state.points += pointsToAdd;
      state.countedTasks.push(...newCompleted.map((t) => t.id));
      saveState(userState);
    }

    res.json({
      userId,
      points: state.points,
      ownedAccessories: state.ownedAccessories,
      equippedAccessories: state.equippedAccessories,
      accessoriesCatalog: ACCESSORY_CATALOG,
      stats: {
        totalCompletedTasks: completedTasks.length,
        newlyCountedTasks: newCompleted.length,
        pointsGainedThisSync: pointsToAdd
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to sync with Notion",
      details: err.message
    });
  }
});

// POST /api/buy-accessory
// body: { userId, accessoryId }
app.post("/api/buy-accessory", (req, res) => {
  const { userId = "default", accessoryId } = req.body;
  if (!accessoryId) {
    return res.status(400).json({ error: "accessoryId is required" });
  }

  const state = getUserState(userId);
  const accessory = ACCESSORY_CATALOG.find((a) => a.id === accessoryId);

  if (!accessory) {
    return res.status(404).json({ error: "Accessory not found" });
  }

  if (state.ownedAccessories.includes(accessoryId)) {
    return res.status(400).json({ error: "Already owned" });
  }

  if (state.points < accessory.cost) {
    return res.status(400).json({ error: "Not enough points" });
  }

  state.points -= accessory.cost;
  state.ownedAccessories.push(accessoryId);
  saveState(userState);

  res.json({
    points: state.points,
    ownedAccessories: state.ownedAccessories
  });
});

// POST /api/equip-accessory
// body: { userId, accessoryId }
app.post("/api/equip-accessory", (req, res) => {
  const { userId = "default", accessoryId } = req.body;
  if (!accessoryId) {
    return res.status(400).json({ error: "accessoryId is required" });
  }

  const state = getUserState(userId);
  if (!state.ownedAccessories.includes(accessoryId)) {
    return res.status(400).json({ error: "You do not own this accessory" });
  }

  const accessory = ACCESSORY_CATALOG.find((a) => a.id === accessoryId);
  if (!accessory) {
    return res.status(404).json({ error: "Accessory not found" });
  }

  // Only one accessory per type equipped
  const equippedSet = new Set(state.equippedAccessories);
  // remove any equipped accessory of same type
  for (const accId of [...equippedSet]) {
    const acc = ACCESSORY_CATALOG.find((a) => a.id === accId);
    if (acc && acc.type === accessory.type) {
      equippedSet.delete(accId);
    }
  }
  equippedSet.add(accessoryId);
  state.equippedAccessories = Array.from(equippedSet);

  saveState(userState);

  res.json({
    equippedAccessories: state.equippedAccessories
  });
});

// Unequip accessory endpoint
app.post('/api/unequip-accessory', async (req, res) => {
  try {
    const { userId, accessoryId } = req.body;
    
    // Your existing state logic...
    const state = await loadState(userId);
    
    // Remove from equipped
    state.equippedAccessories = state.equippedAccessories.filter(id => id !== accessoryId);
    
    // Save state
    await saveState(userId, state);
    
    res.json({
      equippedAccessories: state.equippedAccessories,
      message: 'Accessory unequipped'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Test Notion connection
app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('Testing Notion connection...');
    
    // Test 1: Check environment variables
    if (!process.env.NOTION_API_TOKEN) {
      return res.json({ 
        status: 'error', 
        message: 'NOTION_API_TOKEN is not set' 
      });
    }
    
    if (!process.env.NOTION_DATABASE_ID) {
      return res.json({ 
        status: 'error', 
        message: 'NOTION_DATABASE_ID is not set' 
      });
    }
    
    // Test 2: Try to query the database
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      page_size: 1
    });
    
    // Test 3: Check database structure
    const database = await notion.databases.retrieve({
      database_id: process.env.NOTION_DATABASE_ID
    });
    
    // Look for status/properties
    const hasStatus = database.properties.Status;
    const hasCheckbox = database.properties.Checkbox;
    
    res.json({
      status: 'success',
      message: 'Connected to Notion successfully',
      databaseName: database.title[0]?.plain_text || 'Untitled',
      totalPages: response.results.length,
      hasStatusField: !!hasStatus,
      hasCheckboxField: !!hasCheckbox,
      databaseId: process.env.NOTION_DATABASE_ID,
      properties: Object.keys(database.properties)
    });
    
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: error.code,
      suggestion: 'Check your API token, database ID, and sharing permissions'
    });
  }
});

// ====== Start ======
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
