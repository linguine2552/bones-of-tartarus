/**
 * Input.js - Input handling for the TARTARUS game engine
 * 
 * Manages keyboard, mouse, and touch controls
 */

var GameInput = (function() {
  // Store a reference to the game state
  var gameState;

  /**
   * Set reference to the game state
   */
  var setGameState = function(state) {
    gameState = state;
  };

  // Touch tracking objects
  var oTouch = {
    move: {
      x: 0,
      y: 0,
      bFirstTouch: true,
    },
    look: {
      x: 0,
      y: 0,
      bFirstTouch: true,
    },
  };

  /**
   * Initialize keyboard controls
   */
  var initKeyboard = function(gameState) {
    window.onkeydown = function(e) {
      // Toggle pause with P key
      if (e.which == 80) { // p
        if (gameState.bPaused) {
          if (typeof gameState.startGame === 'function') {
            gameState.startGame();
          }
          gameState.bPaused = false;
        } else {
          clearInterval(gameState.gameRun);
          gameState.bPaused = true;
        }
      }

      // Toggle settings panel with backtick key (code 192)
      if (e.which == 192) { // backtick/tilde key
        var settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) {
          // Toggle the display
          if (settingsPanel.style.display === 'block') {
            settingsPanel.style.display = 'none';
            // Re-enable mouse look if it was active
            if (document.pointerLockElement) {
              document.body.classList.add('nomouse');
            }
          } else {
            settingsPanel.style.display = 'block';
            // Update current values in settings panel
            updateSettingsPanel(gameState);
            // Release pointer lock when settings is open
            if (document.pointerLockElement) {
              document.exitPointerLock();
              document.body.classList.remove('nomouse');
            }
          }
        }
      }

      // Movement controls
      if (e.which == 65) { // a
        gameState.bStrafeLeft = true;
      }
      if (e.which == 68) { // d
        gameState.bStrafeRight = true;
      }
      if (e.which == 81 || e.which == 37) { // q or left
        gameState.bTurnLeft = true;
      }
      if (e.which == 69 || e.which == 39) { // e or right
        gameState.bTurnRight = true;
      }
      if (e.which == 87) { // w
        gameState.bMoveForward = true;
      }
      if (e.which == 83) { // s
        gameState.bMoveBackward = true;
      }
      if (e.which == 38) { // up arrow
        gameState.bTurnUp = true;
      }
      if (e.which == 40) { // down arrow
        gameState.bTurnDown = true;
      }
    };

    window.onkeyup = function(e) {
      // Sprint functionality removed
      
      // Jump functionality removed
      
      if (e.which == 65) { // a
        gameState.bStrafeLeft = false;
      }
      if (e.which == 68) { // d
        gameState.bStrafeRight = false;
      }
      if (e.which == 81 || e.which == 37) { // q or left
        gameState.bTurnLeft = false;
      }
      if (e.which == 69 || e.which == 39) { // e or right
        gameState.bTurnRight = false;
      }
      if (e.which == 87) { // w
        gameState.bMoveForward = false;
      }
      if (e.which == 83) { // s
        gameState.bMoveBackward = false;
      }
      if (e.which == 38) { // up arrow
        gameState.bTurnUp = false;
      }
      if (e.which == 40) { // down arrow
        gameState.bTurnDown = false;
      }
    };
  };

  /**
   * Initialize mouse controls
   */
  var initMouse = function(gameState, touchinputlook, touchinputmove) {
    // Enable mouse for look controls
    var enableMouseLook = function() {
      document.body.requestPointerLock();
      document.onmousemove = function(e) {
        // Only track mouse movement if we have pointer lock (game is focused)
        if (document.pointerLockElement) {
          // look left/right
          gameState.fPlayerA += ((e.movementX * 0.002) || (e.mozMovementX * 0.002) || (e.webkitMovementX * 0.002) || 0);

          // look up and down with consistent sensitivity 
          // Slightly reduced from 0.08 to 0.05 for smoother control
          updateLookY((e.movementY || e.mozMovementY || e.webkitMovementY || 0), 0.05);
        }
      };
    };

    // Set up click handlers
    touchinputlook.onclick = enableMouseLook;
    touchinputmove.onclick = enableMouseLook;
  };

  /**
   * Initialize touch controls
   */
  var initTouch = function(gameState, eTouchLook, eTouchMove) {
    // Look (left hand of screen)
    eTouchLook.addEventListener("touchmove", function(e) {
      // Fetches differences from input
      var oDifferences = calculateTouchDifference(oTouch.look, e);

      // Makes sure no crazy values
      if (oDifferences.x < 10 && oDifferences.x > -10) {
        oTouch.look.bFirstTouch = false;
      }

      if (!oTouch.look.bFirstTouch) {
        // Left and right
        gameState.fPlayerA += oDifferences.x * 0.005;

        // Up and down with consistent sensitivity 
        // Slightly reduced from 0.15 to 0.1 for smoother control
        updateLookY(oDifferences.y, 0.1);
      }
    });

    // Reset look on touch end
    eTouchLook.addEventListener("touchend", function() {
      oTouch.look.x = 0;
      oTouch.look.y = 0;
      oTouch.look.bFirstTouch = true;
    });

    // Move (right hand of screen)
    eTouchMove.addEventListener("touchmove", function(e) {
      var oDifferences = calculateTouchDifference(oTouch.move, e);

      // Makes sure no crazy values
      if (oDifferences.x < 10 && oDifferences.x > -10) {
        oTouch.move.bFirstTouch = false;
      }

      // First touch will be a huge difference, that's why we only move after the first touch
      if (!oTouch.move.bFirstTouch) {
        // Walk
        gameState.fPlayerX -= (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * oDifferences.x * 0.05;
        gameState.fPlayerY += (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * oDifferences.x * 0.05;

        // Converts coordinates into integer space and check if it is a wall (!.), if so, reverse
        if (gameState.map[~~(gameState.fPlayerY) * gameState.nMapWidth + ~~(gameState.fPlayerX)] != ".") {
          checkExit(gameState);
          gameState.fPlayerX += (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * oDifferences.x * 0.05;
          gameState.fPlayerY -= (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * oDifferences.x * 0.05;
        }

        // Strafe
        gameState.fPlayerX += (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * -oDifferences.y * 0.05;
        gameState.fPlayerY += (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * -oDifferences.y * 0.05;

        // Converts coordinates into integer space and check if it is a wall (!.), if so, reverse
        if (gameState.map[~~(gameState.fPlayerY) * gameState.nMapWidth + ~~(gameState.fPlayerX)] != ".") {
          checkExit(gameState);
          gameState.fPlayerX -= (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * -oDifferences.y * 0.05;
          gameState.fPlayerY -= (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * -oDifferences.y * 0.05;
        }
      }
    });

    // Reset move on touch end
    eTouchMove.addEventListener("touchend", function() {
      oTouch.move.x = 0;
      oTouch.move.y = 0;
      oTouch.move.bFirstTouch = true;
    });
  };

  /**
   * Calculates the difference between touch events
   */
  var calculateTouchDifference = function(prev, e) {
    var oDifference = {};

    // Fetch and compare touch-points
    // Always [0] because no multitouch
    var fInputX = e.changedTouches[0].clientX;
    var fInputY = e.changedTouches[0].clientY;

    var differenceX = fInputX - prev.x;
    var differenceY = fInputY - prev.y;

    prev.x = fInputX;
    prev.y = fInputY;

    oDifference = {
      x: differenceX,
      y: differenceY,
    };

    return oDifference;
  };

  /**
   * Updates the look Y-axis (up/down)
   */
  var updateLookY = function(fMoveInput, fMoveFactor) {
    // Get gameState from parent scope in initMouse and initTouch functions
    // Look up/down (with bounds)

    // Base movement amount
    var fYMoveBy = fMoveInput * fMoveFactor;

    // Apply consistent sensitivity compensation regardless of look direction
    // This ensures mouse movement feels identical whether looking up or down
    
    // First, apply a consistent base sensitivity reduction for all mouse movement
    var baseSensitivityFactor = 0.8;
    fYMoveBy *= baseSensitivityFactor;
    
    if (gameState.fLooktimer < 0) {
      // Looking down - apply very gradual sensitivity increase as you look further down
      // to compensate for the visual skew in the renderer
      var downPercentage = Math.min(1.0, Math.abs(gameState.fLooktimer) / gameState.nLookLimit);
      
      // Much gentler progression with a smaller maximum boost
      var boostFactor = 1.0 + (downPercentage * downPercentage * 0.5); // Up to 1.5x boost at extreme angles
      
      // Apply the boost
      fYMoveBy *= boostFactor;
    } else if (gameState.fLooktimer > 0) {
      // Looking up - apply the same pattern of sensitivity adjustment as looking down
      // to ensure symmetrical feeling
      var upPercentage = Math.min(1.0, gameState.fLooktimer / gameState.nLookLimit);
      
      // Rather than dampening, we now provide a very gentle boost matching the down direction
      var boostFactor = 1.0 + (upPercentage * upPercentage * (-1.2)); // Up to 1.5x boost at extreme angles
      
      // Apply the same boost
      fYMoveBy *= boostFactor;
    }

    // Apply the look change
    gameState.fLooktimer -= fYMoveBy;

    // Set symmetric upper and lower limits
    var upperLimit = gameState.nLookLimit;
    var lowerLimit = -gameState.nLookLimit;

    // For larger screens, slightly adjust the limits but maintain symmetry
    if (gameState.nScreenWidth > 500) {
      upperLimit = gameState.nLookLimit * 0.9;
      lowerLimit = -gameState.nLookLimit * 0.9;
    }

    // Apply bounds
    if (gameState.fLooktimer > upperLimit || gameState.fLooktimer < lowerLimit) {
      gameState.fLooktimer += fYMoveBy; // Undo the change if we hit the limits
    }
  };

  /**
   * Check if player is at an exit
   */
  var checkExit = function(gameState) {
    // If we hit an exit
    if (gameState.map[~~(gameState.fPlayerY) * gameState.nMapWidth + ~~(gameState.fPlayerX)] == "X") {
      GameAssets.loadLevel(window[gameState.sLevelstring].exitsto, gameState);
    }
  };

  /**
   * Handle player movement based on input state
   */
  var updateMovement = function(gameState) {
    if (gameState.bTurnLeft) {
      gameState.fPlayerA -= 0.05;
    }

    if (gameState.bTurnRight) {
      gameState.fPlayerA += 0.05;
    }

    // Handle up/down look using arrow keys
    if (gameState.bTurnUp) {
      // Look up by decreasing the look timer
      updateLookY(-12, 0.08);
    }

    if (gameState.bTurnDown) {
      // Look down by increasing the look timer
      updateLookY(24, 0.08);
    }

    // Fixed move factor (sprint removed)
    var fMoveFactor = 0.1;

    if (gameState.bStrafeLeft) {
      gameState.fPlayerX += (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
      gameState.fPlayerY -= (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;

      // Converts coordinates into integer space and check if it is a wall (!.), if so, reverse
      if (gameState.map[~~(gameState.fPlayerY) * gameState.nMapWidth + ~~(gameState.fPlayerX)] != ".") {
        checkExit(gameState);
        gameState.fPlayerX -= (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
        gameState.fPlayerY += (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
      }
    }

    if (gameState.bStrafeRight) {
      gameState.fPlayerX -= (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
      gameState.fPlayerY += (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;

      // Converts coordinates into integer space and check if it is a wall (!.), if so, reverse
      if (gameState.map[~~(gameState.fPlayerY) * gameState.nMapWidth + ~~(gameState.fPlayerX)] != ".") {
        checkExit(gameState);
        gameState.fPlayerX += (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
        gameState.fPlayerY -= (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
      }
    }

    if (gameState.bMoveForward && gameState.bPlayerMayMoveForward) {
      gameState.fPlayerX += (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
      gameState.fPlayerY += (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;

      // Converts coordinates into integer space and check if it is a wall (!.), if so, reverse
      if (gameState.map[~~(gameState.fPlayerY) * gameState.nMapWidth + ~~(gameState.fPlayerX)] != ".") {
        checkExit(gameState);
        gameState.fPlayerX -= (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
        gameState.fPlayerY -= (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
      }
    }

    if (gameState.bMoveBackward) {
      gameState.fPlayerX -= (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
      gameState.fPlayerY -= (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;

      // Converts coordinates into integer space and check if it is a wall (!.), if so, reverse
      if (gameState.map[~~(gameState.fPlayerY) * gameState.nMapWidth + ~~(gameState.fPlayerX)] != ".") {
        checkExit(gameState);
        gameState.fPlayerX += (Math.cos(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
        gameState.fPlayerY += (Math.sin(gameState.fPlayerA) + 5.0 * 0.0051) * fMoveFactor;
      }
    }
  };

  /**
   * Update the settings panel with current game state
   */
  var updateSettingsPanel = function(gameState) {
    // Update multiplayer status
    var mpStatusDisplay = document.getElementById('mp-status-display');
    if (mpStatusDisplay) {
      if (gameState.bMultiplayerEnabled) {
        if (gameState.bMultiplayerConnected) {
          mpStatusDisplay.textContent = 'Connected';
          mpStatusDisplay.style.color = '#00ff00';
        } else {
          mpStatusDisplay.textContent = 'Connecting...';
          mpStatusDisplay.style.color = '#ffcc00';
        }
      } else {
        mpStatusDisplay.textContent = 'Disabled';
        mpStatusDisplay.style.color = '#888888';
      }
    }

    // Update player count if multiplayer module has a function to get other players
    var mpPlayerCount = document.getElementById('mp-player-count');
    if (mpPlayerCount && GameMultiplayer.otherPlayers) {
      var playerCount = Object.keys(GameMultiplayer.otherPlayers).length + 1; // +1 for local player
      mpPlayerCount.textContent = playerCount;
    }

    // Update position display
    var positionDisplay = document.getElementById('position-display');
    if (positionDisplay) {
      positionDisplay.textContent = 'X: ' + gameState.fPlayerX.toFixed(2) + ' Y: ' + gameState.fPlayerY.toFixed(2);
    }

    // Update FPS display (calculate in the game loop and store in gameState)
    var fpsDisplay = document.getElementById('fps-display');
    if (fpsDisplay && typeof gameState.currentFPS !== 'undefined') {
      fpsDisplay.textContent = gameState.currentFPS;
    }
    
    // Update spawner information if available
    if (typeof GameMultiplayer !== 'undefined' && 
        typeof GameMultiplayer.updateSettingsPanel === 'function') {
      GameMultiplayer.updateSettingsPanel();
    }
  };

  /**
   * Initialize all input handlers
   */
  var initAllInputs = function(gameState, elements) {
    initKeyboard(gameState);
    initMouse(gameState, elements.touchinputlook, elements.touchinputmove);
    initTouch(gameState, elements.touchinputlook, elements.touchinputmove);

    // Initialize settings panel button handlers
    initSettingsPanelControls(gameState);
  };

  /**
   * Initialize settings panel controls
   */
  var initSettingsPanelControls = function(gameState) {
    // Make sure the settings panel is hidden by default
    var settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
      settingsPanel.style.display = 'none';
    }

    // Render mode buttons
    document.getElementById('settings-solid').addEventListener('click', function() {
      gameState.nRenderMode = 0;
    });

    document.getElementById('settings-texture').addEventListener('click', function() {
      gameState.nRenderMode = 1;
    });

    document.getElementById('settings-shader').addEventListener('click', function() {
      gameState.nRenderMode = 2;
    });

    // Multiplayer toggle button
    document.getElementById('mp-toggle').addEventListener('click', function() {
      gameState.bMultiplayerEnabled = !gameState.bMultiplayerEnabled;

      if (gameState.bMultiplayerEnabled) {
        // Try to connect to server
        try {
          GameMultiplayer.connect();
        } catch (e) {
          console.error("Failed to connect to multiplayer server:", e);
        }
      } else {
        // Disable multiplayer (connection will be handled on next update)
        gameState.bMultiplayerConnected = false;
      }

      // Update the settings panel
      updateSettingsPanel(gameState);
    });
  };

  // Public API
  return {
    initAllInputs: initAllInputs,
    updateMovement: updateMovement,
    checkExit: checkExit,
    setGameState: setGameState,
    updateSettingsPanel: updateSettingsPanel
  };
})();