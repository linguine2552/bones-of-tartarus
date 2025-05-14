/**
 * Core.js - Core engine for the TARTARUS game engine
 * 
 * Main game loop and initialization
 */

var GameCore = (function() {
  // Game state object to be shared with other modules
  var gameState = {
    // DOM elements
    eScreen: null,
    eDebugOut: null,
    eMultiplayerStatus: null,
    // Player info
    playerName: '',
    mainMenuActive: true,

    // Screen dimensions (initial values, will be updated based on viewport)
    nScreenWidth: window.innerWidth,
    nScreenHeight: window.innerHeight,

    // View settings
    fFOV: GameUtils.PI / 2.25,
    fDepth: 32.0,
    nLookLimit: 12, // Increased from 8 to allow more extreme looking up/down

    // Input state
    bTurnLeft: false,
    bTurnRight: false,
    bTurnUp: false,        // Added for up/down look control
    bTurnDown: false,      // Added for up/down look control
    bStrafeLeft: false,
    bStrafeRight: false,
    bMoveForward: false,
    bMoveBackward: false,
    // Jump functionality repurposed for headbob
    bHeadbob: false,
    // bRunning: false, - Sprint functionality removed
    bPaused: false,
    bPlayerMayMoveForward: true,

    // Timers and counters
    nHeadbobTimer: 0,
    fLooktimer: 0,

    // Depth buffer for rendering
    fDepthBuffer: [],

    // Player state
    fPlayerX: 14.0,
    fPlayerY: 1.0,
    fPlayerA: 1.5,
    nDegrees: 0,
    nRenderMode: 2,

    // Map state
    nMapHeight: 16,
    nMapWidth: 16,
    map: "",
    sLevelstring: "", // Track the current level name

    // Game loop and animation
    gameRun: null,
    animationTimer: 0,
    lastFrameTime: 0,
    currentFPS: 0,
    fpsUpdateCounter: 0,
    settingsPanelUpdateCounter: 0,

    // Level sprites
    oLevelSprites: {},

    // Multiplayer state
    bMultiplayerEnabled: true, // Enable multiplayer by default
    bMultiplayerConnected: false,

    // Settings panel
    bSettingsPanelVisible: false
  };
  
  // Maximum number of attempts to fit screen
  var nTrymax = 512;
  
  /**
   * Test if the screen size fits, adjust if needed, and start the game
   */
  var testScreenSizeAndStartTheGame = function() {
    // Get the full viewport dimensions
    var widthOfViewport = GameUtils.getWidth();
    var heightOfViewPort = GameUtils.getHeight();

    // Calculate character-based screen dimensions based on font size
    // The font size is set in the CSS (6px for desktop, 3px for mobile)
    var fontSize = window.innerWidth <= 768 ? 3 : 6;
    var lineHeight = fontSize * 1.15; // Based on the line-height: 1.15em in CSS

    // For monospace fonts, width is typically around 60% of height
    var charWidthRatio = 0.6;

    // Calculate dimensions that will fill screen appropriately
    gameState.nScreenWidth = Math.floor(widthOfViewport / (fontSize * charWidthRatio));
    gameState.nScreenHeight = Math.floor(heightOfViewPort / lineHeight);

    // Ensure screen width is not too narrow on wide screens
    if (gameState.nScreenWidth < gameState.nScreenHeight * 2) {
      gameState.nScreenWidth = Math.floor(gameState.nScreenHeight * 2);
    }

    // Create a test screen with the new dimensions
    GameRenderer.createTestScreen(gameState);

    // Log the new dimensions for debugging
    console.log("Screen: " + gameState.nScreenWidth + "x" + gameState.nScreenHeight);

    // Start the game with the new dimensions
    startGame();
  };
  
  /**
   * Initialize render mode selector buttons
   */
  var initRenderModeButtons = function() {
    document.getElementById("solid").addEventListener("click", function() {
      gameState.nRenderMode = 0;
    });
    
    document.getElementById("texture").addEventListener("click", function() {
      gameState.nRenderMode = 1;
    });
    
    document.getElementById("shader").addEventListener("click", function() {
      gameState.nRenderMode = 2;
    });
  };
  
  /**
   * Main game loop
   */
  var gameLoop = function() {
    // Calculate FPS
    var now = performance.now();
    if (gameState.lastFrameTime) {
      // Calculate frame time in milliseconds and convert to FPS
      var frameTime = now - gameState.lastFrameTime;
      var instantFPS = 1000 / frameTime;

      // Only update the FPS display periodically (every 15 frames) to make it readable
      gameState.fpsUpdateCounter++;
      if (gameState.fpsUpdateCounter >= 15) {
        gameState.currentFPS = Math.round(instantFPS);
        gameState.fpsUpdateCounter = 0;
      }
    }
    gameState.lastFrameTime = now;

    // Update animation timer
    gameState.animationTimer++;
    if (gameState.animationTimer > 15) {
      gameState.animationTimer = 0;
    }

    // Store original sprites before any multiplayer processing
    var originalSprites = {};
    var originalSpriteKeys = Object.keys(gameState.oLevelSprites);

    // Backup original sprites
    for (var i = 0; i < originalSpriteKeys.length; i++) {
      originalSprites[originalSpriteKeys[i]] = Object.assign({}, gameState.oLevelSprites[originalSpriteKeys[i]]);
    }

    // Clear the original sprites if in multiplayer mode and we have server NPCs
    var usingServerNPCs = false;
    var combinedSpriteCount = originalSpriteKeys.length;

    // Update multiplayer if enabled
    if (gameState.bMultiplayerEnabled && gameState.bMultiplayerConnected) {
      GameMultiplayer.update();

      // Get server-synchronized NPCs
      var serverNPCs = GameMultiplayer.getNPCSprites();

      // If we have server NPCs, replace the local NPCs with them
      if (serverNPCs !== null) {
        usingServerNPCs = true;
        // Don't use any local NPCs when we have server NPCs
        // This ensures all clients see the same NPCs
        originalSprites = {};
        combinedSpriteCount = 0;
      }

      // Get other player sprites and add them to the level sprites
      var mpSprites = GameMultiplayer.getPlayerSprites();

      // Add multiplayer player sprites to the level sprites
      var mpSpriteCount = Object.keys(mpSprites).length;

      for (var i = 0; i < mpSpriteCount; i++) {
        gameState.oLevelSprites[combinedSpriteCount + i] = mpSprites[i];
      }

      combinedSpriteCount += mpSpriteCount;

      // Add server NPC sprites if available
      if (usingServerNPCs) {
        var npcSpriteCount = Object.keys(serverNPCs).length;

        for (var i = 0; i < npcSpriteCount; i++) {
          // Ensure serverNPCs[i] is valid before adding
          if (serverNPCs[i] && serverNPCs[i].name && window.allSprites[serverNPCs[i].name]) {
            gameState.oLevelSprites[combinedSpriteCount + i] = serverNPCs[i];
          } else if (serverNPCs[i]) {
            console.warn("Skipping invalid server NPC at index " + i + " with type: " +
                        (serverNPCs[i].name ? serverNPCs[i].name : "undefined"));
          }
        }

        // Add debug output about NPC count
        if (npcSpriteCount > 0) {
          console.log("Using " + npcSpriteCount + " server-synchronized NPCs");
        }
      }
    }

    // Update sprites
    GameEntities.updateSpriteBuffer(gameState);

    // When using server NPCs, they're moved by the server
    // but we still need to handle player-NPC collisions locally
    if (usingServerNPCs) {
      // Call a collision-only function that doesn't move server NPCs
      // but still handles player-entity collisions
      GameEntities.handleCollisions(gameState);
    } else {
      // If not using server NPCs, use standard movement and collision detection
      GameEntities.moveSprites(gameState);
    }

    // Process player movement
    GameInput.updateMovement(gameState);

    // Normalize player angle
    if (gameState.fPlayerA < 0) {
      gameState.fPlayerA += GameUtils.PIx2;
    }
    if (gameState.fPlayerA > GameUtils.PIx2) {
      gameState.fPlayerA -= GameUtils.PIx2;
    }

    // Handle headbob effect when moving
    if (gameState.bMoveForward || gameState.bMoveBackward || gameState.bStrafeLeft || gameState.bStrafeRight) {
      // Oscillate the headbob timer between 0 and 6
      gameState.nHeadbobTimer = (gameState.nHeadbobTimer + 0.2) % 2;
    } else {
      // Reset headbob when not moving
      if (gameState.nHeadbobTimer > 0) {
        gameState.nHeadbobTimer = Math.max(0, gameState.nHeadbobTimer - 0.4);
      }
    }

    // Render the frame
    GameRenderer.renderFrame(gameState);

    // Restore original sprites after rendering (cleanup multiplayer sprites)
    if (gameState.bMultiplayerEnabled && gameState.bMultiplayerConnected) {
      gameState.oLevelSprites = originalSprites;
    }

    // Update settings panel periodically (every 30 frames)
    gameState.settingsPanelUpdateCounter++;
    if (gameState.settingsPanelUpdateCounter >= 30) {
      // Update the settings panel if it's visible
      var settingsPanel = document.getElementById('settings-panel');
      if (settingsPanel && settingsPanel.style.display === 'block') {
        GameInput.updateSettingsPanel(gameState);
      }
      gameState.settingsPanelUpdateCounter = 0;
    }
    
    // Update debug display with lookFactor values
    var debugDiv = document.getElementById('lookfactor-debug');
    if (debugDiv) {
      // Calculate lookFactor values used in different parts of the engine
      var skyboxLookFactor = gameState.fLooktimer / gameState.nLookLimit;
      var renderLookFactor = gameState.fLooktimer * 0.15;
      
      // Format the values with precision and display them
      debugDiv.innerHTML = 
        'lookFactor values:<br>' +
        '- Raw: ' + gameState.fLooktimer.toFixed(2) + '<br>' +
        '- Skybox: ' + skyboxLookFactor.toFixed(4) + '<br>' +
        '- Render: ' + renderLookFactor.toFixed(4);
    }
  };
  
  /**
   * Start the game loop
   */
  var startGame = function() {
    // Initialize compass on game start
    GameRenderer.updateCompass(gameState);

    // Start the main game loop
    gameState.gameRun = setInterval(gameLoop, 33);
  };
  
  /**
   * Initialize settings panel values
   */
  var initSettingsPanel = function() {
    // Make sure our settings UI elements are available
    var mpStatusDisplay = document.getElementById('mp-status-display');
    var mpPlayerCount = document.getElementById('mp-player-count');

    if (mpStatusDisplay) {
      if (gameState.bMultiplayerEnabled) {
        mpStatusDisplay.textContent = 'Connecting...';
        mpStatusDisplay.style.color = '#ffcc00';
      } else {
        mpStatusDisplay.textContent = 'Disabled';
        mpStatusDisplay.style.color = '#888888';
      }
    }

    if (mpPlayerCount) {
      mpPlayerCount.textContent = '1'; // Just the local player initially
    }
  };

  /**
   * Initialize the game engine
   */
  var init = function() {
    // Get player name from localStorage
    gameState.playerName = localStorage.getItem('playerName') || 'Player';
    gameState.mainMenuActive = false;
    // Get DOM elements
    gameState.eScreen = document.getElementById("display");
    gameState.eScreen2 = document.getElementById("seconddisplay");
    // Debug output is now handled through the settings panel
    gameState.eDebugOut = null;
    var eTouchLook = document.getElementById("touchinputlook");
    var eTouchMove = document.getElementById("touchinputmove");

    // Initialize settings panel
    initSettingsPanel();
    
    // Add player name to settings panel
    var settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
      var gameInfoSection = settingsPanel.querySelector('.settings-section:nth-child(3)');
      if (gameInfoSection) {
        var playerNameRow = document.createElement('div');
        playerNameRow.className = 'settings-row';
        playerNameRow.innerHTML = '<span>Player Name:</span><span id="player-name-display">' + gameState.playerName + '</span>';
        
        // Insert before the last row
        var lastRow = gameInfoSection.querySelector('.settings-row:last-child');
        gameInfoSection.insertBefore(playerNameRow, lastRow);
      }
    }

    // Pass game state to all modules
    GameRenderer.setGameState(gameState);
    GameEntities.setGameState(gameState);
    GameInput.setGameState(gameState);
    GameAssets.setGameState(gameState);
    GameMultiplayer.setGameState(gameState);

    // Initialize input handlers
    GameInput.initAllInputs(gameState, {
      touchinputlook: eTouchLook,
      touchinputmove: eTouchMove
    });

    // Make the game state available to functions that need it
    gameState.startGame = startGame;

    // Initial game load
    GameAssets.loadLevel("levelfile1.map", gameState, function() {
      // Track the level name without extension
      gameState.sLevelstring = "levelfile1";

      // Start the game once level is loaded
      testScreenSizeAndStartTheGame();

      // If multiplayer is enabled, connect to the server
      if (gameState.bMultiplayerEnabled) {
        try {
          GameMultiplayer.connect();
          gameState.bMultiplayerConnected = true;
        } catch (e) {
          console.error("Failed to connect to multiplayer server:", e);
          // Update status in settings panel
          var mpStatusDisplay = document.getElementById('mp-status-display');
          if (mpStatusDisplay) {
            mpStatusDisplay.textContent = "Connection Failed";
            mpStatusDisplay.style.color = "#ff0000";
          }
          gameState.bMultiplayerConnected = false;
        }
      }

      // Add resize handler with debounce to prevent performance issues during resize
      var resizeTimeout;
      window.addEventListener("resize", function() {
        // Clear existing timeout and game loop
        if (resizeTimeout) clearTimeout(resizeTimeout);

        // Set a timeout to avoid recalculating dimensions too frequently during resize
        resizeTimeout = setTimeout(function() {
          clearInterval(gameState.gameRun);
          testScreenSizeAndStartTheGame();
        }, 250); // Wait 250ms after resize ends before recalculating
      });
    });
  };
  
  // Public API
  return {
    init: init
  };
})();