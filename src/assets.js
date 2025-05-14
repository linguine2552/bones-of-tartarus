/**
 * Assets.js - Asset management for the TARTARUS game engine
 * 
 * Handles loading levels, textures, and sprites
 */

var GameAssets = (function() {
  // Current level string
  var sLevelstring = "";

  // Store a reference to the game state
  var gameState;

  /**
   * Set reference to the game state
   */
  var setGameState = function(state) {
    gameState = state;
  };

  /**
   * Function will get the pixel to be sampled from the sprite or texture
   *
   * @param  {array} texture -     The texture to be sampled
   * @param  {float} x -           The x coordinate of the sample (how much across)
   * @param  {float} y -           The y coordinate of the sample
   * @return {string}              The character/pixel at the sample point
   */
  var getSamplePixel = function(texture, x, y) {
    // Check if texture is valid
    if (!texture || typeof texture !== 'object') {
      console.warn("Invalid texture passed to getSamplePixel");
      return "."; // Return a default empty character
    }

    // Default texture properties - if these aren't defined in the textures.tex file
    var defaultTexWidth = 16;
    var defaultTexHeight = 16;
    var defaultTexScale = 2;

    var scaleFactor = (texture["scale"] !== undefined) ? texture["scale"] : defaultTexScale;
    var texWidth = (texture["width"] !== undefined) ? texture["width"] : defaultTexWidth;
    var texHeight = (texture["height"] !== undefined) ? texture["height"] : defaultTexHeight;

    var texpixels = texture["texture"];

    // If texture data is missing, return a default character
    if (!texpixels) {
      // Try to get texture from a subfield if this might be a container
      if (texture["N"]) {
        texpixels = texture["N"];
      } else if (texture["F"]) {
        texpixels = texture["F"];
      } else {
        console.warn("Missing texture data in getSamplePixel");
        return "*"; // Return fallback character
      }
    }

    if (texture["texture"] === "DIRECTIONAL") {
      // Different Texture based on viewport
      if (gameState && gameState.nDegrees > 0 && gameState.nDegrees < 180) {
        texpixels = texture["S"];
      } else {
        texpixels = texture["N"];
      }
    }

    scaleFactor = scaleFactor || 2;

    x = scaleFactor * x % 1;
    y = scaleFactor * y % 1;

    var sampleX = ~~(texWidth * x);
    var sampleY = ~~(texHeight * y);

    // Ensure sampleX and sampleY are within bounds
    sampleX = Math.max(0, Math.min(texWidth - 1, sampleX));
    sampleY = Math.max(0, Math.min(texHeight - 1, sampleY));

    var samplePosition = (texWidth * (sampleY)) + sampleX;

    // Final validation: ensure we can access the character at this position
    if (!texpixels || typeof texpixels !== 'string' || samplePosition >= texpixels.length) {
      return "#"; // Return fallback character for bounds errors
    }

    if (x < 0 || x > texWidth || y < 0 || y > texHeight) {
      return "+";
    } else {
      return texpixels[samplePosition];
    }
  };

  /**
   * Generates coordinates for random sprite placement
   * Ensures coordinates are in valid positions (not in walls)
   */
  var generateRandomCoordinates = function(map, nMapWidth, nMapHeight) {
    var x = +(GameUtils.randomIntFromInterval(0, nMapWidth)) + 0;
    var y = +(GameUtils.randomIntFromInterval(0, nMapHeight)) - 0;

    while (map[~~(y) * nMapWidth + ~~(x)] != ".") {
      x = +(GameUtils.randomIntFromInterval(0, nMapWidth)) + 1;
      y = +(GameUtils.randomIntFromInterval(0, nMapHeight)) - 1;
    }

    var oCoordinates = {
      "x": x,
      "y": y
    };

    return oCoordinates;
  };

  /**
   * Generates random sprites for level population
   */
  var generateRandomSprites = function(map, nMapWidth, nMapHeight, nNumberOfSprites) {
    nNumberOfSprites = nNumberOfSprites || Math.round(nMapWidth * nMapWidth / 15);
    
    // Generates random Pogels or Obetrls
    var oRandomLevelSprites = {};
    for (var m = 0; m < nNumberOfSprites; m++) {
      var randAngle = GameUtils.randomIntFromInterval(0, GameUtils.PIx2);
      var nSpriteRand = GameUtils.randomIntFromInterval(0, 3);
      var randomCoordinates = generateRandomCoordinates(map, nMapWidth, nMapHeight);
      var oRandomSprite = {
        "x": randomCoordinates.x,
        "y": randomCoordinates.y,
        "r": randAngle,
        "name": (nSpriteRand === 1) ? "O" : "P",
        "move": true,
        "speed": GameUtils.randomIntFromInterval(0, 5) * 0.01,
        "stuckcounter": 0,
      }
      oRandomLevelSprites[m] = oRandomSprite;
    }
    return oRandomLevelSprites;
  };

  /**
   * Loads a level file
   * @param {string} level The level file name
   * @param {function} callback Function to call when level is loaded
   */
  var loadLevel = function(level, gameState, callback) {
    if (gameState.gameRun) {
      clearInterval(gameState.gameRun);
    }

    sLevelstring = level.replace(".map", ""); // sets global string
    gameState.sLevelstring = sLevelstring; // Save current level name to game state for multiplayer

    var loadScriptAsync = function(uri, sLevelstring) {
      return new Promise(function(resolve, reject) {
        var tag = document.createElement("script");
        tag.src = "assets/" + uri;
        tag.id = sLevelstring;
        tag.async = true;

        tag.onload = function() {
          resolve();
        };

        document.getElementById("map").src = "assets/" + level;
        var firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      });
    };

    var levelLoaded = loadScriptAsync(level, sLevelstring);

    levelLoaded.then(function() {
      // updates the level map and dimensions
      gameState.map = window[sLevelstring].map;
      gameState.nMapHeight = window[sLevelstring].nMapHeight;
      gameState.nMapWidth = window[sLevelstring].nMapWidth;

      // places the player at the map starting point
      gameState.fPlayerX = window[sLevelstring].fPlayerX;
      gameState.fPlayerY = window[sLevelstring].fPlayerY;
      gameState.fPlayerA = window[sLevelstring].fPlayerA;

      // If multiplayer is enabled, first notify the server of level change
      // This is done before loading local NPCs so that we can receive server NPCs
      if (gameState.bMultiplayerEnabled && gameState.bMultiplayerConnected &&
          typeof GameMultiplayer !== 'undefined' && GameMultiplayer.sendLevelChange) {
        console.log("Notifying server of level change to: " + level);
        GameMultiplayer.sendLevelChange(level);

        // We'll wait a short time for the server to respond with NPCs
        // Local NPCs will be loaded only if server doesn't respond in time
        setTimeout(function() {
          // If we haven't received server NPCs yet, load local ones
          if (!GameMultiplayer.hasServerNPCs || !GameMultiplayer.hasServerNPCs()) {
            console.log("Loading local NPCs (no server NPCs received)");
            loadLocalNPCs();
          } else {
            console.log("Using server-synchronized NPCs");
          }

          // Execute callback if provided
          if (typeof callback === 'function') {
            callback(gameState);
          }
        }, 500); // Wait 500ms for server response before falling back to local NPCs
      } else {
        // In single-player mode, immediately load local NPCs
        loadLocalNPCs();

        // Execute callback if provided
        if (typeof callback === 'function') {
          callback(gameState);
        }
      }

      document.querySelector("body").style.color = window[sLevelstring].color;
      document.querySelector("body").style.background = window[sLevelstring].background;
    });

    // Helper function to load local NPC sprites from level file
    function loadLocalNPCs() {
      // load sprites from level file
      gameState.oLevelSprites = window[sLevelstring].sprites;

      if (gameState.oLevelSprites == "autogen") {
        gameState.oLevelSprites = generateRandomSprites(
          gameState.map,
          gameState.nMapWidth,
          gameState.nMapHeight
        );
      }
    }
  };

  // Public API
  return {
    getSamplePixel: getSamplePixel,
    generateRandomCoordinates: generateRandomCoordinates,
    generateRandomSprites: generateRandomSprites,
    loadLevel: loadLevel,
    setGameState: setGameState
  };
})();