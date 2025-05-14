const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5173;

app.use(express.json());
app.use(express.static(__dirname));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const players = {};
const levelNPCs = {};

const levelSpawners = {};
const levelCache = {};

const NPC_UPDATE_INTERVAL = 100;
const SPAWNER_CHECK_INTERVAL = 1000;
const DEFAULT_NPC_SPEED = 0.03;

// Map character that represents a spawner
const SPAWNER_CHAR = 'S';

/**
 * Load spawners from a level file and initialize the spawner system
 * @param {string} level - Level name (e.g., "levelfile1.map")
 */
function loadSpawnersFromLevel(level) {
  try {
    const levelPath = path.join(__dirname, 'assets', level);
    
    if (!fs.existsSync(levelPath)) {
      console.log(`Level file ${level} not found, skipping spawner initialization`);
      return null;
    }
    
    const fileContent = fs.readFileSync(levelPath, 'utf8');
    
    const levelName = level.replace('.map', '');
    
    // Try to find spawners definition in the level file
    const spawnerMatch = fileContent.match(new RegExp(`${levelName}\\s*=\\s*\\{[\\s\\S]*?spawners\\s*:\\s*(\\{[\\s\\S]*?\\})[,\\s]*sprites\\s*:`, 'm'));
    
    if (spawnerMatch && spawnerMatch[1]) {
      // We found spawners defined in the level file
      // This is not the safest way to parse JS, but it works for our simple map files
      try {
        // Add quotes to property names to make it valid JSON
        const jsonSpawners = spawnerMatch[1]
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Add quotes around property names
          .replace(/'/g, '"'); // Replace single quotes with double quotes
        
        // Parse the spawners
        const spawners = JSON.parse(jsonSpawners);
        
        // Initialize lastSpawn time for each spawner
        Object.values(spawners).forEach(spawner => {
          spawner.lastSpawn = Date.now();
          spawner.currentEntities = 0;
        });
        
        console.log(`Loaded ${Object.keys(spawners).length} spawners from ${level}`);
        return spawners;
      } catch (parseError) {
        console.error(`Error parsing spawners from ${level}:`, parseError);
      }
    }
    
    // If no spawners property is found, check for 'S' characters in the map
    const mapMatch = fileContent.match(/var map = "";([\s\S]*?)(?=\n\n)/);
    if (mapMatch && mapMatch[1]) {
      // Process the map string lines to extract the map layout
      const mapLines = mapMatch[1].split('\n');
      let mapString = '';
      mapLines.forEach(line => {
        const contentMatch = line.match(/map \+= "(.*)";/);
        if (contentMatch && contentMatch[1]) {
          mapString += contentMatch[1];
        }
      });
      
      // Look for 'S' characters in the map and create spawners
      const spawners = {};
      const mapWidth = 16; // Default map width
      let spawnerCount = 0;
      
      for (let y = 0; y < mapString.length / mapWidth; y++) {
        for (let x = 0; x < mapWidth; x++) {
          const index = y * mapWidth + x;
          if (mapString[index] === SPAWNER_CHAR) {
            // Found a spawner at position (x, y)
            const spawnerId = `${level}-auto-${spawnerCount++}`;
            const randomType = Math.random() > 0.5 ? "P" : "O";
            
            spawners[spawnerId] = {
              x: x,
              y: y,
              entityType: randomType,
              interval: 15000 + Math.random() * 10000, // Random interval between 15-25 seconds
              lastSpawn: Date.now(),
              maxEntities: 2,
              currentEntities: 0
            };
          }
        }
      }
      
      if (Object.keys(spawners).length > 0) {
        console.log(`Created ${Object.keys(spawners).length} auto-spawners from 'S' tiles in ${level}`);
        return spawners;
      }
    }
    
    // No spawners found in the level
    console.log(`No spawners found in ${level}`);
    return {};
  } catch (error) {
    console.error(`Error loading spawners from ${level}:`, error);
    return {};
  }
}

/**
 * Load initial spawners and NPCs for each level
 */
function loadInitialMaps() {
  try {
    // Define default levels
    const defaultLevels = ['levelfile1.map', 'levelfile2.map', 'levelfile3.map', 'sgg.map'];

    defaultLevels.forEach(level => {
      // Load spawners for this level
      const spawners = loadSpawnersFromLevel(level);
      
      if (spawners && Object.keys(spawners).length > 0) {
        // Store spawners for this level
        levelSpawners[level] = spawners;
        
        // Initialize an empty NPC list for this level
        levelNPCs[level] = {};
      } else {
        // Fall back to random NPC generation if no spawners found
        console.log(`Using random NPC generation for ${level} (no spawners)`);
        levelNPCs[level] = generateRandomNPCs(level, 10);
      }
    });

    console.log(`Loaded spawner configuration for ${Object.keys(levelSpawners).length} levels`);
    console.log(`Initialized NPCs for ${Object.keys(levelNPCs).length} levels`);
  } catch (error) {
    console.error('Error loading initial maps:', error);
  }
}

/**
 * Generate random NPCs for a level (only used for levels without spawners)
 */
function generateRandomNPCs(level, count) {
  const npcs = {};

  // Generate specified number of NPCs
  for (let i = 0; i < count; i++) {
    const id = `npc-${level}-${i}`;
    // Random position within the level bounds (16x16 is default map size)
    const x = 2 + Math.random() * 12;
    const y = 2 + Math.random() * 12;
    // Random angle
    const angle = Math.random() * Math.PI * 2;
    // Random type - "P" (Pogel) or "O" (Obetrl)
    const type = Math.random() > 0.5 ? "P" : "O";

    npcs[id] = {
      id: id,
      x: x,
      y: y,
      r: angle,       // Use 'r' for rotation/angle to match client format
      name: type,     // "P" or "O" to match client sprite types
      move: true,     // NPCs will move
      speed: Math.random() * 0.04 + 0.01,  // Random speed between 0.01-0.05
      stuckcounter: 0,
      level: level,
      a: "F",         // Default angle for sprite direction (F=front, B=back, L=left, R=right)
      lastUpdate: Date.now(),
      spawner: null   // No spawner for randomly generated NPCs
    };
  }

  return npcs;
}

/**
 * Create a new NPC from a spawner
 */
function createNPCFromSpawner(spawner, level, spawnerId) {
  const now = Date.now();
  
  // Create a unique ID for this NPC
  const id = `npc-${level}-${spawnerId}-${now}`;
  
  // Add some randomness to the spawning position (within 1 tile radius)
  const xVariation = (Math.random() * 0.8) - 0.4; // -0.4 to 0.4
  const yVariation = (Math.random() * 0.8) - 0.4; // -0.4 to 0.4
  
  // Create the NPC
  return {
    id: id,
    x: spawner.x + xVariation,
    y: spawner.y + yVariation,
    r: Math.random() * Math.PI * 2, // Random direction
    name: spawner.entityType,
    move: true,
    speed: Math.random() * 0.04 + 0.01, // Random speed between 0.01-0.05
    stuckcounter: 0,
    level: level,
    a: "F", // Default facing front
    lastUpdate: now,
    spawner: spawnerId // Reference to the spawner that created this NPC
  };
}

/**
 * Simulate movement for NPCs in a level
 */
function updateNPCs(level) {
  if (!levelNPCs[level]) return;

  const npcs = levelNPCs[level];
  const npcIds = Object.keys(npcs);

  // Update each NPC position
  npcIds.forEach(id => {
    const npc = npcs[id];

    // Skip if NPC doesn't move
    if (!npc.move) return;

    // Move NPC in current direction
    const speed = npc.speed || DEFAULT_NPC_SPEED;
    npc.x = +(npc.x) + +(Math.cos(npc.r)) * speed;
    npc.y = +(npc.y) + +(Math.sin(npc.r)) * speed;

    // Simple collision detection - if too close to map edge, change direction
    if (npc.x < 1 || npc.x > 15 || npc.y < 1 || npc.y > 15) {
      // Turn approximately 180 degrees (with some randomness)
      npc.r = (npc.r + Math.PI + (Math.random() * 0.5 - 0.25)) % (Math.PI * 2);
      npc.stuckcounter++;
    }

    // Occasionally change direction randomly
    if (Math.random() < 0.01) {
      npc.r = Math.random() * Math.PI * 2;
    }

    // Reset stuck counter after a while
    if (npc.stuckcounter > 10) {
      npc.stuckcounter = 0;
    }

    // Update sprite direction based on movement angle
    // This ensures the sprite faces the direction it's moving
    const angle = npc.r;
    if ((angle >= 0 && angle < Math.PI/4) || (angle >= 7*Math.PI/4 && angle < 2*Math.PI)) {
      npc.a = "R"; // Right
    } else if (angle >= Math.PI/4 && angle < 3*Math.PI/4) {
      npc.a = "B"; // Back
    } else if (angle >= 3*Math.PI/4 && angle < 5*Math.PI/4) {
      npc.a = "L"; // Left
    } else if (angle >= 5*Math.PI/4 && angle < 7*Math.PI/4) {
      npc.a = "F"; // Front
    }

    npc.lastUpdate = Date.now();
  });
}

/**
 * Check and update spawners for a level
 */
function updateSpawners(level) {
  // Skip if no spawners for this level
  if (!levelSpawners[level]) return;
  
  const spawners = levelSpawners[level];
  const now = Date.now();
  
  // Process each spawner
  Object.entries(spawners).forEach(([spawnerId, spawner]) => {
    // Check if it's time to spawn a new entity
    if (now - spawner.lastSpawn >= spawner.interval) {
      // Check if we're under the max entities limit for this spawner
      if (spawner.currentEntities < spawner.maxEntities) {
        // Create a new NPC
        const newNPC = createNPCFromSpawner(spawner, level, spawnerId);
        
        // Add to the level's NPCs
        if (!levelNPCs[level]) {
          levelNPCs[level] = {};
        }
        levelNPCs[level][newNPC.id] = newNPC;
        
        // Update spawner state
        spawner.lastSpawn = now;
        spawner.currentEntities++;
        
        console.log(`Spawned new ${newNPC.name} at (${newNPC.x.toFixed(2)}, ${newNPC.y.toFixed(2)}) from spawner ${spawnerId} in ${level}`);
      }
    }
  });
  
  // Check for dead NPCs from this spawner - if they're too far from the spawner, remove them
  if (levelNPCs[level]) {
    Object.entries(levelNPCs[level]).forEach(([npcId, npc]) => {
      // Check if this NPC belongs to a spawner
      if (npc.spawner && spawners[npc.spawner]) {
        const spawner = spawners[npc.spawner];
        
        // Calculate distance from spawner
        const dx = npc.x - spawner.x;
        const dy = npc.y - spawner.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        // If NPC is too far from spawner (8 tiles), remove it
        if (distance > 8) {
          delete levelNPCs[level][npcId];
          spawner.currentEntities = Math.max(0, spawner.currentEntities - 1);
          console.log(`Removed NPC ${npcId} that wandered too far from spawner ${npc.spawner}`);
        }
      }
    });
  }
}

/**
 * Start periodic updates for all level NPCs and spawners
 */
function startNPCUpdates() {
  // NPC movement updates (frequent)
  setInterval(() => {
    // Update NPCs in all active levels
    Object.keys(levelNPCs).forEach(level => {
      updateNPCs(level);
    });

    // Broadcast updated NPCs to all players
    broadcastNPCUpdates();
  }, NPC_UPDATE_INTERVAL);
  
  // Spawner checks (less frequent)
  setInterval(() => {
    // Update spawners in all active levels
    Object.keys(levelSpawners).forEach(level => {
      updateSpawners(level);
    });
  }, SPAWNER_CHECK_INTERVAL);
}

/**
 * Broadcast NPC updates to clients
 */
function broadcastNPCUpdates() {
  // Get players grouped by level
  const playersByLevel = {};

  Object.values(players).forEach(player => {
    if (!playersByLevel[player.level]) {
      playersByLevel[player.level] = [];
    }
    playersByLevel[player.level].push(player.id);
  });

  // For each level, send that level's NPCs to players in that level
  Object.keys(playersByLevel).forEach(level => {
    if (!levelNPCs[level]) return;

    // Get players in this level
    const playerIds = playersByLevel[level];

    // Get NPCs for this level to broadcast
    const npcsToSend = Object.values(levelNPCs[level]);

    // Only send if there are NPCs and players
    if (npcsToSend.length > 0 && playerIds.length > 0) {
      // Create update message
      const updateMessage = JSON.stringify({
        type: 'npc_updates',
        level: level,
        npcs: npcsToSend
      });

      // Send to all clients in this level
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.playerId && playerIds.includes(client.playerId)) {
          client.send(updateMessage);
        }
      });
    }
  });
}

/**
 * Load level data and get spawners for a level
 * Used when a player changes level
 */
function loadLevelData(level) {
  // Check if we already have spawner data for this level
  if (levelSpawners[level]) {
    return levelSpawners[level];
  }
  
  // If not, load the spawners from the level file
  const spawners = loadSpawnersFromLevel(level);
  
  if (spawners && Object.keys(spawners).length > 0) {
    // Store spawners for this level
    levelSpawners[level] = spawners;
    
    // Initialize empty NPC list for this level if it doesn't exist
    if (!levelNPCs[level]) {
      levelNPCs[level] = {};
    }
    
    return spawners;
  } else {
    // Fall back to random NPC generation if no spawners found
    if (!levelNPCs[level]) {
      console.log(`Using random NPC generation for ${level} (no spawners)`);
      levelNPCs[level] = generateRandomNPCs(level, 10);
    }
    
    return null;
  }
}

// Initialize NPCs and start updates
loadInitialMaps();
startNPCUpdates();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  // Generate unique ID for this player
  const playerId = uuidv4();

  // Store player ID on the websocket object for easier access
  ws.playerId = playerId;

  console.log(`New player connected: ${playerId}`);

  // Initialize player data with default values
  players[playerId] = {
    id: playerId,
    x: 14.0, // Default starting position from core.js
    y: 1.0,
    angle: 1.5,
    level: 'levelfile1.map',
    lastUpdate: Date.now(),
    playerName: 'Player' // Default name if none provided
  };

  // Send initial data to the new player
  const initialData = {
    type: 'init',
    id: playerId,
    players: players
  };

  // If NPCs exist for the player's level, include them in the init message
  if (levelNPCs[players[playerId].level]) {
    initialData.npcs = levelNPCs[players[playerId].level];
  }
  
  // Include spawner info in debug data (for admin users, this doesn't affect gameplay)
  if (levelSpawners[players[playerId].level]) {
    initialData.spawnerInfo = {
      count: Object.keys(levelSpawners[players[playerId].level]).length,
      isSpawnerEnabled: true
    };
  } else {
    initialData.spawnerInfo = {
      count: 0,
      isSpawnerEnabled: false
    };
  }

  ws.send(JSON.stringify(initialData));

  // Broadcast to all other players that a new player joined
  wss.clients.forEach((client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'player_joined',
        player: players[playerId]
      }));
    }
  });

  // Handle messages from the player
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Update player data based on message type
      switch (data.type) {
        case 'update_position':
          if (players[playerId]) {
            players[playerId].x = data.x;
            players[playerId].y = data.y;
            players[playerId].angle = data.angle;
            players[playerId].lookTimer = data.lookTimer;
            players[playerId].lastUpdate = Date.now();
            
            // Update player name if provided
            if (data.playerName) {
              players[playerId].playerName = data.playerName;
            }

            // Broadcast updated position to all other players
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'player_moved',
                  id: playerId,
                  x: data.x,
                  y: data.y,
                  angle: data.angle,
                  lookTimer: data.lookTimer,
                  playerName: players[playerId].playerName
                }));
              }
            });
          }
          break;

        case 'change_level':
          if (players[playerId]) {
            const oldLevel = players[playerId].level;
            const newLevel = data.level;

            // Update player data
            players[playerId].level = newLevel;
            players[playerId].x = data.x;
            players[playerId].y = data.y;
            players[playerId].angle = data.angle;
            
            // Update player name if provided
            if (data.playerName) {
              players[playerId].playerName = data.playerName;
            }

            // Broadcast level change to all other players
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'player_changed_level',
                  id: playerId,
                  level: newLevel,
                  x: data.x,
                  y: data.y,
                  angle: data.angle,
                  playerName: players[playerId].playerName
                }));
              }
            });

            // Load the level data if we don't have it already
            if (!levelNPCs[newLevel]) {
              const spawners = loadLevelData(newLevel);
              
              // If no spawners are found, fall back to random NPC generation
              if (!spawners || Object.keys(spawners).length === 0) {
                console.log(`No spawners found for ${newLevel}, using random NPCs`);
                levelNPCs[newLevel] = generateRandomNPCs(newLevel, 10);
              }
            }

            // Prepare NPC init message
            const npcInitMessage = {
              type: 'npc_init',
              level: newLevel,
              npcs: levelNPCs[newLevel]
            };
            
            // Add spawner info for debugging
            if (levelSpawners[newLevel]) {
              npcInitMessage.spawnerInfo = {
                count: Object.keys(levelSpawners[newLevel]).length,
                isSpawnerEnabled: true
              };
            } else {
              npcInitMessage.spawnerInfo = {
                count: 0,
                isSpawnerEnabled: false
              };
            }

            // Send NPCs for the new level to this player
            ws.send(JSON.stringify(npcInitMessage));
          }
          break;

        case 'interact_with_npc':
          // Handle player interactions with NPCs
          if (players[playerId] && data.npcId && levelNPCs[players[playerId].level]) {
            const npc = levelNPCs[players[playerId].level][data.npcId];
            if (npc) {
              // Process the interaction based on data.action
              // For example, changing NPC direction, stopping it, etc.
              console.log(`Player ${playerId} interacted with NPC ${data.npcId}`);

              // Broadcast the interaction to other players
              wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'npc_interaction',
                    playerId: playerId,
                    npcId: data.npcId,
                    action: data.action,
                    result: data.result || {}
                  }));
                }
              });
            }
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Handle disconnections
  ws.on('close', () => {
    console.log(`Player disconnected: ${playerId}`);

    // Broadcast player disconnection to all clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'player_left',
          id: playerId
        }));
      }
    });

    // Remove player from list
    delete players[playerId];
  });
});

// Map maker API endpoints
// Get a list of all available maps
app.get('/api/maps', (req, res) => {
  try {
    const assetsDir = path.join(__dirname, 'assets');
    
    // Read all files in the assets directory
    fs.readdir(assetsDir, (err, files) => {
      if (err) {
        console.error('Error reading assets directory:', err);
        return res.status(500).json({ error: 'Failed to read assets directory' });
      }
      
      // Filter for .map files
      const mapFiles = files.filter(file => file.endsWith('.map'));
      
      res.json({ maps: mapFiles });
    });
  } catch (error) {
    console.error('Error listing maps:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific map
app.get('/api/maps/:mapName', (req, res) => {
  try {
    const mapName = req.params.mapName;
    const mapPath = path.join(__dirname, 'assets', mapName);
    
    // Check if file exists
    if (!fs.existsSync(mapPath)) {
      return res.status(404).json({ error: 'Map not found' });
    }
    
    // Read the map file
    fs.readFile(mapPath, 'utf8', (err, data) => {
      if (err) {
        console.error(`Error reading map file ${mapName}:`, err);
        return res.status(500).json({ error: 'Failed to read map file' });
      }
      
      try {
        // Extract variables from the JS file
        // Note: This is not the safest way to parse JS, but it works for our simple map files
        const variableName = mapName.replace('.map', '');
        
        // Extract the map string
        const mapMatch = data.match(/var map = "";([\s\S]*?)(?=\n\n)/);
        let mapString = '';
        if (mapMatch && mapMatch[1]) {
          // Process the map string lines to remove the "map +=" parts
          const mapLines = mapMatch[1].split('\n');
          mapLines.forEach(line => {
            const contentMatch = line.match(/map \+= "(.*)";/);
            if (contentMatch && contentMatch[1]) {
              mapString += contentMatch[1];
            }
          });
        }
        
        // Extract the level object properties
        const levelDataMatch = data.match(new RegExp(`${variableName} = \\{([\\s\\S]*?)\\};`));
        let levelData = {};
        
        if (levelDataMatch && levelDataMatch[1]) {
          // Convert to a proper JSON object
          const levelDataString = levelDataMatch[1]
            .replace(/(\w+):/g, '"$1":')  // Add quotes to property names
            .replace(/'/g, '"')           // Replace single quotes with double quotes
            .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
            .replace(/\/\/.*/g, '')       // Remove comments
            .replace(/(\w+): "autogen"/g, '"sprites": "autogen"'); // Fix the autogen string
          
          try {
            // Parse the level data (will need some cleanup)
            levelData = JSON.parse(`{${levelDataString}}`);
          } catch (jsonError) {
            console.error('Error parsing level data JSON:', jsonError);
            console.error('Level data string:', levelDataString);
          }
        }
        
        // Combine into a result
        const result = {
          nMapWidth: levelData.nMapWidth || 16,
          nMapHeight: levelData.nMapHeight || 16,
          map: mapString,
          fPlayerX: levelData.fPlayerX || 8,
          fPlayerY: levelData.fPlayerY || 8,
          fPlayerA: levelData.fPlayerA || 1.5,
          exitsto: levelData.exitsto || '',
          color: levelData.color || 'white',
          background: levelData.background || 'black',
          sprites: levelData.sprites || 'autogen'
        };
        
        res.json(result);
      } catch (parseError) {
        console.error(`Error parsing map file ${mapName}:`, parseError);
        res.status(500).json({ error: 'Failed to parse map file' });
      }
    });
  } catch (error) {
    console.error('Error getting map:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save a map
app.post('/api/maps/:mapName', (req, res) => {
  try {
    const mapName = req.params.mapName;
    const mapData = req.body;
    
    // Validate the map data
    if (!mapData || !mapData.map || !mapData.nMapWidth || !mapData.nMapHeight) {
      return res.status(400).json({ error: 'Invalid map data' });
    }
    
    // Create the map file content
    const variableName = mapName.replace('.map', '');
    let mapFileContent = 'var map = "";\n';
    
    // Add the map data, 16 characters per line for readability
    const mapWidth = parseInt(mapData.nMapWidth);
    for (let i = 0; i < mapData.map.length; i += mapWidth) {
      const line = mapData.map.substring(i, i + mapWidth);
      mapFileContent += `map += "${line}";\n`;
    }
    
    // Add the level object
    mapFileContent += `\n${variableName} = {\n`;
    mapFileContent += `  nMapHeight: ${mapData.nMapHeight},\n`;
    mapFileContent += `  nMapWidth: ${mapData.nMapWidth},\n`;
    mapFileContent += `  map: map,\n`;
    mapFileContent += `  fPlayerX: ${mapData.fPlayerX},\n`;
    mapFileContent += `  fPlayerY: ${mapData.fPlayerY},\n`;
    mapFileContent += `  fPlayerA: ${mapData.fPlayerA},\n`;
    
    // Add optional properties if provided
    if (mapData.exitsto) {
      mapFileContent += `  exitsto: "${mapData.exitsto}",\n`;
    }
    
    if (mapData.color) {
      mapFileContent += `  color: "${mapData.color}",\n`;
    }
    
    if (mapData.background) {
      mapFileContent += `  background: "${mapData.background}",\n`;
    }
    
    // For now, we'll always use autogen sprites, but this could be customized later
    mapFileContent += `  sprites: "autogen",\n`;
    mapFileContent += `};`;
    
    const mapPath = path.join(__dirname, 'assets', mapName);
    
    // Write the file
    fs.writeFile(mapPath, mapFileContent, 'utf8', (err) => {
      if (err) {
        console.error(`Error writing map file ${mapName}:`, err);
        return res.status(500).json({ error: 'Failed to write map file' });
      }
      
      res.json({ success: true, message: 'Map saved successfully' });
    });
  } catch (error) {
    console.error('Error saving map:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`TARTARUS multiplayer server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});