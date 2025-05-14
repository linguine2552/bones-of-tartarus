/**
 * Entities.js - Entity and sprite management for the TARTARUS game engine
 * 
 * Handles sprite movement, sorting, and interactions
 */

var GameEntities = (function() {
  // Store a reference to the game state
  var gameState;

  /**
   * Set reference to the game state
   */
  var setGameState = function(state) {
    gameState = state;
  };

  /**
   * Sorts sprite list by distance
   */
  function sortSpriteList(b, a) {
    if (a["z"] < b["z"]) {
      return -1;
    }
    if (a["z"] > b["z"]) {
      return 1;
    }
    return 0;
  }

  /**
   * Sorts the sprite list based on distance from the player
   */
  var updateSpriteBuffer = function(gameState) {
    // Calculates the distance to the player
    for (var si = 0; si < Object.keys(gameState.oLevelSprites).length; si++) {
      var sprite = gameState.oLevelSprites[Object.keys(gameState.oLevelSprites)[si]];

      // The distance between the sprite and the player
      var fDistance = Math.hypot(sprite["x"] - gameState.fPlayerX, sprite["y"] - gameState.fPlayerY);

      sprite["z"] = fDistance;
    }

    // Converts array of objects to list
    var newList = [];
    for (var sj = 0; sj < Object.keys(gameState.oLevelSprites).length; sj++) {
      newList.push(gameState.oLevelSprites[Object.keys(gameState.oLevelSprites)[sj]]);
    }

    // Sorts the list
    newList = newList.sort(sortSpriteList);

    // Make object from array again
    gameState.oLevelSprites = {};
    for (var sk = 0; sk < Object.keys(newList).length; sk++) {
      gameState.oLevelSprites[sk] = newList[sk];
    }
  };

  /**
   * Update sprite positions and handle collisions
   */
  var moveSprites = function(gameState) {
    // For each sprite object
    for (var si = 0; si < Object.keys(gameState.oLevelSprites).length; si++) {
      var sprite = gameState.oLevelSprites[Object.keys(gameState.oLevelSprites)[si]];

      // Skip if sprite is invalid or doesn't have required properties
      if (!sprite || typeof sprite.x === 'undefined' || typeof sprite.y === 'undefined') {
        continue;
      }

      // Skip if the sprite type isn't valid
      if (sprite.name && !window.allSprites[sprite.name]) {
        console.warn("Invalid sprite type in moveSprites: " + sprite.name);
        continue;
      }

      // If the sprite's move flag is set
      if (sprite["move"]) {
        var fMovementSpeed = sprite["speed"] || 0.03;

        // Move the sprite along its radiant line
        sprite["x"] = +(sprite["x"]) + +(Math.cos(sprite["r"])) * fMovementSpeed;
        sprite["y"] = +(sprite["y"]) + +(Math.sin(sprite["r"])) * fMovementSpeed;

        // Improved collision detection with multiple check points
        // Calculate radius for collision (larger distance from center)
        var collisionRadius = 0.85; // Increased from implicit ~0.65

        // Check multiple points around the sprite for collision
        var collisionPoints = [
          { x: sprite["x"] + collisionRadius * Math.cos(sprite["r"]), y: sprite["y"] + collisionRadius * Math.sin(sprite["r"]) },             // Front
          { x: sprite["x"] + collisionRadius * Math.cos(sprite["r"] + Math.PI/4), y: sprite["y"] + collisionRadius * Math.sin(sprite["r"] + Math.PI/4) },   // Front-right
          { x: sprite["x"] + collisionRadius * Math.cos(sprite["r"] - Math.PI/4), y: sprite["y"] + collisionRadius * Math.sin(sprite["r"] - Math.PI/4) }    // Front-left
        ];

        // Check if any collision point is in a wall
        var collision = false;
        for (var i = 0; i < collisionPoints.length; i++) {
          // Make sure we're within map bounds
          var x = ~~(collisionPoints[i].x);
          var y = ~~(collisionPoints[i].y);

          if (x < 0 || x >= gameState.nMapWidth || y < 0 || y >= gameState.nMapHeight) {
            collision = true;
            break;
          }

          if (gameState.map[y * gameState.nMapWidth + x] != ".") {
            collision = true;
            break;
          }
        }

        if (collision) {
          sprite["stuckcounter"] = sprite["stuckcounter"] || 0;
          sprite["stuckcounter"]++;

          // Reverse last movement with stronger pushback
          sprite["x"] = +(sprite["x"]) - +(Math.cos(sprite["r"])) * fMovementSpeed * 3;
          sprite["y"] = +(sprite["y"]) - +(Math.sin(sprite["r"])) * fMovementSpeed * 3;

          // Change the angle and visible angle
          sprite["r"] = (+(sprite["r"]) + GameUtils.PIx1_5) % GameUtils.PIx2;

          // If sprite keeps getting stuck, shove it out of there
          if (sprite["stuckcounter"] > 10) {
            sprite["stuckcounter"] = 0;
            sprite["r"] = 0.5;
            sprite["x"] = +(sprite["x"]) - +(Math.cos(sprite["r"])) * 0.5;
            sprite["y"] = +(sprite["y"]) - +(Math.sin(sprite["r"])) * 0.5;
          }
        }

        // If sprite is close to the player, and facing the player, turn around
        if (sprite["z"] < 1.2 && sprite["a"] !== "B") {
          sprite["r"] = (+(sprite["r"]) + GameUtils.PIx1_5) % GameUtils.PIx2;
        }
      }

      // Recalculate distance after sprite movement
      var fDistance = Math.hypot(sprite["x"] - gameState.fPlayerX, sprite["y"] - gameState.fPlayerY);
      sprite["z"] = fDistance;

      // Handle collision between player and any sprite (moving or static)
      // This applies to both NPC sprites and multiplayer player sprites
      if (fDistance < 0.4) {
        gameState.bPlayerMayMoveForward = false;

        // Add a small push effect to prevent getting stuck in sprites
        var pushDirection = Math.atan2(
          gameState.fPlayerY - sprite["y"],
          gameState.fPlayerX - sprite["x"]
        );

        // Apply a small push to the player away from the sprite
        var pushFactor = 0.02;
        gameState.fPlayerX += Math.cos(pushDirection) * pushFactor;
        gameState.fPlayerY += Math.sin(pushDirection) * pushFactor;

        // For debugging
        console.log("Collision with sprite in moveSprites: distance=" + fDistance.toFixed(2) + ", type=" + sprite.name);
      } else {
        // Only enable forward movement if no sprite is blocking
        if (gameState.bPlayerMayMoveForward === false) {
          gameState.bPlayerMayMoveForward = true;
        }
      }
    }
  };

  /**
   * Render player names above sprites
   * (disabled as requested)
   */
  var renderPlayerName = function(gameState, screen, sprite, fMiddleOfSprite, fSpriteCeiling) {
    // Function disabled - player names no longer rendered
    return;
  };
  
  /**
   * Render sprites onto the screen
   */
  var renderSprites = function(gameState, screen) {
    for (var si = 0; si < Object.keys(gameState.oLevelSprites).length; si++) {
      // The sprite in the level-side
      var sprite = gameState.oLevelSprites[Object.keys(gameState.oLevelSprites)[si]];

      // Reference to the global-side sprite
      var currentSpriteObject = window.allSprites[sprite["name"]];

      // Skip if sprite type is invalid or not found in allSprites
      if (!currentSpriteObject) {
        console.warn("Invalid sprite type: " + sprite["name"]);
        continue;
      }

      // Can object be seen?
      var fVecX = sprite["x"] - gameState.fPlayerX;
      var fVecY = sprite["y"] - gameState.fPlayerY;
      var fDistanceFromPlayer = Math.sqrt(fVecX * fVecX + fVecY * fVecY);

      // Calculate angle between sprite and player, to see if in fov
      var fEyeX = Math.cos(gameState.fPlayerA);
      var fEyeY = Math.sin(gameState.fPlayerA);

      var fSpriteAngle = Math.atan2(fVecY, fVecX) - Math.atan2(fEyeY, fEyeX);
      if (fSpriteAngle < -GameUtils.PI) {
        fSpriteAngle += GameUtils.PIx2;
      }
      if (fSpriteAngle > GameUtils.PI) {
        fSpriteAngle -= GameUtils.PIx2;
      }

      var bInPlayerView = Math.abs(fSpriteAngle) < gameState.fFOV / 2;

      // Only proceed if sprite is visible and in the player's view
      // Lower minimum distance to 0.1 to prevent sprites from disappearing during collisions
      if (bInPlayerView && fDistanceFromPlayer >= 0.1) {
        // Use the same lookFactor calculation as the walls for consistency
        var lookFactor = gameState.fLooktimer * 0.15;
        
        // Apply headbob effect with standard reduction when looking up
        var headbobFactor = gameState.nHeadbobTimer * 0.05;
        if (lookFactor > 0) {
          // Progressively reduce headbob effect as lookFactor increases
          headbobFactor *= Math.max(0, 1 - lookFactor * 1.5);
        }
        
        // Use the standard adjustedBaseDenom calculation
        var adjustedBaseDenom = (2 - headbobFactor) - lookFactor;

        // For sprites, we need to maintain a consistent position regardless of look direction
        
        // Calculate floor position using standard method from renderer.js
        var fSpriteFloor = +(gameState.nScreenHeight / adjustedBaseDenom) +
                          gameState.nScreenHeight / (+(fDistanceFromPlayer));
        
        // Calculate ceiling position based on sprite height factor
        var fSpriteCeiling = +(gameState.nScreenHeight / adjustedBaseDenom) -
                            gameState.nScreenHeight / (+(fDistanceFromPlayer)) * currentSpriteObject["hghtFctr"];
        
        // Define vertical shift configuration arrays for precise control
        // at different distance thresholds and look angles
        var verticalShiftConfig = {
            // Looking down configuration - format: [distance threshold, multiplier]
            lookingDown: [
                [1.0, -0.55],     // Very close sprites (0-1 units): moderate shift
                [3.0, -1.8],     // Close sprites (1-3 units): stronger shift
                [6.0, -2],    // Medium distance sprites (3-6 units): strong shift
                [10.0, -1.5],   // Far sprites (6-10 units): very strong shift
                [Infinity, 0.0] // Very far sprites (10+ units): maximum shift
            ],
            
            // Looking up configuration - format: [distance threshold, multiplier]
            lookingUp: [
                [2.0, 0],     // Close sprites (0-2 units): slight shift
                [5.0, -0.4],     // Medium sprites (2-5 units): moderate shift
                [9.0, -0.6],    // Far sprites (5-9 units): stronger shift
                [Infinity, -0.75] // Very far sprites (9+ units): maximum shift
            ]
        };
        
        // Apply vertical position adjustment based on look direction and distance
        if (gameState.fLooktimer < 0) {
            // Looking down case - need to push sprites up to compensate
            var lookDownAmount = Math.abs(gameState.fLooktimer);
            var downMultiplier = 0;
            
            // Find the appropriate multiplier based on distance
            if (fDistanceFromPlayer >= verticalShiftConfig.lookingDown[verticalShiftConfig.lookingDown.length-2][0]) {
                // Beyond the last threshold
                downMultiplier = verticalShiftConfig.lookingDown[verticalShiftConfig.lookingDown.length-1][1];
            } 
            else if (fDistanceFromPlayer <= verticalShiftConfig.lookingDown[0][0]) {
                // Below first threshold
                downMultiplier = verticalShiftConfig.lookingDown[0][1];
            }
            else {
                // Find which thresholds we're between and interpolate
                for (var t = 0; t < verticalShiftConfig.lookingDown.length-1; t++) {
                    if (fDistanceFromPlayer <= verticalShiftConfig.lookingDown[t+1][0]) {
                        var lowerThreshold = verticalShiftConfig.lookingDown[t];
                        var upperThreshold = verticalShiftConfig.lookingDown[t+1];
                        
                        var interpFactor = (fDistanceFromPlayer - lowerThreshold[0]) / 
                                          (upperThreshold[0] - lowerThreshold[0]);
                        
                        downMultiplier = lowerThreshold[1] + 
                                       interpFactor * (upperThreshold[1] - lowerThreshold[1]);
                        break;
                    }
                }
            }
            
            // Calculate and apply correction
            var correction = lookDownAmount * downMultiplier;
            fSpriteFloor += correction;
            fSpriteCeiling += correction;
        } 
        else if (gameState.fLooktimer > 0) {
            // Looking up case - need to apply a gentler correction
            var lookUpAmount = gameState.fLooktimer;
            var upMultiplier = 0;
            
            // Find the appropriate multiplier based on distance
            if (fDistanceFromPlayer >= verticalShiftConfig.lookingUp[verticalShiftConfig.lookingUp.length-2][0]) {
                // Beyond the last threshold
                upMultiplier = verticalShiftConfig.lookingUp[verticalShiftConfig.lookingUp.length-1][1];
            } 
            else if (fDistanceFromPlayer <= verticalShiftConfig.lookingUp[0][0]) {
                // Below first threshold
                upMultiplier = verticalShiftConfig.lookingUp[0][1];
            }
            else {
                // Find which thresholds we're between and interpolate
                for (var t = 0; t < verticalShiftConfig.lookingUp.length-1; t++) {
                    if (fDistanceFromPlayer <= verticalShiftConfig.lookingUp[t+1][0]) {
                        var lowerThreshold = verticalShiftConfig.lookingUp[t];
                        var upperThreshold = verticalShiftConfig.lookingUp[t+1];
                        
                        var interpFactor = (fDistanceFromPlayer - lowerThreshold[0]) / 
                                          (upperThreshold[0] - lowerThreshold[0]);
                        
                        upMultiplier = lowerThreshold[1] + 
                                     interpFactor * (upperThreshold[1] - lowerThreshold[1]);
                        break;
                    }
                }
            }
            
            // Calculate and apply correction
            var correction = lookUpAmount * upMultiplier;
            fSpriteFloor -= correction;
            fSpriteCeiling -= correction;
        }

        var fSpriteCeiling = Math.round(fSpriteCeiling);
        var fSpriteFloor = Math.round(fSpriteFloor);

        // We already calculated fSpriteHeight before, but we need to use the rounded values now
        var fSpriteHeight = fSpriteFloor - fSpriteCeiling;
        var fSpriteAspectRatio = +(currentSpriteObject["height"]) / +(currentSpriteObject["width"] * currentSpriteObject["aspctRt"]);
        var fSpriteWidth = fSpriteHeight / fSpriteAspectRatio;

        // Apply distance-based correction factor to account for perspective distortion
        var distanceCorrection = 1.0 + (fDistanceFromPlayer * 0.01);
        
        // Calculate the base middle position of the sprite
        var baseMiddlePosition = (0.5 * (fSpriteAngle / (gameState.fFOV / 2.0)) + 0.5) * +(gameState.nScreenWidth);
        
        // Add distance-based horizontal shift with variable intensity at different thresholds
        // This creates the perception that sprites shift right as the player moves away
        
        // Define horizontal shift configuration for precise control
        // Different thresholds for different viewing positions
        var horizontalShiftConfig = {
            // Standard view (not looking up/down significantly)
            // Format: [distance threshold, intensity multiplier]
            standard: [
                [1.0, 0.00],  // Very close sprites (0-1 units)
                [3.0, 0.01],   // Close sprites (1-3 units)
                [6.0, 0.005],   // Medium distance sprites (3-6 units)
                [9.0, 0.005],   // Far sprites (6-9 units)
                [14.0, 0.005],  // Very far sprites (9-14 units)
                [Infinity, 0.005] // Extreme distance sprites (14+ units)
            ],
            
            // Looking down configuration (reduces horizontal shift)
            lookingDown: [
                [1.0, 0.00],  // Very close sprites (0-1 units)
                [3.0, 0.01],   // Close sprites (1-3 units)
                [6.0, 0.005],   // Medium distance sprites (3-6 units)
                [9.0, 0.005],   // Far sprites (6-9 units)
                [14.0, 0.005],  // Very far sprites (9-14 units)
                [Infinity, 0.005] // Extreme distance sprites (14+ units)
            ],
            
            // Looking up configuration (enhances horizontal shift)
            lookingUp: [
                [1.0, 0.00],  // Very close sprites (0-1 units)
                [3.0, 0.01],   // Close sprites (1-3 units)
                [6.0, 0.005],   // Medium distance sprites (3-6 units)
                [9.0, 0.005],   // Far sprites (6-9 units)
                [14.0, 0.005],  // Very far sprites (9-14 units)
                [Infinity, 0.005] // Extreme distance sprites (14+ units)
            ]
        };
        
        // Determine which horizontal shift configuration to use based on look angle
        var thresholds;
        var lookUpDownThreshold = 0.15; // Threshold to consider looking up/down
        
        if (gameState.fLooktimer < -lookUpDownThreshold) {
            // Looking down
            thresholds = horizontalShiftConfig.lookingDown;
        } else if (gameState.fLooktimer > lookUpDownThreshold) {
            // Looking up
            thresholds = horizontalShiftConfig.lookingUp;
        } else {
            // Standard view
            thresholds = horizontalShiftConfig.standard;
        }
        
        // Find appropriate intensity with smooth interpolation between thresholds
        var appliedIntensity;
        
        // Handle case where distance is beyond the last threshold
        if (fDistanceFromPlayer >= thresholds[thresholds.length-2][0]) {
            appliedIntensity = thresholds[thresholds.length-1][1];
        } 
        // Handle case where distance is below first threshold
        else if (fDistanceFromPlayer <= thresholds[0][0]) {
            appliedIntensity = thresholds[0][1];
        }
        // Otherwise interpolate between thresholds
        else {
            // Find which thresholds we're between
            for (var t = 0; t < thresholds.length-1; t++) {
                if (fDistanceFromPlayer <= thresholds[t+1][0]) {
                    // Get the two threshold points
                    var lowerThreshold = thresholds[t];
                    var upperThreshold = thresholds[t+1];
                    
                    // Calculate how far we are between thresholds (0.0 to 1.0)
                    var interpolationFactor = (fDistanceFromPlayer - lowerThreshold[0]) / 
                                              (upperThreshold[0] - lowerThreshold[0]);
                    
                    // Interpolate between the two intensity values
                    appliedIntensity = lowerThreshold[1] + 
                                       interpolationFactor * (upperThreshold[1] - lowerThreshold[1]);
                    break;
                }
            }
        }
        
        // For extreme look angles, we can also blend between configurations
        // This creates smooth transitions between different thresholds
        if (gameState.fLooktimer < -lookUpDownThreshold * 2 || gameState.fLooktimer > lookUpDownThreshold * 2) {
            // No blending needed for extreme angles, we've already selected the right config
        } 
        // For transition zones, blend between standard and lookingUp/Down
        else if (gameState.fLooktimer < -lookUpDownThreshold) {
            // Transition from standard to lookingDown
            var blendFactor = (Math.abs(gameState.fLooktimer) - lookUpDownThreshold) / lookUpDownThreshold;
            
            // Find standard intensity using the same distance
            var standardIntensity = findIntensityForDistance(fDistanceFromPlayer, horizontalShiftConfig.standard);
            
            // Blend between the two intensities
            appliedIntensity = standardIntensity * (1-blendFactor) + appliedIntensity * blendFactor;
        }
        else if (gameState.fLooktimer > lookUpDownThreshold) {
            // Transition from standard to lookingUp
            var blendFactor = (gameState.fLooktimer - lookUpDownThreshold) / lookUpDownThreshold;
            
            // Find standard intensity using the same distance
            var standardIntensity = findIntensityForDistance(fDistanceFromPlayer, horizontalShiftConfig.standard);
            
            // Blend between the two intensities
            appliedIntensity = standardIntensity * (1-blendFactor) + appliedIntensity * blendFactor;
        }
        
        // Helper function to find intensity for a specific distance in a threshold array
        function findIntensityForDistance(distance, thresholdArr) {
            if (distance >= thresholdArr[thresholdArr.length-2][0]) {
                return thresholdArr[thresholdArr.length-1][1];
            } 
            else if (distance <= thresholdArr[0][0]) {
                return thresholdArr[0][1];
            }
            else {
                for (var i = 0; i < thresholdArr.length-1; i++) {
                    if (distance <= thresholdArr[i+1][0]) {
                        var lower = thresholdArr[i];
                        var upper = thresholdArr[i+1];
                        
                        var factor = (distance - lower[0]) / (upper[0] - lower[0]);
                        
                        return lower[1] + factor * (upper[1] - lower[1]);
                    }
                }
                return thresholdArr[0][1]; // Fallback
            }
        }
        
        // Scale the shift based on screen width for consistency across different display sizes
        var horizontalShift = fDistanceFromPlayer * (gameState.nScreenWidth * appliedIntensity);
        
        // Apply both the perspective correction and horizontal shift
        // The horizontal shift gets applied only based on distance, not view angle
        var fMiddleOfSprite = (baseMiddlePosition * distanceCorrection) + horizontalShift;
        
        // Sprites should not shift left/right when looking around
        // We'll use a simpler approach that avoids any angular compensation
        // The sprite's position should be purely determined by its world position
        // and the player's current view direction
        
        // Render player name above multiplayer players
        renderPlayerName(gameState, screen, sprite, fMiddleOfSprite, fSpriteCeiling);

        // The angle the sprite is facing relative to the player
        var fSpriteBeautyAngle = gameState.fPlayerA - sprite["r"] + GameUtils.PIdiv4;
        // Normalize
        if (fSpriteBeautyAngle < 0) {
          fSpriteBeautyAngle += GameUtils.PIx2;
        }
        if (fSpriteBeautyAngle > GameUtils.PIx2) {
          fSpriteBeautyAngle -= GameUtils.PIx2;
        }

        // Loops through the sprite pixels
        for (var sx = 0; sx < fSpriteWidth; sx++) {
          for (var sy = 0; sy < fSpriteHeight; sy++) {
            // Sample sprite
            var fSampleX = sx / fSpriteWidth;
            var fSampleY = sy / fSpriteHeight;

            var sSamplePixel = "";
            var sAnimationFrame = false;

            // Animation-cycle available, determine the current cycle
            if (sprite["move"] && "walkframes" in currentSpriteObject) {
              if (gameState.animationTimer < 5) {
                sAnimationFrame = "W1";
              } else if (gameState.animationTimer >= 5 && gameState.animationTimer < 10) {
                sAnimationFrame = "W2";
              } else if (gameState.animationTimer >= 10) {
                sAnimationFrame = false;
              }
            }

            // Sample-angled glyph is available
            if ("angles" in currentSpriteObject) {
              if (fSpriteBeautyAngle >= GameUtils.PI_0 && fSpriteBeautyAngle < GameUtils.PIx05) {
                sprite["a"] = "B";
              } else if (+(fSpriteBeautyAngle) >= +(GameUtils.PIx05) && +(fSpriteBeautyAngle) < +(GameUtils.PIx1)) {
                sprite["a"] = "L";
              } else if (+(fSpriteBeautyAngle) >= +(GameUtils.PIx1) && +(fSpriteBeautyAngle) < +(GameUtils.PIx1_5)) {
                sprite["a"] = "F";
              } else if (+(fSpriteBeautyAngle) >= +(GameUtils.PIx1_5) && +(fSpriteBeautyAngle) < +(GameUtils.PIx2)) {
                sprite["a"] = "R";
              }
            }

            // Check if object has both, angles, or animations
            try {
              if (sprite["a"] && sAnimationFrame &&
                  currentSpriteObject["angles"] &&
                  currentSpriteObject["angles"][sprite["a"]] &&
                  currentSpriteObject["angles"][sprite["a"]][sAnimationFrame]) {
                sSamplePixel = GameAssets.getSamplePixel(currentSpriteObject["angles"][sprite["a"]][sAnimationFrame], fSampleX, fSampleY);
              } else if (sprite["a"] &&
                        currentSpriteObject["angles"] &&
                        currentSpriteObject["angles"][sprite["a"]]) {
                sSamplePixel = GameAssets.getSamplePixel(currentSpriteObject["angles"][sprite["a"]], fSampleX, fSampleY);
              } else if (sAnimationFrame &&
                        currentSpriteObject[sAnimationFrame]) {
                sSamplePixel = GameAssets.getSamplePixel(currentSpriteObject[sAnimationFrame], fSampleX, fSampleY);
              } else {
                // If not, use basic sprite
                sSamplePixel = GameAssets.getSamplePixel(currentSpriteObject, fSampleX, fSampleY);
              }
            } catch (error) {
              // Log error and use a default character
              console.warn("Error sampling sprite texture: ", error);
              sSamplePixel = "*";
            }

            // Assign based on render mode
            var sSpriteGlyph;
            if (gameState.nRenderMode == 2 || gameState.nRenderMode == 0) {
              sSpriteGlyph = GameRenderer.getRenderHelpers().renderWall(fSpriteCeiling + sy, fDistanceFromPlayer, "W", sSamplePixel);
            } else {
              sSpriteGlyph = sSamplePixel;
            }

            var nSpriteColumn = ~~((fMiddleOfSprite + sx - (fSpriteWidth / 2)));

            if (nSpriteColumn >= 0 && nSpriteColumn < gameState.nScreenWidth) {
              // Check if we're in very close collision range (0.1 to 0.4)
              var isCloseCollision = fDistanceFromPlayer >= 0.1 && fDistanceFromPlayer <= 0.4;

              // For very close sprites, always render them (don't check depth buffer)
              // This prevents z-fighting during collisions
              if (isCloseCollision && sSpriteGlyph != "." && sSpriteGlyph != "&nbsp;") {
                var yccord = fSpriteCeiling + sy;
                var xccord = nSpriteColumn;
                screen[yccord * gameState.nScreenWidth + xccord] = sSpriteGlyph;
                gameState.fDepthBuffer[nSpriteColumn] = fDistanceFromPlayer;
              }
              // Normal rendering for sprites that aren't in close collision range
              else if (sSpriteGlyph != "." && sSpriteGlyph != "&nbsp;" && gameState.fDepthBuffer[nSpriteColumn] >= fDistanceFromPlayer) {
                var yccord = fSpriteCeiling + sy;
                var xccord = nSpriteColumn;
                screen[yccord * gameState.nScreenWidth + xccord] = sSpriteGlyph;
                gameState.fDepthBuffer[nSpriteColumn] = fDistanceFromPlayer;
              }
            }
          }
        }
      }
    }

    return screen;
  };

  /**
   * Handle collisions between player and sprites
   * This is a separate function that handles only collisions without moving NPCs
   * Used for server-controlled NPCs in multiplayer mode
   */
  var handleCollisions = function(gameState) {
    // Reset player movement flag
    gameState.bPlayerMayMoveForward = true;

    // For each sprite object
    for (var si = 0; si < Object.keys(gameState.oLevelSprites).length; si++) {
      var sprite = gameState.oLevelSprites[Object.keys(gameState.oLevelSprites)[si]];

      // Skip if sprite is invalid or doesn't have required properties
      if (!sprite || typeof sprite.x === 'undefined' || typeof sprite.y === 'undefined') {
        continue;
      }

      // Calculate exact distance to ensure we're accurately detecting collisions
      var fDistance = Math.hypot(sprite.x - gameState.fPlayerX, sprite.y - gameState.fPlayerY);

      // Update the sprite's z value to ensure consistency with the render pipeline
      sprite.z = fDistance;

      // Handle collision between player and any sprite (moving or static)
      // This applies to both NPC sprites and multiplayer player sprites
      if (fDistance < 0.4) {
        gameState.bPlayerMayMoveForward = false;

        // Add a small push effect to prevent getting stuck in sprites
        var pushDirection = Math.atan2(
          gameState.fPlayerY - sprite.y,
          gameState.fPlayerX - sprite.x
        );

        // Apply a small push to the player away from the sprite
        var pushFactor = 0.02;
        gameState.fPlayerX += Math.cos(pushDirection) * pushFactor;
        gameState.fPlayerY += Math.sin(pushDirection) * pushFactor;

        // For debugging
        console.log("Collision with sprite: distance=" + fDistance.toFixed(2) + ", type=" + sprite.name);
      }
    }
  };

  // Public API
  return {
    updateSpriteBuffer: updateSpriteBuffer,
    moveSprites: moveSprites,
    renderSprites: renderSprites,
    renderPlayerName: renderPlayerName,
    setGameState: setGameState,
    handleCollisions: handleCollisions
  };
})();