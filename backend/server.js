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

// ====== IMPORTANT: Check environment variables ======
console.log('🔧 Environment Check:');
console.log('NOTION_API_KEY exists:', !!process.env.NOTION_API_KEY);
console.log('NOTION_DATABASE_ID exists:', !!process.env.NOTION_DATABASE_ID);
console.log('Database ID:', process.env.NOTION_DATABASE_ID);

if (!process.env.NOTION_API_KEY) {
  console.error('❌ CRITICAL: NOTION_API_KEY is not set!');
} else {
  console.log('✅ NOTION_API_KEY is set (first 10 chars):', process.env.NOTION_API_KEY.substring(0, 10) + '...');
}

if (!process.env.NOTION_DATABASE_ID) {
  console.error('❌ CRITICAL: NOTION_DATABASE_ID is not set!');
} else {
  console.log('✅ NOTION_DATABASE_ID:', process.env.NOTION_DATABASE_ID);
}

// Initialize Notion client ONLY if API key exists
let notion = null;
if (process.env.NOTION_API_KEY) {
  try {
    notion = new Client({ auth: process.env.NOTION_API_KEY });
    console.log('✅ Notion client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Notion client:', error.message);
  }
} else {
  console.log('⚠️  Notion client NOT initialized - no API key');
}

const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const POINTS_PER_TASK = parseInt(process.env.POINTS_PER_TASK || "10", 10);

// ====== Data persistence ======
const DATA_FILE = path.join(__dirname, "data", "userState.json");

// Ensure data directory exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadState() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      // Create initial state if file doesn't exist
      const initialState = {
        "default": {
          "points": 1000,
          "ownedAccessories": ["hat_basic", "glasses_nerd"],
          "equippedAccessories": ["hat_basic", "glasses_nerd"],
          "countedTasks": []
        }
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialState, null, 2));
      return initialState;
    }
    
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    console.log(`📁 Loaded state from ${DATA_FILE}`);
    return data;
  } catch (e) {
    console.error('❌ Error loading state:', e.message);
    return {};
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
    console.log(`💾 Saved state to ${DATA_FILE}`);
  } catch (e) {
    console.error('❌ Error saving state:', e.message);
  }
}

let userState = loadState();

function getUserState(userId = "default") {
  if (!userState[userId]) {
    userState[userId] = {
      points: 1000,
      ownedAccessories: ["hat_basic", "glasses_nerd"],
      equippedAccessories: ["hat_basic", "glasses_nerd"],
      countedTasks: []
    };
    saveState(userState);
  }
  return userState[userId];
}

// ====== Middleware ======
app.use(express.json());
app.use(cors({
  origin: "*",
}));

// ====== Notion helpers ======
async function fetchCompletedTasks() {
  if (!DATABASE_ID) {
    throw new Error("NOTION_DATABASE_ID is not set");
  }

  if (!notion) {
    console.log('📝 Using mock data (Notion not configured)');
    // Return mock tasks for testing
    return [
      { id: 'mock-1', last_edited_time: new Date().toISOString() },
      { id: 'mock-2', last_edited_time: new Date().toISOString() }
    ];
  }

  try {
    console.log('🔍 Fetching tasks from Notion database:', DATABASE_ID);
    
    let hasMore = true;
    let startCursor = undefined;
    const completed = [];
    let totalQueries = 0;

    while (hasMore && totalQueries < 10) { // Safety limit
      totalQueries++;
      
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100
      });

      console.log(`📄 Query ${totalQueries}: Found ${response.results.length} pages`);

      for (const page of response.results) {
        // Check multiple possible completion indicators
        const properties = page.properties;
        
        // Check if page is completed (multiple strategies)
        let isCompleted = false;
        
        // Strategy 1: Checkbox property named "Done", "Completed", or "Checkbox"
        for (const propName of ['Done', 'Completed', 'Checkbox', 'Status']) {
          if (properties[propName] && properties[propName].checkbox) {
            isCompleted = properties[propName].checkbox;
            if (isCompleted) {
              console.log(`   ✓ Completed via checkbox: ${propName}`);
              break;
            }
          }
        }
        
        // Strategy 2: Status property with "Done" value
        if (!isCompleted && properties['Status'] && properties['Status'].select) {
          const status = properties['Status'].select.name;
          isCompleted = status === 'Done' || status === 'done' || status === 'DONE';
          if (isCompleted) {
            console.log(`   ✓ Completed via status: ${status}`);
          }
        }
        
        // Strategy 3: Any checkbox property that's true
        if (!isCompleted) {
          for (const [propName, propValue] of Object.entries(properties)) {
            if (propValue.type === 'checkbox' && propValue.checkbox === true) {
              isCompleted = true;
              console.log(`   ✓ Completed via generic checkbox: ${propName}`);
              break;
            }
          }
        }

        if (isCompleted) {
          completed.push({
            id: page.id,
            last_edited_time: page.last_edited_time,
            properties: Object.keys(properties)
          });
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      if (!hasMore) {
        console.log(`✅ Found ${completed.length} completed tasks total`);
      }
    }

    return completed;
  } catch (error) {
    console.error('❌ Error fetching tasks from Notion:', error.message);
    console.error('Error code:', error.code);
    
    // If there's an error, return empty array for now
    return [];
  }
}

// ====== Accessories definition ======
const ACCESSORY_CATALOG = [
  {
    id: "hat_basic",
    name: "Basic Hat",
    cost: 20,
    type: "hat",
    icon: "🎩"
  },
  {
    id: "glasses_nerd",
    name: "Nerd Glasses",
    cost: 40,
    type: "face",
    icon: "🤓"
  },
  {
    id: "cape_red",
    name: "Red Cape",
    cost: 60,
    type: "back",
    icon: "🦸"
  },
  {
    id: "pet_cat",
    name: "Tiny Cat Companion",
    cost: 80,
    type: "pet",
    icon: "🐱"
  },
  {
    id: "hat_wizard",
    name: "Wizard Hat",
    cost: 150,
    type: "hat",
    icon: "🧙"
  },
  {
    id: "aura_basic",
    name: "Basic Aura",
    cost: 200,
    type: "aura",
    icon: "✨"
  }
];

// ====== Routes ======

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "focus-buddy-backend",
    notion_configured: !!notion,
    database_id_set: !!DATABASE_ID
  });
});

// GET /api/state?userId=default
app.get("/api/state", async (req, res) => {
  const userId = req.query.userId || "default";
  console.log(`\n📊 GET /api/state for user: ${userId}`);
  
  const state = getUserState(userId);
  
  try {
    console.log(`📝 Fetching tasks for ${userId}...`);
    const completedTasks = await fetchCompletedTasks();
    console.log(`✅ Found ${completedTasks.length} completed tasks`);

    // Determine which completed tasks are "new"
    const known = new Set(state.countedTasks || []);
    const newCompleted = completedTasks.filter((t) => !known.has(t.id));
    
    console.log(`🆕 New tasks: ${newCompleted.length}`);
    
    const pointsToAdd = newCompleted.length * POINTS_PER_TASK;

    if (pointsToAdd > 0) {
      state.points += pointsToAdd;
      state.countedTasks = [...(state.countedTasks || []), ...newCompleted.map((t) => t.id)];
      saveState(userState);
      console.log(`💰 Added ${pointsToAdd} points. New total: ${state.points}`);
    }

    // Calculate stats
    const stats = {
      totalCompletedTasks: completedTasks.length,
      newlyCountedTasks: newCompleted.length,
      pointsGainedThisSync: pointsToAdd,
      streak: Math.floor(state.points / 100),
      level: Math.floor(state.points / 1000) + 1
    };

    res.json({
      userId,
      points: state.points,
      ownedAccessories: state.ownedAccessories || [],
      equippedAccessories: state.equippedAccessories || [],
      accessoriesCatalog: ACCESSORY_CATALOG,
      stats: stats,
      syncInfo: {
        lastSync: new Date().toISOString(),
        mode: notion ? "notion" : "mock",
        taskCount: completedTasks.length
      }
    });
    
    console.log(`📤 Sent response for ${userId} with ${state.points} points`);
    
  } catch (err) {
    console.error("❌ Error in /api/state:", err.message);
    console.error(err.stack);
    
    // Return current state even if sync fails
    res.json({
      userId,
      points: state.points,
      ownedAccessories: state.ownedAccessories || [],
      equippedAccessories: state.equippedAccessories || [],
      accessoriesCatalog: ACCESSORY_CATALOG,
      stats: {
        totalCompletedTasks: 0,
        newlyCountedTasks: 0,
        pointsGainedThisSync: 0,
        streak: 0,
        level: 1
      },
      error: "Sync failed, using cached data",
      details: err.message
    });
  }
});

// POST /api/buy-accessory
app.post("/api/buy-accessory", (req, res) => {
  console.log("\n🛒 POST /api/buy-accessory");
  console.log("Request body:", req.body);
  
  const { userId = "default", accessoryId } = req.body;
  
  if (!accessoryId) {
    console.log("❌ Missing accessoryId");
    return res.status(400).json({ error: "accessoryId is required" });
  }

  const state = getUserState(userId);
  const accessory = ACCESSORY_CATALOG.find((a) => a.id === accessoryId);

  if (!accessory) {
    console.log(`❌ Accessory not found: ${accessoryId}`);
    return res.status(404).json({ error: "Accessory not found" });
  }

  if (state.ownedAccessories.includes(accessoryId)) {
    console.log(`❌ Already owned: ${accessoryId}`);
    return res.status(400).json({ error: "Already owned" });
  }

  if (state.points < accessory.cost) {
    console.log(`❌ Not enough points: ${state.points} < ${accessory.cost}`);
    return res.status(400).json({ 
      error: "Not enough points",
      required: accessory.cost,
      current: state.points
    });
  }

  state.points -= accessory.cost;
  state.ownedAccessories.push(accessoryId);
  saveState(userState);

  console.log(`✅ ${userId} bought ${accessory.name} for ${accessory.cost} points`);
  console.log(`   Remaining points: ${state.points}`);
  console.log(`   Owned accessories: ${state.ownedAccessories.length}`);

  res.json({
    points: state.points,
    ownedAccessories: state.ownedAccessories,
    message: `Successfully purchased ${accessory.name}!`
  });
});

// POST /api/equip-accessory
app.post("/api/equip-accessory", (req, res) => {
  console.log("\n👕 POST /api/equip-accessory");
  console.log("Request body:", req.body);
  
  const { userId = "default", accessoryId } = req.body;
  
  if (!accessoryId) {
    return res.status(400).json({ error: "accessoryId is required" });
  }

  const state = getUserState(userId);
  
  if (!state.ownedAccessories.includes(accessoryId)) {
    console.log(`❌ Not owned: ${accessoryId}`);
    return res.status(400).json({ error: "You do not own this accessory" });
  }

  const accessory = ACCESSORY_CATALOG.find((a) => a.id === accessoryId);
  if (!accessory) {
    return res.status(404).json({ error: "Accessory not found" });
  }

  // Create a copy of equipped accessories
  let equipped = [...state.equippedAccessories];
  
  // Remove any accessory of the same type
  equipped = equipped.filter(accId => {
    const acc = ACCESSORY_CATALOG.find(a => a.id === accId);
    return !acc || acc.type !== accessory.type;
  });
  
  // Add the new accessory
  if (!equipped.includes(accessoryId)) {
    equipped.push(accessoryId);
  }
  
  state.equippedAccessories = equipped;
  saveState(userState);

  console.log(`✅ ${userId} equipped ${accessory.name}`);
  console.log(`   Equipped: ${equipped.join(', ')}`);

  res.json({
    equippedAccessories: state.equippedAccessories,
    message: `${accessory.name} equipped!`
  });
});

// POST /api/unequip-accessory
app.post("/api/unequip-accessory", (req, res) => {
  console.log("\n👕 POST /api/unequip-accessory");
  console.log("Request body:", req.body);
  
  const { userId = "default", accessoryId } = req.body;
  
  if (!accessoryId) {
    return res.status(400).json({ error: "accessoryId is required" });
  }

  const state = getUserState(userId);
  
  // Remove the accessory if it exists
  const index = state.equippedAccessories.indexOf(accessoryId);
  if (index > -1) {
    state.equippedAccessories.splice(index, 1);
    saveState(userState);
    
    const accessory = ACCESSORY_CATALOG.find(a => a.id === accessoryId);
    console.log(`✅ ${userId} unequipped ${accessory?.name || accessoryId}`);
    
    res.json({
      equippedAccessories: state.equippedAccessories,
      message: "Accessory unequipped successfully"
    });
  } else {
    res.status(400).json({ error: "Accessory not currently equipped" });
  }
});

// GET /api/test-connection - Enhanced test endpoint
app.get("/api/test-connection", async (req, res) => {
  console.log("\n🔧 GET /api/test-connection");
  
  try {
    // Check environment variables
    const envCheck = {
      NOTION_API_KEY: !!process.env.NOTION_API_KEY,
      NOTION_DATABASE_ID: !!process.env.NOTION_DATABASE_ID,
      PORT: process.env.PORT || 4000
    };

    if (!process.env.NOTION_API_KEY) {
      return res.json({
        status: "error",
        message: "NOTION_API_KEY environment variable is not set",
        envCheck: envCheck,
        suggestion: "Add NOTION_API_KEY to your Render environment variables"
      });
    }

    if (!process.env.NOTION_DATABASE_ID) {
      return res.json({
        status: "error",
        message: "NOTION_DATABASE_ID environment variable is not set",
        envCheck: envCheck,
        suggestion: "Add NOTION_DATABASE_ID to your Render environment variables"
      });
    }

    // Try to connect to Notion
    if (!notion) {
      return res.json({
        status: "error",
        message: "Notion client failed to initialize",
        envCheck: envCheck,
        apiKeyFirstChars: process.env.NOTION_API_KEY.substring(0, 10) + "..."
      });
    }

    console.log("Testing Notion connection...");
    
    // Test 1: Retrieve database info
    const database = await notion.databases.retrieve({
      database_id: DATABASE_ID
    });
    
    // Test 2: Query some data
    const queryResponse = await notion.databases.query({
      database_id: DATABASE_ID,
      page_size: 5
    });
    
    // Check properties
    const properties = Object.keys(database.properties);
    const hasCheckbox = properties.some(prop => {
      const propType = database.properties[prop].type;
      return propType === 'checkbox';
    });
    
    const hasStatus = properties.some(prop => {
      const propObj = database.properties[prop];
      return propObj.type === 'select' || propObj.type === 'status';
    });

    res.json({
      status: "success",
      message: "Connected to Notion successfully!",
      database: {
        id: database.id,
        name: database.title[0]?.plain_text || "Untitled",
        url: `https://notion.so/${database.id.replace(/-/g, '')}`,
        properties: properties,
        totalPages: queryResponse.results.length,
        hasCheckboxProperty: hasCheckbox,
        hasStatusProperty: hasStatus
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || "development",
        port: process.env.PORT || 4000,
        pointsPerTask: POINTS_PER_TASK
      },
      suggestion: "Make sure your database has a checkbox column or status column to mark completed tasks"
    });

  } catch (error) {
    console.error("❌ Connection test failed:", error.message);
    
    res.status(500).json({
      status: "error",
      message: error.message,
      code: error.code,
      envCheck: {
        NOTION_API_KEY: !!process.env.NOTION_API_KEY,
        NOTION_DATABASE_ID: !!process.env.NOTION_DATABASE_ID,
        apiKeyLength: process.env.NOTION_API_KEY ? process.env.NOTION_API_KEY.length : 0
      },
      suggestion: error.code === 'unauthorized' 
        ? "Check your NOTION_API_KEY and ensure it starts with 'secret_'"
        : error.code === 'object_not_found'
        ? `Check your NOTION_DATABASE_ID: ${DATABASE_ID}. Make sure the database exists and is shared with your integration.`
        : "Check that your database is shared with your Notion integration"
    });
  }
});

// GET /api/debug - Show current state
app.get("/api/debug", (req, res) => {
  const userId = req.query.userId || "default";
  const state = getUserState(userId);
  
  res.json({
    userId,
    state: state,
    filePath: DATA_FILE,
    fileExists: fs.existsSync(DATA_FILE),
    serverTime: new Date().toISOString(),
    memoryUsage: process.memoryUsage()
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Focus Buddy Backend</title>
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .warning { background: #fff3cd; color: #856404; }
        code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>🎮 Focus Buddy Backend</h1>
      
      <div class="status ${notion ? 'success' : 'error'}">
        <strong>Notion Status:</strong> ${notion ? '✅ Connected' : '❌ Not Connected'}
      </div>
      
      <div class="status ${DATABASE_ID ? 'success' : 'error'}">
        <strong>Database ID:</strong> ${DATABASE_ID || 'Not Set'}
      </div>
      
      <h2>🔗 Test Endpoints:</h2>
      <ul>
        <li><a href="/health">/health</a> - Health check</li>
        <li><a href="/api/test-connection">/api/test-connection</a> - Test Notion connection</li>
        <li><a href="/api/state?userId=default">/api/state?userId=default</a> - Get user state</li>
        <li><a href="/api/debug">/api/debug</a> - Debug info</li>
      </ul>
      
      <h2>🔧 Configuration:</h2>
      <ul>
        <li>Port: <code>${PORT}</code></li>
        <li>Database ID: <code>${DATABASE_ID || 'Not set'}</code></li>
        <li>Points per task: <code>${POINTS_PER_TASK}</code></li>
        <li>Data file: <code>${DATA_FILE}</code></li>
      </ul>
      
      <p><strong>Need help?</strong> Check the logs for detailed error messages.</p>
    </body>
    </html>
  `);
});

// ====== Start Server ======
app.listen(PORT, () => {
  console.log(`\n🚀 =================================`);
  console.log(`   Focus Buddy Backend Started!`);
  console.log(`   =================================`);
  console.log(`   📡 Port: ${PORT}`);
  console.log(`   🔑 Notion: ${notion ? '✅ Connected' : '❌ Not Connected'}`);
  console.log(`   📊 Database ID: ${DATABASE_ID || 'Not set'}`);
  console.log(`   💾 Data file: ${DATA_FILE}`);
  console.log(`\n   🔗 Endpoints:`);
  console.log(`   - http://localhost:${PORT}/health`);
  console.log(`   - http://localhost:${PORT}/api/test-connection`);
  console.log(`   - http://localhost:${PORT}/api/state?userId=default`);
  console.log(`\n=================================\n`);
});