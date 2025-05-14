/**
 * Multiplayer.js - Multiplayer implementation for the TARTARUS game engine
 * 
 * Handles WebSocket connections and player synchronization
 */

var GameMultiplayer = (function() {
  // Store reference to the game state
  var gameState;
  
  // WebSocket connection
  var socket;
  
  // Player ID assigned by the server
  var playerId;
  
  // Other players in the game
  var otherPlayers = {};

  // Synchronized NPCs from the server
  var serverNPCs = {};

  // Flag to indicate if we've received server NPCs
  var hasReceivedServerNPCs = false;
  
  // Spawner system info
  var spawnerInfo = {
    count: 0,
    isSpawnerEnabled: false
  };

  // Last update time for throttling position updates
  var lastUpdateTime = 0;

  // Update rate in milliseconds (80ms = ~12 updates per second, balancing between smoothness and performance)
  var updateRate = 80;

  // Store previous positions for interpolation
  var playerPositions = {};
  
  // Store previous positions for NPC interpolation
  var npcPositions = {};

  /**
   * Set reference to the game state
   */
  var setGameState = function(state) {
    gameState = state;
  };
  
  /**
   * Get player name from localStorage
   */
  var getPlayerName = function() {
    return localStorage.getItem('playerName') || 'Player';
  };
  
  /**
   * Initialize WebSocket connection
   */
  var connect = function() {
    // Get the current hostname and use the specified port
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var host = window.location.hostname || 'localhost';
    var wsUrl = protocol + '//' + host + ':5173';
    
    // Create WebSocket connection
    socket = new WebSocket(wsUrl);
    
    // Connection opened
    socket.addEventListener('open', function(event) {
      console.log('Connected to TARTARUS server');

      // Update connected state
      gameState.bMultiplayerConnected = true;

      // Update UI to show connected status in settings panel
      var mpStatusDisplay = document.getElementById('mp-status-display');
      if (mpStatusDisplay) {
        mpStatusDisplay.textContent = 'Connected';
        mpStatusDisplay.style.color = '#00ff00';
      }
    });

    // Listen for messages from server
    socket.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (error) {
        console.error('Error parsing server message:', error);
      }
    });

    // Connection closed
    socket.addEventListener('close', function(event) {
      console.log('Disconnected from TARTARUS server');

      // Update connected state
      gameState.bMultiplayerConnected = false;

      // Update UI to show disconnected status in settings panel
      var mpStatusDisplay = document.getElementById('mp-status-display');
      if (mpStatusDisplay) {
        mpStatusDisplay.textContent = 'Disconnected';
        mpStatusDisplay.style.color = '#ff0000';
      }

      // Clear other players and server NPCs
      otherPlayers = {};
      serverNPCs = {};
      hasReceivedServerNPCs = false;

      // Update player count in settings panel
      var mpPlayerCount = document.getElementById('mp-player-count');
      if (mpPlayerCount) {
        mpPlayerCount.textContent = '1'; // Just the local player
      }

      // Try to reconnect after 5 seconds if multiplayer is still enabled
      if (gameState.bMultiplayerEnabled) {
        setTimeout(connect, 5000);
      }
    });

    // Connection error
    socket.addEventListener('error', function(event) {
      console.error('WebSocket error:', event);

      // Update connected state
      gameState.bMultiplayerConnected = false;

      // Update UI to show error status in settings panel
      var mpStatusDisplay = document.getElementById('mp-status-display');
      if (mpStatusDisplay) {
        mpStatusDisplay.textContent = 'Connection Error';
        mpStatusDisplay.style.color = '#ff0000';
      }
    });
  };
  
  /**
   * Handle messages from the server
   */
  var handleServerMessage = function(data) {
    switch (data.type) {
      case 'init':
        // Store the player ID assigned by the server
        playerId = data.id;
        console.log('Assigned player ID:', playerId);

        // Initialize other players from existing players on the server
        for (var id in data.players) {
          if (id !== playerId) {
            otherPlayers[id] = data.players[id];

            // Initialize interpolation data for this player
            playerPositions[id] = {
              x: data.players[id].x,
              y: data.players[id].y,
              angle: data.players[id].angle,
              lookTimer: data.players[id].lookTimer || 0,
              lastUpdate: Date.now(),
              targetX: data.players[id].x,
              targetY: data.players[id].y,
              targetAngle: data.players[id].angle,
              targetLookTimer: data.players[id].lookTimer || 0
            };
          }
        }

        // Initialize NPCs if included in the init message
        if (data.npcs) {
          handleNPCUpdates(data.npcs);
          hasReceivedServerNPCs = true;
        }
        
        // Store spawner information if provided
        if (data.spawnerInfo) {
          spawnerInfo = data.spawnerInfo;
          console.log('Spawner system status:', 
                     spawnerInfo.isSpawnerEnabled ? 'Enabled' : 'Disabled', 
                     'with', spawnerInfo.count, 'spawners');
          updateSettingsPanel();
        }

        // Update player count in settings panel
        updatePlayerCount();
        break;
        
      case 'player_joined':
        // Add new player to our local list
        if (data.player.id !== playerId) {
          console.log('Player joined:', data.player.id);
          otherPlayers[data.player.id] = data.player;

          // Initialize interpolation data for this player
          playerPositions[data.player.id] = {
            x: data.player.x,
            y: data.player.y,
            angle: data.player.angle,
            lookTimer: data.player.lookTimer || 0,
            lastUpdate: Date.now(),
            targetX: data.player.x,
            targetY: data.player.y,
            targetAngle: data.player.angle,
            targetLookTimer: data.player.lookTimer || 0
          };

          // Update player count in settings panel
          updatePlayerCount();
        }
        break;

      case 'player_left':
        // Remove player from our local list
        if (data.id !== playerId) {
          console.log('Player left:', data.id);
          delete otherPlayers[data.id];
          // Also remove from interpolation data
          delete playerPositions[data.id];

          // Update player count in settings panel
          updatePlayerCount();
        }
        break;
        
      case 'player_moved':
        // Update player position
        if (data.id !== playerId && otherPlayers[data.id]) {
          // Store previous position for interpolation
          if (!playerPositions[data.id]) {
            playerPositions[data.id] = {
              x: otherPlayers[data.id].x,
              y: otherPlayers[data.id].y,
              angle: otherPlayers[data.id].angle,
              lookTimer: otherPlayers[data.id].lookTimer,
              lastUpdate: Date.now(),
              targetX: data.x,
              targetY: data.y,
              targetAngle: data.angle,
              targetLookTimer: data.lookTimer
            };
          } else {
            // Update previous position
            playerPositions[data.id].x = otherPlayers[data.id].x;
            playerPositions[data.id].y = otherPlayers[data.id].y;
            playerPositions[data.id].angle = otherPlayers[data.id].angle;
            playerPositions[data.id].lookTimer = otherPlayers[data.id].lookTimer;
            playerPositions[data.id].lastUpdate = Date.now();

            // Set new target position
            playerPositions[data.id].targetX = data.x;
            playerPositions[data.id].targetY = data.y;
            playerPositions[data.id].targetAngle = data.angle;
            playerPositions[data.id].targetLookTimer = data.lookTimer;
          }

          // Set the immediate position for compatibility with other code
          otherPlayers[data.id].x = data.x;
          otherPlayers[data.id].y = data.y;
          otherPlayers[data.id].angle = data.angle;
          otherPlayers[data.id].lookTimer = data.lookTimer;
        }
        break;
        
      case 'player_changed_level':
        // Update player level
        if (data.id !== playerId && otherPlayers[data.id]) {
          otherPlayers[data.id].level = data.level;
          otherPlayers[data.id].x = data.x;
          otherPlayers[data.id].y = data.y;
          otherPlayers[data.id].angle = data.angle;

          // Reset interpolation data for this player
          if (playerPositions[data.id]) {
            playerPositions[data.id] = {
              x: data.x,
              y: data.y,
              angle: data.angle,
              lookTimer: otherPlayers[data.id].lookTimer || 0,
              lastUpdate: Date.now(),
              targetX: data.x,
              targetY: data.y,
              targetAngle: data.angle,
              targetLookTimer: otherPlayers[data.id].lookTimer || 0
            };
          }
        }
        break;

      case 'npc_updates':
        // Update NPCs based on server data
        handleNPCUpdates(data.npcs);
        break;

      case 'npc_init':
        // Initial NPC setup after level change
        console.log('Received NPC init for level:', data.level);
        handleNPCUpdates(data.npcs);
        hasReceivedServerNPCs = true;
        
        // Store spawner information if provided
        if (data.spawnerInfo) {
          spawnerInfo = data.spawnerInfo;
          console.log('Spawner system status for level', data.level + ':', 
                     spawnerInfo.isSpawnerEnabled ? 'Enabled' : 'Disabled', 
                     'with', spawnerInfo.count, 'spawners');
          updateSettingsPanel();
        }
        break;

      case 'npc_interaction':
        // Handle NPC interaction by another player
        if (data.playerId !== playerId && serverNPCs[data.npcId]) {
          console.log('NPC interaction by player:', data.playerId, 'on NPC:', data.npcId);
          // Update the NPC based on the interaction
          // This could involve changing direction, stopping movement, etc.
        }
        break;
    }
  };

  /**
   * Handle updates to NPCs from server
   */
  var handleNPCUpdates = function(npcs) {
    // Update our local NPCs based on server data
    if (!npcs || !Array.isArray(npcs)) return;

    // Process each NPC in the update
    npcs.forEach(function(npc) {
      if (!npc.id) return;

      // Store previous position for interpolation if this is an existing NPC
      if (serverNPCs[npc.id]) {
        // Create or update interpolation data
        if (!npcPositions[npc.id]) {
          npcPositions[npc.id] = {
            x: serverNPCs[npc.id].x,
            y: serverNPCs[npc.id].y,
            r: serverNPCs[npc.id].r, // Using 'r' for rotation to match client format
            lastUpdate: Date.now(),
            targetX: npc.x,
            targetY: npc.y,
            targetR: npc.r
          };
        } else {
          // Update previous position
          npcPositions[npc.id].x = serverNPCs[npc.id].x;
          npcPositions[npc.id].y = serverNPCs[npc.id].y;
          npcPositions[npc.id].r = serverNPCs[npc.id].r;
          npcPositions[npc.id].lastUpdate = Date.now();

          // Set new target position
          npcPositions[npc.id].targetX = npc.x;
          npcPositions[npc.id].targetY = npc.y;
          npcPositions[npc.id].targetR = npc.r;
        }
      }

      // Update or add the NPC
      serverNPCs[npc.id] = npc;
    });

    // Log the first time we receive NPCs
    if (!hasReceivedServerNPCs && Object.keys(serverNPCs).length > 0) {
      console.log('Received initial NPCs from server:', Object.keys(serverNPCs).length);
      hasReceivedServerNPCs = true;
    }
  };
  
  /**
   * Send player position update to the server (throttled)
   */
  var sendPositionUpdate = function() {
    // Check if connected and enough time has passed since last update
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Check if position changed significantly or it's time for a periodic update
      var shouldUpdate = Date.now() - lastUpdateTime > updateRate;

      // Always update if player has moved significantly
      if (gameState.bMoveForward || gameState.bMoveBackward ||
          gameState.bTurnLeft || gameState.bTurnRight ||
          gameState.bTurnUp || gameState.bTurnDown ||
          gameState.bStrafeLeft || gameState.bStrafeRight) {
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        lastUpdateTime = Date.now();

        // Send current position and angle
        socket.send(JSON.stringify({
          type: 'update_position',
          x: gameState.fPlayerX,
          y: gameState.fPlayerY,
          angle: gameState.fPlayerA,
          lookTimer: gameState.fLooktimer,
          playerName: getPlayerName()
        }));
      }
    }
  };
  
  /**
   * Send level change notification to the server
   */
  var sendLevelChange = function(level) {
    // Check if connected
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Reset server NPCs when changing levels
      serverNPCs = {};
      npcPositions = {};
      hasReceivedServerNPCs = false;

      // Send level change
      socket.send(JSON.stringify({
        type: 'change_level',
        level: level,
        x: gameState.fPlayerX,
        y: gameState.fPlayerY,
        angle: gameState.fPlayerA,
        playerName: getPlayerName()
      }));
    }
  };

  /**
   * Send NPC interaction to the server
   */
  var sendNPCInteraction = function(npcId, action, result) {
    // Check if connected
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Send interaction data
      socket.send(JSON.stringify({
        type: 'interact_with_npc',
        npcId: npcId,
        action: action,
        result: result || {}
      }));
    }
  };
  
  /**
   * Convert other players into sprite format for rendering
   */
  var getPlayerSprites = function() {
    // Only include players in the same level
    var currentLevel = gameState.sLevelstring + '.map';
    var sprites = {};
    var index = 0;

    for (var id in otherPlayers) {
      var player = otherPlayers[id];

      // Only add players in the same level
      if (player.level === currentLevel) {
        // Calculate the difference in angles between the player and the viewer
        var angleDiff = Math.atan2(
          player.y - gameState.fPlayerY,
          player.x - gameState.fPlayerX
        ) - gameState.fPlayerA;

        // Normalize the angle difference
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        // Determine player's direction relative to the viewer for proper sprite selection
        var direction = "F"; // default front view

        if (angleDiff > -Math.PI/4 && angleDiff < Math.PI/4) {
          direction = "F"; // Facing player
        } else if (angleDiff >= Math.PI/4 && angleDiff < 3*Math.PI/4) {
          direction = "L"; // Player sees right side
        } else if (angleDiff <= -Math.PI/4 && angleDiff > -3*Math.PI/4) {
          direction = "R"; // Player sees left side
        } else {
          direction = "B"; // Facing away from player
        }

        // Check if player is moving or turning
        var isMoving = false;

        // If we have position data for this player, check if they're moving or turning
        if (playerPositions[id]) {
          // Calculate position movement
          var dx = playerPositions[id].targetX - playerPositions[id].x;
          var dy = playerPositions[id].targetY - playerPositions[id].y;
          var movement = Math.sqrt(dx * dx + dy * dy);

          // Calculate angle movement (turning)
          var angleDelta = Math.abs(playerPositions[id].targetAngle - playerPositions[id].angle);

          // Normalize angle difference for the wrap-around case
          if (angleDelta > Math.PI) {
            angleDelta = Math.PI * 2 - angleDelta;
          }

          // Calculate look up/down movement
          var lookDelta = Math.abs(playerPositions[id].targetLookTimer - playerPositions[id].lookTimer);

          // If the player has moved, turned, or is looking up/down, consider them moving
          isMoving = movement > 0.01 || angleDelta > 0.02 || lookDelta > 0.5;
        }

        // Calculate distance between this player and the local player
        var fDistance = Math.hypot(player.x - gameState.fPlayerX, player.y - gameState.fPlayerY);

        sprites[index] = {
          x: player.x,
          y: player.y,
          r: player.angle,
          name: "MP", // Special multiplayer player type
          move: isMoving, // Set to true if player is moving
          z: fDistance, // Set the actual distance for collision detection
          id: id, // Store the player ID for reference
          a: direction, // Set the angle for correct sprite orientation
          // Add collision handling properties to match NPC sprites
          speed: 0.03,
          stuckcounter: 0,
          // Add player name for display
          playerName: player.playerName || 'Player'
        };
        index++;
      }
    }

    return sprites;
  };

  /**
   * Convert server NPCs into sprite format for rendering
   */
  var getNPCSprites = function() {
    // Only include NPCs if we've received them from the server
    if (!hasReceivedServerNPCs) {
      return null;
    }

    var currentLevel = gameState.sLevelstring + '.map';
    var sprites = {};
    var index = 0;

    for (var id in serverNPCs) {
      var npc = serverNPCs[id];

      // Only add NPCs in the current level
      if (npc.level === currentLevel) {
        // Calculate distance between this NPC and the local player
        var fDistance = Math.hypot(npc.x - gameState.fPlayerX, npc.y - gameState.fPlayerY);

        // Validate that this is a valid sprite type
        if (!npc.name || !window.allSprites[npc.name]) {
          console.warn("Invalid NPC sprite type: " + npc.name);
          continue;
        }

        // Standard sprite format to match what entities.js expects
        sprites[index] = {
          x: npc.x,
          y: npc.y,
          r: npc.r,
          name: npc.name, // "P" or "O" for Pogel or Obetrl
          move: npc.move, // Whether the NPC should move
          speed: npc.speed || 0.03,
          z: fDistance,
          id: id,
          stuckcounter: npc.stuckcounter || 0,
          // Add angle property for proper sprite orientation if not present
          a: npc.a || "F", // Default to front-facing if not specified
          // This is a server-managed NPC
          isServerNPC: true
        };
        index++;
      }
    }

    return sprites;
  };
  
  /**
   * Update multiplayer state
   */
  var update = function() {
    // Send position update to server
    sendPositionUpdate();

    // Interpolate player positions
    interpolatePlayerPositions();

    // Interpolate NPC positions
    interpolateNPCPositions();
  };

  /**
   * Update player count in settings panel
   */
  var updatePlayerCount = function() {
    var mpPlayerCount = document.getElementById('mp-player-count');
    if (mpPlayerCount) {
      var playerCount = Object.keys(otherPlayers).length + 1; // +1 for local player
      mpPlayerCount.textContent = playerCount;
    }
  };
  
  /**
   * Update all settings panel information
   */
  var updateSettingsPanel = function() {
    // Update player count
    updatePlayerCount();
    
    // Update spawner info if we have the UI elements
    var spawnerStatus = document.getElementById('spawner-status');
    var spawnerCount = document.getElementById('spawner-count');
    
    if (!spawnerStatus) {
      // Create spawner info section if it doesn't exist
      var settingsPanel = document.getElementById('settings-panel');
      if (settingsPanel) {
        var gameInfoSection = settingsPanel.querySelector('.settings-section:nth-child(3)');
        if (gameInfoSection) {
          // Create spawner status row
          var spawnerStatusRow = document.createElement('div');
          spawnerStatusRow.className = 'settings-row';
          spawnerStatusRow.innerHTML = '<span>Spawner System:</span><span id="spawner-status">' + 
                                      (spawnerInfo.isSpawnerEnabled ? 'Enabled' : 'Disabled') + '</span>';
          
          // Create spawner count row
          var spawnerCountRow = document.createElement('div');
          spawnerCountRow.className = 'settings-row';
          spawnerCountRow.innerHTML = '<span>Spawner Count:</span><span id="spawner-count">' + 
                                     spawnerInfo.count + '</span>';
          
          // Insert after player count row
          var playerCountRow = gameInfoSection.querySelector('.settings-row:nth-child(3)');
          if (playerCountRow) {
            gameInfoSection.insertBefore(spawnerStatusRow, playerCountRow.nextSibling);
            gameInfoSection.insertBefore(spawnerCountRow, spawnerStatusRow.nextSibling);
          } else {
            // Fallback - append to the end
            gameInfoSection.appendChild(spawnerStatusRow);
            gameInfoSection.appendChild(spawnerCountRow);
          }
          
          // No need to update since we've just created them
          return;
        }
      }
    } else {
      // Update existing elements
      spawnerStatus.textContent = spawnerInfo.isSpawnerEnabled ? 'Enabled' : 'Disabled';
      spawnerStatus.style.color = spawnerInfo.isSpawnerEnabled ? '#00ff00' : '#ff8800';
      
      if (spawnerCount) {
        spawnerCount.textContent = spawnerInfo.count;
      }
    }
  };

  /**
   * Interpolate player positions between updates to reduce jitter
   */
  var interpolatePlayerPositions = function() {
    // Get current time
    var currentTime = Date.now();

    // Interpolate each player's position
    for (var id in playerPositions) {
      if (!otherPlayers[id]) continue;

      var position = playerPositions[id];

      // Calculate how much time has passed since the last update
      var timeSinceUpdate = currentTime - position.lastUpdate;

      // Calculate interpolation factor (0 to 1)
      // This assumes we receive position updates roughly every 'updateRate' ms
      var factor = Math.min(1, timeSinceUpdate / updateRate);

      // Apply smooth interpolation to the player's visible position
      // We keep the actual target positions untouched for the next interpolation cycle
      otherPlayers[id].x = position.x + (position.targetX - position.x) * factor;
      otherPlayers[id].y = position.y + (position.targetY - position.y) * factor;

      // Angle interpolation with special handling for the wrap-around case
      var angleDiff = position.targetAngle - position.angle;

      // Handle the case where the angle crosses the 0/2π boundary
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      otherPlayers[id].angle = position.angle + angleDiff * factor;

      // Interpolate lookTimer, which is simpler and doesn't need wrap-around handling
      otherPlayers[id].lookTimer = position.lookTimer +
                               (position.targetLookTimer - position.lookTimer) * factor;
    }
  };

  /**
   * Interpolate NPC positions between updates to reduce jitter
   */
  var interpolateNPCPositions = function() {
    // Get current time
    var currentTime = Date.now();

    // Interpolate each NPC's position
    for (var id in npcPositions) {
      if (!serverNPCs[id]) continue;

      var position = npcPositions[id];

      // Calculate how much time has passed since the last update
      var timeSinceUpdate = currentTime - position.lastUpdate;

      // Calculate interpolation factor (0 to 1)
      var factor = Math.min(1, timeSinceUpdate / updateRate);

      // Apply smooth interpolation to the NPC's visible position
      serverNPCs[id].x = position.x + (position.targetX - position.x) * factor;
      serverNPCs[id].y = position.y + (position.targetY - position.y) * factor;

      // Angle interpolation with special handling for the wrap-around case
      var angleDiff = position.targetR - position.r;

      // Handle the case where the angle crosses the 0/2π boundary
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      serverNPCs[id].r = position.r + angleDiff * factor;
    }
  };

  /**
   * Check if server NPCs have been received
   */
  var hasServerNPCs = function() {
    return hasReceivedServerNPCs;
  };
  
  // Public API
  return {
    connect: connect,
    update: update,
    getPlayerSprites: getPlayerSprites,
    getNPCSprites: getNPCSprites,
    sendLevelChange: sendLevelChange,
    sendNPCInteraction: sendNPCInteraction,
    setGameState: setGameState,
    hasServerNPCs: hasServerNPCs,
    getPlayerName: getPlayerName,
    updateSettingsPanel: updateSettingsPanel,
    get otherPlayers() { return otherPlayers; },
    get spawnerInfo() { return spawnerInfo; }
  };
})();