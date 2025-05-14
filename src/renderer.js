/**
 * Renderer.js - Rendering system for the TARTARUS game engine
 *
 * Handles raycasting, rendering, and screen display
 */

var GameRenderer = (function() {
  // Store a reference to the game state
  var gameState;

  // Global configuration for darkness distance thresholds
  var darknessConfig = {
    // Wall shading thresholds (as divisors of gameState.fDepth)
    walls: {
      veryClose: 2.5,     // Closest distance threshold
      close: 2,        // Medium-close distance threshold
      medium: 1,       // Medium distance threshold
      far: 0.5              // Farthest visible distance threshold
    },
    // Solid wall shading thresholds
    solidWalls: {
      veryClose: 2.5,     // Closest distance threshold
      close: 2,        // Medium-close distance threshold
      medium: 1,       // Medium distance threshold
      far: 0.5              // Farthest visible distance threshold
    },
    // Gate shading threshold
    gate: {
      threshold: 2.4        // Distance threshold for gate rendering
    }
  };

  // Various shaders for walls, ceilings, objects
  // renderHelpers
  var _rh = {
    // Skybox configuration
    skybox: {
      enabled: true,
      // Moon position in sky (normalized coordinates 0-1)
      moonPosition: {
        x: 0.5, // center horizontally
        y: 0.05  // well above center for better visibility
      },
      // Moon size (radius as a fraction of screen height)
      moonSize: 0.42,
      // Moon appearance
      moonChar: {
        // Characters to use for different brightness levels of the moon
        bright: "O",
        medium: "o",
        dim: "."
      },
      // Nebula configurations
      nebulas: [
        {
          // Position in sky (normalized coordinates 0-1)
          position: {
            x: 0.25,
            y: 0.15
          },
          // Size (radius as a fraction of screen height)
          size: 4.18,
          // Nebula appearance
          chars: {
            dense: "~",
            medium: "°",
            sparse: "·"
          },
          // Color tint (for potential future implementation)
          tint: "blue"
        },
        {
          // Position in sky (normalized coordinates 0-1)
          position: {
            x: 0.75,
            y: 0.17
          },
          // Size (radius as a fraction of screen height)
          size: 2.74,
          // Nebula appearance
          chars: {
            dense: "^",
            medium: "\"",
            sparse: "`"
          },
          // Color tint (for potential future implementation)
          tint: "red"
        }
      ],
      // Galaxy configurations
      galaxies: [
        {
          // Position in sky (normalized coordinates 0-1)
          position: {
            x: 0.25,
            y: 0.08
          },
          // Size parameters
          size: 1.18,
          // Galaxy appearance
          chars: {
            core: "*",
            arm: "+",
            outer: "'"
          },
          // Spiral attributes
          spiral: {
            arms: 3,
            tightness: 0.8
          }
        },
        {
          // Position in sky (normalized coordinates 0-1)
          position: {
            x: 0.75,
            y: 0.03
          },
          // Size parameters
          size: 0.52,
          // Galaxy appearance
          chars: {
            core: "#",
            arm: "=",
            outer: "."
          },
          // Spiral attributes
          spiral: {
            arms: 2,
            tightness: 0.6
          }
        }
      ]
    },
    
    // Helper function to render a nebula
    renderNebula: function(i, j, nebula, worldAngle, adjustedScreenY) {
      // Calculate angular distance for horizontal position
      var nebulaWorldAngle = GameUtils.PI * nebula.position.x * 2; // Map x position (0-1) to angle (0-2π)

      // Calculate angular distance from current ray to nebula position (horizontal)
      var angularDistance = Math.abs(worldAngle - nebulaWorldAngle);
      if (angularDistance > GameUtils.PI) {
        angularDistance = GameUtils.PIx2 - angularDistance;
      }

      // Scale angular distance to create visual horizontal distance
      var nebulaHorizDistance = angularDistance / (gameState.fFOV / 2.0);

      // Calculate vertical distance
      var vertDistance = adjustedScreenY - nebula.position.y;

      // Combined distance calculation for nebula rendering
      var distToNebula = Math.sqrt(nebulaHorizDistance * nebulaHorizDistance + vertDistance * vertDistance);

      // Check if current pixel is within nebula radius
      if (distToNebula < nebula.size) {
        // Calculate nebula density with perlin-like noise effect
        // This creates a more natural, cloudy appearance
        var noiseVal = Math.sin(distToNebula * 20) * Math.cos(nebulaHorizDistance * 25) *
                      Math.sin(vertDistance * 30 + nebulaHorizDistance * 20);

        // Combine distance and noise to determine nebula density
        var density = (1.0 - (distToNebula / nebula.size)) + noiseVal * 0.3;

        // Apply edge falloff for more natural appearance
        var edgeFade = 1.0 - Math.pow(distToNebula / nebula.size, 2);
        density *= edgeFade;

        // Use different characters based on density
        if (density > 0.7) {
          return nebula.chars.dense;
        } else if (density > 0.45) {
          return nebula.chars.medium;
        } else if (density > 0.2) {
          return nebula.chars.sparse;
        }
      }

      // Not part of the nebula
      return null;
    },

    // Helper function to render a spiral galaxy
    renderGalaxy: function(i, j, galaxy, worldAngle, adjustedScreenY) {
      // Calculate angular distance for horizontal position
      var galaxyWorldAngle = GameUtils.PI * galaxy.position.x * 2; // Map x position (0-1) to angle (0-2π)

      // Calculate angular distance from current ray to galaxy position (horizontal)
      var angularDistance = Math.abs(worldAngle - galaxyWorldAngle);
      if (angularDistance > GameUtils.PI) {
        angularDistance = GameUtils.PIx2 - angularDistance;
      }

      // Scale angular distance to create visual horizontal distance
      var galaxyHorizDistance = angularDistance / (gameState.fFOV / 2.0);

      // Calculate vertical distance
      var vertDistance = adjustedScreenY - galaxy.position.y;

      // Convert to polar coordinates (distance from center and angle)
      var distToGalaxy = Math.sqrt(galaxyHorizDistance * galaxyHorizDistance + vertDistance * vertDistance);
      var angle = Math.atan2(vertDistance, galaxyHorizDistance);

      // Check if current pixel is within galaxy radius
      if (distToGalaxy < galaxy.size) {
        // Create spiral arm effect
        var r = distToGalaxy / galaxy.size; // Normalized radius (0-1)
        var arms = galaxy.spiral.arms;
        var tightness = galaxy.spiral.tightness;

        // Create spiral pattern: For each angle, calculate if we're on a spiral arm
        var armPhase = (angle * arms) % (2 * Math.PI);
        var armR = tightness * armPhase; // How far along the arm we should be

        // Core of the galaxy
        if (r < 0.2) {
          return galaxy.chars.core;
        }
        // Spiral arms
        else if (Math.abs(r - armR) < 0.15 * (1 - 0.5 * r)) { // Arms get thinner toward edge
          return galaxy.chars.arm;
        }
        // Outer galaxy regions
        else if (r < 0.85) {
          // Decrease density toward edges
          var rand = Math.sin(r * 50 + angle * 20) * Math.cos(r * 30 - angle * 15);
          if (rand > 0.85 - r) {
            return galaxy.chars.outer;
          }
        }
      }

      // Not part of the galaxy
      return null;
    },

    // Render the skybox with all celestial elements
    renderSkybox: function(i, j) {
      // Calculate the ray angle for this column (horizontal direction)
      var rayAngle = (gameState.fPlayerA - gameState.fFOV / 1.8) + (i / gameState.nScreenWidth) * gameState.fFOV;

      // Calculate world angle (absolute, not relative to player)
      var worldAngle = rayAngle % GameUtils.PIx2;
      if (worldAngle < 0) worldAngle += GameUtils.PIx2;

      // First, determine the base screen position without any look adjustment
      var baseScreenY = j / gameState.nScreenHeight;

      // Apply a correction factor based on the player's look up/down
      // The center of the screen shifts when looking up/down, so we need to compensate
      var lookFactor = gameState.fLooktimer / gameState.nLookLimit;

      // Calculate the look adjustment using a non-linear function to maintain position at all angles
      var lookAdjustment;

      if (lookFactor > 0) {
        // Looking up - use multi-tier adjustment for fine-grained control
        if (lookFactor > 0.5) {
          // Extreme looking up - stronger compensation needed
          var t3 = (lookFactor - 0.5) / 0.5; // Normalize 0.5-1.0 range to 0-1
          var extremeFactor = 0.84 + (t3 * t3 * 3.3); // Stronger curve for extreme angles
          lookAdjustment = -lookFactor * extremeFactor;
        }
        else if (lookFactor > 0.23) {
          // Moderate looking up - moderate compensation
          var t2 = (lookFactor - 0.23) / 0.27; // Normalize 0.23-0.5 range to 0-1
          var moderateFactor = 0.6 + (t2 * 0.23); // Linear increase in this range
          lookAdjustment = -lookFactor * moderateFactor;
        }
        else {
          // Slight looking up - baseline compensation
          lookAdjustment = -lookFactor * 0.58;
        }
      } else {
        // Looking down - use multi-tier adjustment for fine-grained control
        if (lookFactor < -0.5) {
          // Extreme looking down - much stronger compensation needed
          // We need to handle the range from -0.5 to -3.5
          var t3 = (lookFactor + 0.5) / 3.0; // Normalize -0.5 to -3.5 range to 0-1
          var extremeFactor = 0.39 + (Math.abs(t3) * 0.000001); // Strong progressive curve for extreme angles
          lookAdjustment = -lookFactor * extremeFactor;
        }
        else if (lookFactor < -0.23) {
          // Moderate looking down - moderate compensation
          var t2 = (lookFactor + 0.23) / 0.27; // Normalize -0.23 to -0.5 range to 0-1
          var moderateFactor = 0.39 + (t2 * 0.005); // Linear increase in this range
          lookAdjustment = -lookFactor * moderateFactor;
        }
        else {
          // Slight looking down - baseline compensation
          lookAdjustment = -lookFactor * 0.4;
        }
      }

      // Adjust vertical position based on look angle
      var adjustedScreenY = baseScreenY + lookAdjustment;

      // ---- RENDER MOON ----
      // Moon is now rendered first (in front of other celestial objects)
      var moonWorldAngle = GameUtils.PI;

      // Calculate angular distance from current ray to moon position (horizontal distance)
      var angularDistance = Math.abs(worldAngle - moonWorldAngle);
      if (angularDistance > GameUtils.PI) {
        angularDistance = GameUtils.PIx2 - angularDistance;
      }

      // Scale angular distance to create a visual horizontal distance
      var moonHorizDistance = angularDistance / (gameState.fFOV / 2.0);

      // Get moon's intended position in the skybox
      var moonY = this.skybox.moonPosition.y;

      // Calculate vertical distance, accounting for look adjustment
      var vertDistance = adjustedScreenY - moonY;

      // Combined distance calculation for moon rendering
      var distToMoon = Math.sqrt(moonHorizDistance * moonHorizDistance + vertDistance * vertDistance);

      // Render the moon if the current pixel is within the moon radius
      if (distToMoon < this.skybox.moonSize) {
        // Add shading to create a circular moon
        var intensity = 1.0 - (distToMoon / this.skybox.moonSize);

        if (intensity > 0.8) {
          return this.skybox.moonChar.bright;
        } else if (intensity > 0.6) {
          return this.skybox.moonChar.medium;
        } else {
          return this.skybox.moonChar.dim;
        }
      }

      // ---- RENDER GALAXIES ----
      // Galaxies are rendered second (behind moon but in front of nebulas)
      if (this.skybox.galaxies) {
        for (var g = 0; g < this.skybox.galaxies.length; g++) {
          var galaxy = this.skybox.galaxies[g];
          var galaxyChar = this.renderGalaxy(i, j, galaxy, worldAngle, adjustedScreenY);
          if (galaxyChar) return galaxyChar;
        }
      }

      // ---- RENDER NEBULAS ----
      // Nebulas are rendered last (furthest away)
      if (this.skybox.nebulas) {
        for (var n = 0; n < this.skybox.nebulas.length; n++) {
          var nebula = this.skybox.nebulas[n];
          var nebulaChar = this.renderNebula(i, j, nebula, worldAngle, adjustedScreenY);
          if (nebulaChar) return nebulaChar;
        }
      }

      // Stars have been removed as requested

      // Return empty space for the rest of the sky
      return "&nbsp;";
    },
    
    renderWall: function(j, fDistanceToWall, sWallDirection, pixel) {
      var fill = "";

      var b100 = "&#9608;";
      var b75 = "&#9619;";
      var b50 = "&#9618;";
      var b25 = "&#9617;";
      var b0 = "&nbsp;";

      // Use same shading for all wall directions
      if (fDistanceToWall < gameState.fDepth / darknessConfig.walls.veryClose) {
        if (pixel === "#") {
          fill = b75;
        } else if (pixel === "7") {
          fill = b50;
        } else if (pixel === "*" || pixel === "o") {
          fill = b25;
        } else {
          fill = b0;
        }
      } else if (fDistanceToWall < gameState.fDepth / darknessConfig.walls.close) {
        if (pixel === "#") {
          fill = b50;
        } else if (pixel === "7") {
          fill = b50;
        } else if (pixel === "*" || pixel === "o") {
          fill = b25;
        } else {
          fill = b0;
        }
      } else if (fDistanceToWall < gameState.fDepth / darknessConfig.walls.medium) {
        if (pixel === "#") {
          fill = b50;
        } else if (pixel === "7") {
          fill = b25;
        } else if (pixel === "*" || pixel === "o") {
          fill = b25;
        } else {
          fill = b0;
        }
      } else if (fDistanceToWall < gameState.fDepth / darknessConfig.walls.far) {
        if (pixel === "#") {
          fill = b25;
        } else if (pixel === "7") {
          fill = b25;
        } else if (pixel === "*" || pixel === "o") {
          fill = b25;
        } else {
          fill = b0;
        }
      } else {
        fill = "&nbsp;";
      }

      return fill;
    },

    // Figures out shading for given section
    renderSolidWall: function(j, fDistanceToWall, isBoundary) {
      var fill = "&#9617;";

      if (fDistanceToWall < gameState.fDepth / darknessConfig.solidWalls.veryClose) {
        fill = "&#9608;";
      } else if (fDistanceToWall < gameState.fDepth / darknessConfig.solidWalls.close) {
        fill = "&#9619;";
      } else if (fDistanceToWall < gameState.fDepth / darknessConfig.solidWalls.medium) {
        fill = "&#9618;";
      } else if (fDistanceToWall < gameState.fDepth / darknessConfig.solidWalls.far) {
        fill = "&#9617;";
      } else {
        fill = "&nbsp;";
      }

      if (isBoundary) {
        if (fDistanceToWall < gameState.fDepth / darknessConfig.solidWalls.veryClose) {
          fill = "&#9617;";
        } else if (fDistanceToWall < gameState.fDepth / darknessConfig.solidWalls.close) {
          fill = "&#9617;";
        } else if (fDistanceToWall < gameState.fDepth / darknessConfig.solidWalls.medium) {
          fill = "&nbsp;";
        } else if (fDistanceToWall < gameState.fDepth / darknessConfig.solidWalls.far) {
          fill = "&nbsp;";
        } else {
          fill = "&nbsp;";
        }
      }

      return fill;
    },

    // Shading and sectionals for gate
    renderGate: function(j, fDistanceToWall, nDoorFrameHeight) {
      var fill = "X";
      if (j < nDoorFrameHeight) {
        if (fDistanceToWall < gameState.fDepth / darknessConfig.gate.threshold) {
          fill = "&boxH;";
        } else {
          fill = "=";
        }
      } else {
        if (fDistanceToWall < gameState.fDepth / darknessConfig.gate.threshold) {
          fill = "&boxV;";
        } else {
          fill = "|";
        }
      }
      return fill;
    },

    renderFloor: function(j) {
      // Ensure gameState is defined
      if (!gameState) return "&nbsp;";

      var fill = "`";

      // Enhanced floor rendering with better distance shading
      // Calculate a normalized look down factor (0 to 1 scale) based on symmetric limits
      var normalizedLookDown = 0;
      if (gameState.fLooktimer < 0) {
        normalizedLookDown = Math.min(1.0, Math.abs(gameState.fLooktimer) / gameState.nLookLimit);
      }
      
      // Apply a non-linear enhancement for looking down
      var lookDownFactor = normalizedLookDown * normalizedLookDown * 0.3;
      var adjustedDenominator = 2 - gameState.fLooktimer * 0.1 + lookDownFactor;

      // Calculate shading based on distance from center and look angle
      var b = 1 - (j - gameState.nScreenHeight / adjustedDenominator) / (gameState.nScreenHeight / adjustedDenominator);

      // Use looking down percentage to determine rendering detail
      if (normalizedLookDown > 0.7) {
        // More detailed floor rendering for enhanced down-looking
        if (b < 0.15) {
          fill = "W"; // Very close (items would be here)
        } else if (b < 0.3) {
          fill = "x";
        } else if (b < 0.45) {
          fill = "=";
        } else if (b < 0.6) {
          fill = "-";
        } else if (b < 0.75) {
          fill = ".";
        } else if (b < 0.9) {
          fill = "`";
        } else {
          fill = "&nbsp;";
        }
      } else {
        // Standard floor rendering
        if (b < 0.25) {
          fill = "x";
        } else if (b < 0.5) {
          fill = "=";
        } else if (b < 0.75) {
          fill = "-";
        } else if (b < 0.9) {
          fill = "`";
        } else {
          fill = "&nbsp;";
        }
      }

      return fill;
    },

    renderCeiling: function(j, i) {
      // If skybox is enabled, render skybox instead of ceiling
      if (this.skybox.enabled) {
        return this.renderSkybox(i, j);
      }
      
      // Original ceiling code as fallback if skybox disabled
      // Ensure gameState is defined
      if (!gameState) return "&nbsp;";

      var fill = "`";

      // Enhanced ceiling rendering with better distance shading
      // Similar adjustments as floor but for looking up
      var lookUpFactor = Math.max(0, gameState.fLooktimer * 0.2); // Only apply when looking up
      var adjustedDenominator = 2 - gameState.fLooktimer * 0.15 - lookUpFactor;

      // Calculate shading based on distance from center and look angle
      var b = 1 - (j - gameState.nScreenHeight / 2) / (gameState.nScreenHeight / 2);

      // When looking far up, improve the ceiling shading
      if (gameState.fLooktimer > gameState.nLookLimit * 0.4) {
        // More detailed ceiling rendering for extreme up-looking
        if (b < 0.15) {
          fill = "&nbsp;";
        } else if (b < 0.3) {
          fill = "`";
        } else if (b < 0.5) {
          fill = "-";
        } else if (b < 0.65) {
          fill = "=";
        } else if (b < 0.8) {
          fill = "x";
        } else if (b < 0.9) {
          fill = "#";
        } else {
          fill = "@";
        }
      } else {
        // Standard ceiling rendering
        if (b < 0.25) {
          fill = "`";
        } else if (b < 0.5) {
          fill = "-";
        } else if (b < 0.75) {
          fill = "=";
        } else if (b < 0.9) {
          fill = "x";
        } else {
          fill = "#";
        }
      }

      return fill;
    },
  };

  /**
   * Set reference to the game state
   */
  var setGameState = function(state) {
    gameState = state;
  };

  /**
   * Creates a new array of pixels taking looking up and down into account
   * It returns an array to be rendered later.
   */
  var prepareFrame = function(gameState, oInput, oOverlay) {
    var oOverlay = oOverlay || false;

    // Simply return the original input without any transformations
    // This ensures no skew or distortion when looking up/down
    return oInput;
  };

  /**
   * Draw the prepared frame to the screen
   */
  var drawFrame = function(gameState, screen, overlayscreen, target) {
    // Use the screen directly without any skewing effects
    var target = target || gameState.eScreen;
    var sOutput = "";

    // Process the screen and convert to HTML
    var screenWidth = gameState.nScreenWidth;
    var screenHeight = gameState.nScreenHeight;

    // For each screen row
    for (var y = 0; y < screenHeight; y++) {
      // Add row div
      sOutput += "<div class='game-row'>";

      // Directly render each pixel in the row without any skewing or shifting
      for (var x = 0; x < screenWidth; x++) {
        var index = y * screenWidth + x;

        // If index is valid, add pixel
        if (index < screen.length) {
          sOutput += screen[index];
        } else {
          sOutput += "&nbsp;";
        }
      }

      sOutput += "</div>";
    }

    target.innerHTML = sOutput;

    // Update the compass after drawing the main frame
    updateCompass(gameState);
  };

  /**
   * Update the compass display based on player direction
   */
  var updateCompass = (function() {
    // Store the previous direction to detect changes
    var previousDirection = null;
    var animationStartTime = 0;
    var animationDuration = 300; // Animation duration in milliseconds
    
    return function(gameState) {
      // Reference to the compass element
      var compassElement = document.getElementById("compass");
      if (!compassElement) return;
  
      // Convert player angle to degrees (0-360)
      // Note: In this engine, 0 is East, PI/2 is North, PI is West, 3PI/2 is South
      // We need to adjust to make North = 0 degrees, East = 90, South = 180, West = 270
      var playerDegrees = ((gameState.fPlayerA * 180 / GameUtils.PI) - 90) % 360;
      if (playerDegrees < 0) playerDegrees += 360;
  
      // Cardinal directions with their corresponding degrees
      var directions = [
        { name: "N", degree: 0 },
        { name: "NE", degree: 45 },
        { name: "E", degree: 90 },
        { name: "SE", degree: 135 },
        { name: "S", degree: 180 },
        { name: "SW", degree: 225 },
        { name: "W", degree: 270 },
        { name: "NW", degree: 315 }
      ];
  
      // Find the closest direction
      var closestDirection = directions.reduce(function(prev, curr) {
        var prevDiff = Math.abs(playerDegrees - prev.degree);
        var currDiff = Math.abs(playerDegrees - curr.degree);
  
        // Handle the wrap-around case (e.g., 359 degrees is close to 0 degrees)
        if (prevDiff > 180) prevDiff = 360 - prevDiff;
        if (currDiff > 180) currDiff = 360 - currDiff;
  
        return prevDiff < currDiff ? prev : curr;
      });
  
      // Map of directional characters
      var directionChars = {
        N: '↑',
        NE: '↗',
        E: '→',
        SE: '↘',
        S: '↓',
        SW: '↙',
        W: '←',
        NW: '↖'
      };
  
      // Check if direction has changed
      var currentDirection = closestDirection.name;
      var nowTime = Date.now();
      var isAnimating = false;
      
      if (previousDirection !== null && previousDirection !== currentDirection) {
        // Direction has changed, start animation
        animationStartTime = nowTime;
        isAnimating = true;
      }
      
      // Calculate animation progress (0 to 1)
      var animProgress = 0;
      if (isAnimating) {
        animProgress = Math.min(1, (nowTime - animationStartTime) / animationDuration);
      }
      
      // Create the compass display showing only the current direction
      var compassDisplay = '';
      compassDisplay += '<div style="font-family: monospace; font-size: 1.8em; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;">';
      
      // Show current direction with animation effect if changing
      if (isAnimating && animProgress < 1) {
        // During animation, create a transition effect
        var scaleValue = 0.5 + (animProgress * 0.5); // Scale from 50% to 100%
        var opacityValue = animProgress; // Fade in from 0 to 1
        var currentChar = directionChars[currentDirection];
        var prevChar = directionChars[previousDirection];
        
        // Apply animation styles with CSS transitions
        compassDisplay += '<span style="display: flex; position: relative; width: 100%; height: 100%; justify-content: center; align-items: center;">';
        
        // Fade out previous character
        compassDisplay += '<span style="position: absolute; color: #ff5555; ' +
                       'opacity: ' + (1 - opacityValue) + '; ' +
                       'transform: scale(' + (1 + opacityValue/2) + '); ' +
                       'transform-origin: center;">' + prevChar + '</span>';
        
        // Fade in new character
        compassDisplay += '<span style="position: absolute; color: #ff5555; ' +
                       'opacity: ' + opacityValue + '; ' +
                       'transform: scale(' + scaleValue + '); ' +
                       'transform-origin: center;">' + currentChar + '</span>';
        
        compassDisplay += '</span>';
      } else {
        // No animation or animation complete, show current direction
        compassDisplay += '<span style="color: #ff5555;">' + directionChars[currentDirection] + '</span>';
      }
      
      compassDisplay += '</div>';
      
      // Set the compass HTML
      compassElement.innerHTML = compassDisplay;
      
      // Update the previous direction for next frame
      previousDirection = currentDirection;
    };
  })();

  /**
   * Create a test screen with empty pixels
   * Optimized for larger screen sizes
   */
  var createTestScreen = function(gameState) {
    var sOutput = "";
    
    // Create row content
    var emptyRow = "";
    for (var j = 0; j < gameState.nScreenWidth; j++) {
      emptyRow += "&nbsp;";
    }
    
    // Create all rows with proper div wrapping
    for (var i = 0; i < gameState.nScreenHeight; i++) {
      sOutput += "<div class='game-row'>" + emptyRow + "</div>";
    }
    
    gameState.eScreen.innerHTML = sOutput;
  };

  /**
   * Perform raycasting to create the 3D view
   */
  var renderFrame = function(gameState) {
    // Holds the frames we're going to send to the renderer
    var screen = [];
    var spritescreen = [];
    var overlayscreen = [];

    // Converts player turn position into degrees (used for texturing)
    gameState.nDegrees = ~~(gameState.fPlayerA * GameUtils.I80divPI) % 360;

    // For the length of the screenwidth (one frame)
    for (var i = 0; i < gameState.nScreenWidth; i++) {
      // Calculates the ray angle into the world space
      // Take the current player angle, subtract half the field of view
      // and then chop it up into equal little bits of the screen width (at the current column)
      var fRayAngle = (gameState.fPlayerA - gameState.fFOV / 1.8) + (i / gameState.nScreenWidth) * gameState.fFOV;

      var bBreakLoop = false;

      var fDistanceToWall = 0;
      var fDistanceToObject = 0;
      var fDistanceToInverseObject = 0;

      var bHitWall = false;

      var bHitObject = false;
      var bHitBackObject = false;

      var sWalltype = "#";
      var sObjectType = "0";

      var fEyeX = Math.cos(fRayAngle); // Determines the line the testing travels along
      var fEyeY = Math.sin(fRayAngle);

      var fSampleX = 0.0;
      var sWallDirection = "N";

      var nRayLength = 0.0;
      var nGrainControl = 0.05;

      /**
       * Ray Casting Loop
       */
      while (!bBreakLoop && nRayLength < gameState.fDepth) {
        // Increment
        nRayLength += nGrainControl;

        if (!bHitObject) {
          fDistanceToObject += nGrainControl;
        }
        if (!bHitBackObject) {
          fDistanceToInverseObject += nGrainControl;
        }
        if (!bHitWall) {
          fDistanceToWall += nGrainControl;
        }

        // Ray position
        var nTestX = ~~(((gameState.fPlayerX) + fEyeX * nRayLength));
        var nTestY = ~~(((gameState.fPlayerY) + fEyeY * nRayLength));

        // Test if ray hits out of bounds
        if (nTestX < 0 || nTestX >= gameState.nMapWidth || nTestY < 0 || nTestY >= gameState.nMapHeight) {
          bHitWall = true; // Didn't actually, just no wall there
          fDistanceToWall = gameState.fDepth;
          bBreakLoop = true;
        }

        // Test for objects
        else if (gameState.map[nTestY * gameState.nMapWidth + nTestX] == "o" || gameState.map[nTestY * gameState.nMapWidth + nTestX] == ",") {
          bHitObject = true;
          sObjectType = gameState.map[nTestY * gameState.nMapWidth + nTestX];
        } else if (bHitObject == true && gameState.map[nTestY * gameState.nMapWidth + nTestX] == "." || bHitObject == true && gameState.map[nTestY * gameState.nMapWidth + nTestX] == ".") {
          bHitBackObject = true;
        }

        // Test for walls
        else if (gameState.map[nTestY * gameState.nMapWidth + nTestX] != ".") {
          bHitWall = true;
          bBreakLoop = true;

          sWalltype = gameState.map[nTestY * gameState.nMapWidth + nTestX];

          // Test found boundaries of the wall
          var fBound = 0.01;
          var isBoundary = false;

          var vectorPairList = [];
          for (var tx = 0; tx < 2; tx++) {
            for (var ty = 0; ty < 2; ty++) {
              var vy = +(nTestY) + ty - gameState.fPlayerY;
              var vx = +(nTestX) + tx - gameState.fPlayerX;
              var d = Math.sqrt(vx * vx + vy * vy);

              var dot = (fEyeX * vx / d) + (fEyeY * vy / d);
              vectorPairList.push([d, dot]);
            }
          }

          vectorPairList.sort((a, b) => {
            return a[0] - b[0];
          });

          if (Math.acos(vectorPairList[0][1]) < fBound) {
            isBoundary = true;
          }
          if (Math.acos(vectorPairList[1][1]) < fBound) {
            isBoundary = true;
          }

          // 1u wide cell into quarters
          var fBlockMidX = (nTestX) + 0.5;
          var fBlockMidY = (nTestY) + 0.5;

          // Using the distance to the wall and the player angle (Eye Vectors)
          // to determine the collision point
          var fTestPointX = gameState.fPlayerX + fEyeX * fDistanceToWall;
          var fTestPointY = gameState.fPlayerY + fEyeY * fDistanceToWall;

          // Now we have the location of the middle of the cell,
          // and the location of point of collision, work out angle
          var fTestAngle = Math.atan2((fTestPointY - fBlockMidY), (fTestPointX - fBlockMidX))
          // Rotate by pi over 4

          if (fTestAngle >= -GameUtils.PIx0_25 && fTestAngle < GameUtils.PIx0_25) {
            fSampleX = fTestPointY - +(nTestY);
            sWallDirection = "W";
          }
          if (fTestAngle >= GameUtils.PIx0_25 && fTestAngle < GameUtils.PIx0_75) {
            fSampleX = fTestPointX - +(nTestX);
            sWallDirection = "N";
          }
          if (fTestAngle < -GameUtils.PIx0_25 && fTestAngle >= -GameUtils.PIx0_75) {
            fSampleX = fTestPointX - +(nTestX);
            sWallDirection = "S";
          }
          if (fTestAngle >= GameUtils.PIx0_75 || fTestAngle < -GameUtils.PIx0_75) {
            fSampleX = fTestPointY - +(nTestY);
            sWallDirection = "E";
          }
        }
      } // End ray casting loop

      // At the end of ray casting, we should have the lengths of the rays
      // set to their last value, representing their distances
      // Based on the distance to wall, determine how much floor and ceiling to show per column,
      // Adding in the recalc for looking (fLookTimer) and jumping (nJumptimer)

      // Base look factor calculation
      var lookFactor = gameState.fLooktimer * 0.15;
      
      // Apply a non-linear transformation for looking down to enhance floor visibility
      // without requiring extreme raw lookFactor values
      if (gameState.fLooktimer < 0) {
        // Calculate how far down we're looking as a percentage of the limit
        var downPercentage = Math.abs(gameState.fLooktimer) / gameState.nLookLimit;
        
        // Apply a progressive enhancement curve 
        // (will provide the same enhanced floor visibility as before but with symmetric raw values)
        var enhancementFactor = 1.0 + (downPercentage * downPercentage * 2.5);
        lookFactor *= enhancementFactor;
      }

      // Base denominator for all calculations, with headbob factor adjusted based on lookFactor
      // Apply a reduced headbob effect when looking up to prevent magnification
      var headbobFactor = gameState.nHeadbobTimer * 0.05;
      if (lookFactor > 0) {
        // Progressively reduce headbob effect as lookFactor increases
        headbobFactor *= Math.max(0, 1 - lookFactor * 1.5);
      }

      // Use adjusted headbob factor
      var adjustedBaseDenom = (2 - headbobFactor) - lookFactor;

      // Calculate wall placement
      var nCeiling = (gameState.nScreenHeight / adjustedBaseDenom) - gameState.nScreenHeight / fDistanceToWall;
      var nFloor = (gameState.nScreenHeight / adjustedBaseDenom) + gameState.nScreenHeight / fDistanceToWall;

      // Similar for gates
      var nDoorFrameHeight = (gameState.nScreenHeight / adjustedBaseDenom) - gameState.nScreenHeight / (fDistanceToWall + 2);

      // Similar operation for objects
      var nObjectCeiling = (gameState.nScreenHeight / adjustedBaseDenom) - gameState.nScreenHeight / fDistanceToObject;
      var nObjectFloor = (gameState.nScreenHeight / adjustedBaseDenom) + gameState.nScreenHeight / fDistanceToObject;
      var nFObjectBackwall = (gameState.nScreenHeight / adjustedBaseDenom) + (gameState.nScreenHeight / (fDistanceToInverseObject + 0)); // 0 makes the object flat, higher the number, the higher the object :)

      // The spot where the wall was hit
      gameState.fDepthBuffer[i] = fDistanceToWall;

      // Draw the columns one screenheight-pixel at a time
      for (var j = 0; j < gameState.nScreenHeight; j++) {
        // Sky
        if (j < nCeiling) {
          // Draw ceiling/sky
          if (sWalltype == ",") {
            screen[j * gameState.nScreenWidth + i] = "1";
          } else {
            // Use skybox rendering instead of empty space
            screen[j * gameState.nScreenWidth + i] = _rh.renderCeiling(j, i);
          }
        }
        // Solid block
        else if (j > nCeiling && j <= nFloor) {
          // Door Walltype
          if (sWalltype == "X") {
            screen[j * gameState.nScreenWidth + i] = _rh.renderGate(j, fDistanceToWall, nDoorFrameHeight);
          }
          // Solid Walltype
          else if (sWalltype != ".") {
            var fSampleY = ((j - nCeiling) / (nFloor - nCeiling));

            // Render Texture Directly
            if (gameState.nRenderMode == 1) {
              screen[j * gameState.nScreenWidth + i] = GameAssets.getSamplePixel(window.textures[sWalltype], fSampleX, fSampleY);
            }
            // Render Texture with Shading
            if (gameState.nRenderMode == 2) {
              screen[j * gameState.nScreenWidth + i] = _rh.renderWall(j, fDistanceToWall, sWallDirection, GameAssets.getSamplePixel(window.textures[sWalltype], fSampleX, fSampleY));
            }
            // Old, solid-style shading
            if (gameState.nRenderMode == 0) {
              screen[j * gameState.nScreenWidth + i] = _rh.renderSolidWall(j, fDistanceToWall, isBoundary);
            }
          }
          // Render whatever char is on the map as walltype
          else {
            screen[j * gameState.nScreenWidth + i] = sWalltype;
          }
        } // End solid block
        // Floor
        else {
          screen[j * gameState.nScreenWidth + i] = _rh.renderFloor(j);
        }
      } // End draw column loop

      // Object-Draw (removed overlayscreen)
      for (var y = 0; y < gameState.nScreenHeight; y++) {
        if (y > nObjectCeiling && y <= nObjectFloor) {
          if (sObjectType == "o") {
            if (y >= nFObjectBackwall) {
              screen[y * gameState.nScreenWidth + i] = _rh.renderSolidWall(y, fDistanceToObject, isBoundary);
            }
          }
        }
      } // End draw column loop
    } // End column loop

    // Add sprites to the screen
    screen = GameEntities.renderSprites(gameState, screen);

    // Draw the final frame
    drawFrame(gameState, screen, false);
  };

  /**
   * Update darkness distance thresholds
   * @param {Object} config - Configuration object with updated threshold values
   */
  var updateDarknessConfig = function(config) {
    // If entire sections are provided, replace them
    if (config.walls) {
      darknessConfig.walls = {
        ...darknessConfig.walls,
        ...config.walls
      };
    }

    if (config.solidWalls) {
      darknessConfig.solidWalls = {
        ...darknessConfig.solidWalls,
        ...config.solidWalls
      };
    }

    if (config.gate) {
      darknessConfig.gate = {
        ...darknessConfig.gate,
        ...config.gate
      };
    }
  };

  // Public API
  return {
    createTestScreen: createTestScreen,
    renderFrame: renderFrame,
    getRenderHelpers: function() { return _rh; },
    setGameState: setGameState,
    updateDarknessConfig: updateDarknessConfig,
    getDarknessConfig: function() { return darknessConfig; },
    updateCompass: updateCompass
  };
})();