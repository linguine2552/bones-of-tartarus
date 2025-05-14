/**
 * map-maker.js - Map editor for the TARTARUS game engine
 * 
 * Allows creating and editing level maps
 */

var GameMapMaker = (function() {
  // Store a reference to the game state
  var gameState;
  
  // Map maker state
  var mapMakerState = {
    // Current map dimensions
    nMapWidth: 16,
    nMapHeight: 16,
    
    // Map data
    map: "",
    
    // Available maps
    availableMaps: [],
    
    // Current tile being placed
    currentTile: "#",
    
    // Flag to track if we're in drawing mode (mouse down)
    isDrawing: false,
    
    // Player starting position and angle
    fPlayerX: 8.0,
    fPlayerY: 8.0,
    fPlayerA: 1.5,
    
    // Level metadata
    exitsto: "",
    color: "white",
    background: "black",
    
    // Current map name
    currentMapName: "newmap",
    
    // Spawner configuration
    spawners: {},
    selectedSpawner: null,
    
    // Element references
    mapCanvas: null,
    mapNameInput: null,
    widthInput: null,
    heightInput: null,
    tileSelector: null,
    colorInput: null,
    bgColorInput: null,
    playerXInput: null, 
    playerYInput: null,
    playerAInput: null,
    exitsToInput: null,
    
    // Flag to track if we've modified the map
    mapModified: false
  };
  
  /**
   * Set reference to the game state
   */
  var setGameState = function(state) {
    gameState = state;
  };
  
  /**
   * Load available maps from server
   */
  var loadAvailableMaps = function() {
    fetch('/api/maps')
      .then(response => response.json())
      .then(data => {
        mapMakerState.availableMaps = data.maps;
        updateMapList();
      })
      .catch(error => {
        console.error('Error loading maps:', error);
      });
  };
  
  /**
   * Update the map list in the UI
   */
  var updateMapList = function() {
    var mapList = document.getElementById('map-list');
    mapList.innerHTML = '';
    
    mapMakerState.availableMaps.forEach(function(mapName) {
      var mapItem = document.createElement('div');
      mapItem.className = 'map-list-item';
      mapItem.textContent = mapName;
      mapItem.addEventListener('click', function() {
        loadMap(mapName);
      });
      mapList.appendChild(mapItem);
    });
  };
  
  /**
   * Load a map from the server
   */
  var loadMap = function(mapName) {
    if (mapMakerState.mapModified && !confirm('You have unsaved changes. Load new map anyway?')) {
      return;
    }
    
    fetch('/api/maps/' + mapName)
      .then(response => response.json())
      .then(data => {
        mapMakerState.currentMapName = mapName;
        mapMakerState.nMapWidth = data.nMapWidth;
        mapMakerState.nMapHeight = data.nMapHeight;
        mapMakerState.map = data.map;
        mapMakerState.fPlayerX = data.fPlayerX;
        mapMakerState.fPlayerY = data.fPlayerY;
        mapMakerState.fPlayerA = data.fPlayerA;
        mapMakerState.exitsto = data.exitsto || "";
        mapMakerState.color = data.color || "white";
        mapMakerState.background = data.background || "black";
        
        // Load spawners if they exist
        mapMakerState.spawners = data.spawners || {};
        mapMakerState.selectedSpawner = null;
        hideSpawnerProperties();
        
        // Update UI
        mapMakerState.mapNameInput.value = mapMakerState.currentMapName;
        mapMakerState.widthInput.value = mapMakerState.nMapWidth;
        mapMakerState.heightInput.value = mapMakerState.nMapHeight;
        mapMakerState.colorInput.value = mapMakerState.color;
        mapMakerState.bgColorInput.value = mapMakerState.background;
        mapMakerState.playerXInput.value = mapMakerState.fPlayerX;
        mapMakerState.playerYInput.value = mapMakerState.fPlayerY;
        mapMakerState.playerAInput.value = mapMakerState.fPlayerA;
        mapMakerState.exitsToInput.value = mapMakerState.exitsto;
        
        // Redraw the map
        renderMap();
        
        // Reset modified flag
        mapMakerState.mapModified = false;
      })
      .catch(error => {
        console.error('Error loading map:', error);
      });
  };
  
  /**
   * Create a new empty map
   */
  var createNewMap = function() {
    if (mapMakerState.mapModified && !confirm('You have unsaved changes. Create new map anyway?')) {
      return;
    }
    
    // Get dimensions from inputs
    var width = parseInt(mapMakerState.widthInput.value) || 16;
    var height = parseInt(mapMakerState.heightInput.value) || 16;
    
    // Validate dimensions
    width = Math.min(Math.max(width, 8), 64);
    height = Math.min(Math.max(height, 8), 64);
    
    // Update state
    mapMakerState.nMapWidth = width;
    mapMakerState.nMapHeight = height;
    mapMakerState.currentMapName = "newmap";
    mapMakerState.map = "";
    
    // Reset spawners
    mapMakerState.spawners = {};
    mapMakerState.selectedSpawner = null;
    hideSpawnerProperties();
    
    // Create empty map with border walls
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
          mapMakerState.map += "#"; // Border walls
        } else {
          mapMakerState.map += "."; // Empty space
        }
      }
    }
    
    // Update UI
    mapMakerState.mapNameInput.value = mapMakerState.currentMapName;
    mapMakerState.widthInput.value = mapMakerState.nMapWidth;
    mapMakerState.heightInput.value = mapMakerState.nMapHeight;
    
    // Reset player position to center of map
    mapMakerState.fPlayerX = Math.floor(width / 2) + 0.5;
    mapMakerState.fPlayerY = Math.floor(height / 2) + 0.5;
    mapMakerState.fPlayerA = 1.5;
    
    // Update player position inputs
    mapMakerState.playerXInput.value = mapMakerState.fPlayerX;
    mapMakerState.playerYInput.value = mapMakerState.fPlayerY;
    mapMakerState.playerAInput.value = mapMakerState.fPlayerA;
    
    // Redraw the map
    renderMap();
    
    // Reset modified flag
    mapMakerState.mapModified = false;
  };
  
  /**
   * Save the current map
   */
  var saveMap = function() {
    // Get map name from input
    var mapName = mapMakerState.mapNameInput.value.trim();
    
    // Validate map name
    if (!mapName) {
      alert('Please enter a map name');
      return;
    }
    
    // Validate map name format (only allow alphanumeric and underscore)
    if (!/^[a-zA-Z0-9_]+$/.test(mapName)) {
      alert('Map name can only contain letters, numbers, and underscores');
      return;
    }
    
    // Ensure map name ends with .map
    if (!mapName.endsWith('.map')) {
      mapName += '.map';
    }
    
    // Create map data
    var mapData = {
      nMapWidth: mapMakerState.nMapWidth,
      nMapHeight: mapMakerState.nMapHeight,
      map: mapMakerState.map,
      fPlayerX: parseFloat(mapMakerState.playerXInput.value),
      fPlayerY: parseFloat(mapMakerState.playerYInput.value),
      fPlayerA: parseFloat(mapMakerState.playerAInput.value),
      exitsto: mapMakerState.exitsToInput.value,
      color: mapMakerState.colorInput.value,
      background: mapMakerState.bgColorInput.value,
      spawners: mapMakerState.spawners
    };
    
    // Save to server
    fetch('/api/maps/' + mapName, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mapData)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert('Map saved successfully');
        mapMakerState.currentMapName = mapName;
        mapMakerState.mapModified = false;
        
        // Refresh map list
        loadAvailableMaps();
      } else {
        alert('Error saving map: ' + data.error);
      }
    })
    .catch(error => {
      console.error('Error saving map:', error);
      alert('Error saving map. See console for details.');
    });
  };
  
  /**
   * Render the map in the canvas
   */
  var renderMap = function() {
    if (!mapMakerState.mapCanvas) return;
    
    var ctx = mapMakerState.mapCanvas.getContext('2d');
    var width = mapMakerState.nMapWidth;
    var height = mapMakerState.nMapHeight;
    
    // Calculate cell size
    var cellSize = Math.min(
      (mapMakerState.mapCanvas.width - 10) / width,
      (mapMakerState.mapCanvas.height - 10) / height
    );
    
    // Clear canvas
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, mapMakerState.mapCanvas.width, mapMakerState.mapCanvas.height);
    
    // Draw grid
    var offsetX = (mapMakerState.mapCanvas.width - width * cellSize) / 2;
    var offsetY = (mapMakerState.mapCanvas.height - height * cellSize) / 2;
    
    // Draw map cells
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var cellX = offsetX + x * cellSize;
        var cellY = offsetY + y * cellSize;
        var tileChar = mapMakerState.map.charAt(y * width + x);
        
        // Draw cell background
        ctx.fillStyle = getTileColor(tileChar);
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
        
        // Draw grid lines
        ctx.strokeStyle = '#333';
        ctx.strokeRect(cellX, cellY, cellSize, cellSize);
        
        // Draw tile character
        ctx.fillStyle = '#fff';
        ctx.font = Math.max(8, cellSize * 0.7) + 'px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tileChar, cellX + cellSize / 2, cellY + cellSize / 2);
      }
    }
    
    // Draw player position
    var playerX = offsetX + mapMakerState.fPlayerX * cellSize;
    var playerY = offsetY + mapMakerState.fPlayerY * cellSize;
    
    ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(playerX, playerY, cellSize / 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw player direction
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playerX, playerY);
    ctx.lineTo(
      playerX + Math.cos(mapMakerState.fPlayerA) * cellSize * 0.7,
      playerY + Math.sin(mapMakerState.fPlayerA) * cellSize * 0.7
    );
    ctx.stroke();
  };
  
  /**
   * Get color for a specific tile
   */
  var getTileColor = function(tileChar) {
    switch (tileChar) {
      case '.': return '#222'; // Empty space
      case '#': return '#555'; // Wall
      case 'X': return '#733'; // Exit
      case 'W': return '#237'; // Water
      case 'T': return '#050'; // Tree
      case 'C': return '#630'; // Column
      case 'U': return '#335'; // Upstairs
      case 'D': return '#335'; // Downstairs
      case 'o': return '#774'; // Decoration
      case '$': return '#660'; // Gold
      case 'S': return '#b72'; // Spawner
      default: return '#444';  // Other
    }
  };
  
  /**
   * Handle mouse down on map canvas
   */
  var handleMapMouseDown = function(event) {
    mapMakerState.isDrawing = true;
    handleMapMouseMove(event);
  };
  
  /**
   * Handle mouse move on map canvas
   */
  var handleMapMouseMove = function(event) {
    if (!mapMakerState.isDrawing) return;
    
    var rect = mapMakerState.mapCanvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    
    var width = mapMakerState.nMapWidth;
    var height = mapMakerState.nMapHeight;
    
    // Calculate cell size
    var cellSize = Math.min(
      (mapMakerState.mapCanvas.width - 10) / width,
      (mapMakerState.mapCanvas.height - 10) / height
    );
    
    var offsetX = (mapMakerState.mapCanvas.width - width * cellSize) / 2;
    var offsetY = (mapMakerState.mapCanvas.height - height * cellSize) / 2;
    
    // Calculate grid position
    var gridX = Math.floor((x - offsetX) / cellSize);
    var gridY = Math.floor((y - offsetY) / cellSize);
    
    // Check if within bounds
    if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
      // Calculate index in map string
      var index = gridY * width + gridX;
      
      // If we're placing a spawner, check if we're replacing an existing spawner
      if (mapMakerState.currentTile === 'S') {
        var coordKey = gridX + ',' + gridY;
        // If this isn't already a spawner, create a new one with default properties
        if (mapMakerState.map.charAt(index) !== 'S') {
          mapMakerState.spawners[coordKey] = {
            x: gridX,
            y: gridY,
            entityType: 'P', // Default: Pogel
            interval: 15000, // Default: 15 seconds
            maxEntities: 2   // Default: 2 entities max
          };
        }
      } else if (mapMakerState.map.charAt(index) === 'S') {
        // If we're replacing a spawner with something else, remove it from the spawners list
        var coordKey = gridX + ',' + gridY;
        delete mapMakerState.spawners[coordKey];
        
        // If this was the selected spawner, deselect it
        if (mapMakerState.selectedSpawner === coordKey) {
          mapMakerState.selectedSpawner = null;
          hideSpawnerProperties();
        }
      }
      
      // Update map
      var newMap = mapMakerState.map.substring(0, index) + 
                   mapMakerState.currentTile + 
                   mapMakerState.map.substring(index + 1);
      
      // Only update if changed
      if (newMap !== mapMakerState.map) {
        mapMakerState.map = newMap;
        mapMakerState.mapModified = true;
        renderMap();
      }
    }
  };
  
  /**
   * Handle spawner click - select a spawner for editing
   */
  var handleSpawnerSelection = function(gridX, gridY) {
    var coordKey = gridX + ',' + gridY;
    
    // Check if this is a spawner
    if (mapMakerState.map.charAt(gridY * mapMakerState.nMapWidth + gridX) === 'S') {
      // Select this spawner
      mapMakerState.selectedSpawner = coordKey;
      
      // Create spawner data if it doesn't exist
      if (!mapMakerState.spawners[coordKey]) {
        mapMakerState.spawners[coordKey] = {
          x: gridX,
          y: gridY,
          entityType: 'P',
          interval: 15000,
          maxEntities: 2
        };
      }
      
      // Update spawner properties panel
      updateSpawnerPropertiesPanel();
      
      // Show the panel
      document.getElementById('spawner-properties').style.display = 'block';
    } else {
      // Not a spawner, deselect
      mapMakerState.selectedSpawner = null;
      hideSpawnerProperties();
    }
  };
  
  /**
   * Update the spawner properties panel with the selected spawner's data
   */
  var updateSpawnerPropertiesPanel = function() {
    if (!mapMakerState.selectedSpawner) return;
    
    var spawner = mapMakerState.spawners[mapMakerState.selectedSpawner];
    if (!spawner) return;
    
    // Update location display
    document.getElementById('spawner-location').textContent = 'X: ' + spawner.x + ', Y: ' + spawner.y;
    
    // Update entity type dropdown
    document.getElementById('spawner-entity-type').value = spawner.entityType;
    
    // Update other inputs
    document.getElementById('spawner-interval').value = spawner.interval;
    document.getElementById('spawner-max-entities').value = spawner.maxEntities;
  };
  
  /**
   * Hide the spawner properties panel
   */
  var hideSpawnerProperties = function() {
    document.getElementById('spawner-properties').style.display = 'none';
  };
  
  /**
   * Update spawner properties from the form
   */
  var updateSpawnerProperties = function() {
    if (!mapMakerState.selectedSpawner) return;
    
    var spawner = mapMakerState.spawners[mapMakerState.selectedSpawner];
    if (!spawner) return;
    
    // Get values from form
    spawner.entityType = document.getElementById('spawner-entity-type').value;
    spawner.interval = parseInt(document.getElementById('spawner-interval').value);
    spawner.maxEntities = parseInt(document.getElementById('spawner-max-entities').value);
    
    // Mark as modified
    mapMakerState.mapModified = true;
  };
  
  /**
   * Delete the selected spawner
   */
  var deleteSpawner = function() {
    if (!mapMakerState.selectedSpawner) return;
    
    var coordKey = mapMakerState.selectedSpawner;
    var parts = coordKey.split(',');
    var x = parseInt(parts[0]);
    var y = parseInt(parts[1]);
    
    // Remove from map
    var index = y * mapMakerState.nMapWidth + x;
    mapMakerState.map = mapMakerState.map.substring(0, index) + 
                         '.' + // Replace with empty space
                         mapMakerState.map.substring(index + 1);
    
    // Remove from spawners list
    delete mapMakerState.spawners[coordKey];
    
    // Deselect
    mapMakerState.selectedSpawner = null;
    
    // Hide panel
    hideSpawnerProperties();
    
    // Mark as modified
    mapMakerState.mapModified = true;
    
    // Redraw
    renderMap();
  };
  
  /**
   * Handle mouse up
   */
  var handleMapMouseUp = function() {
    mapMakerState.isDrawing = false;
  };
  
  /**
   * Handle click on map (for player position or spawner selection)
   */
  var handlePlayerPositionClick = function(event) {
    var rect = mapMakerState.mapCanvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    
    var width = mapMakerState.nMapWidth;
    var height = mapMakerState.nMapHeight;
    
    // Calculate cell size
    var cellSize = Math.min(
      (mapMakerState.mapCanvas.width - 10) / width,
      (mapMakerState.mapCanvas.height - 10) / height
    );
    
    var offsetX = (mapMakerState.mapCanvas.width - width * cellSize) / 2;
    var offsetY = (mapMakerState.mapCanvas.height - height * cellSize) / 2;
    
    // Calculate precise position for player positioning
    var preciseGridX = (x - offsetX) / cellSize;
    var preciseGridY = (y - offsetY) / cellSize;
    
    // Calculate integer grid position for tile selection
    var gridX = Math.floor((x - offsetX) / cellSize);
    var gridY = Math.floor((y - offsetY) / cellSize);
    
    // Check if within bounds
    if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
      // Player position mode
      if (document.getElementById('player-position-mode').checked) {
        // Update player position
        mapMakerState.fPlayerX = preciseGridX;
        mapMakerState.fPlayerY = preciseGridY;
        
        // Update UI
        mapMakerState.playerXInput.value = preciseGridX.toFixed(2);
        mapMakerState.playerYInput.value = preciseGridY.toFixed(2);
        
        // Mark as modified
        mapMakerState.mapModified = true;
      } else {
        // Check if we clicked on a spawner
        if (mapMakerState.map.charAt(gridY * width + gridX) === 'S') {
          // Select this spawner
          handleSpawnerSelection(gridX, gridY);
        } else {
          // Not a spawner, hide spawner properties
          mapMakerState.selectedSpawner = null;
          hideSpawnerProperties();
        }
      }
      
      // Redraw
      renderMap();
    }
  };
  
  /**
   * Resize the map
   */
  var resizeMap = function() {
    // Get new dimensions
    var newWidth = parseInt(mapMakerState.widthInput.value) || 16;
    var newHeight = parseInt(mapMakerState.heightInput.value) || 16;
    
    // Validate dimensions
    newWidth = Math.min(Math.max(newWidth, 8), 64);
    newHeight = Math.min(Math.max(newHeight, 8), 64);
    
    // If no change, exit
    if (newWidth === mapMakerState.nMapWidth && newHeight === mapMakerState.nMapHeight) {
      return;
    }
    
    // Create new map
    var newMap = "";
    
    // Fill new map
    for (var y = 0; y < newHeight; y++) {
      for (var x = 0; x < newWidth; x++) {
        if (y < mapMakerState.nMapHeight && x < mapMakerState.nMapWidth) {
          // Copy from existing map
          newMap += mapMakerState.map.charAt(y * mapMakerState.nMapWidth + x);
        } else if (y === 0 || y === newHeight - 1 || x === 0 || x === newWidth - 1) {
          // Border walls for new areas
          newMap += "#";
        } else {
          // Empty space for new areas
          newMap += ".";
        }
      }
    }
    
    // Update state
    mapMakerState.nMapWidth = newWidth;
    mapMakerState.nMapHeight = newHeight;
    mapMakerState.map = newMap;
    
    // Update UI
    mapMakerState.widthInput.value = newWidth;
    mapMakerState.heightInput.value = newHeight;
    
    // Mark as modified
    mapMakerState.mapModified = true;
    
    // Redraw
    renderMap();
  };
  
  /**
   * Update player position from inputs
   */
  var updatePlayerPosition = function() {
    var x = parseFloat(mapMakerState.playerXInput.value);
    var y = parseFloat(mapMakerState.playerYInput.value);
    var angle = parseFloat(mapMakerState.playerAInput.value);
    
    // Validate
    if (!isNaN(x) && !isNaN(y) && !isNaN(angle)) {
      mapMakerState.fPlayerX = x;
      mapMakerState.fPlayerY = y;
      mapMakerState.fPlayerA = angle;
      
      // Mark as modified
      mapMakerState.mapModified = true;
      
      // Redraw
      renderMap();
    }
  };
  
  /**
   * Initialize the map maker
   */
  var init = function(containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('Map maker container not found:', containerId);
      return;
    }
    
    // Create UI elements
    var html = `
      <div id="map-maker-container">
        <div id="map-maker-header">
          <h2>TARTARUS Map Maker</h2>
          <button id="back-to-main-menu">Back to Main Menu</button>
        </div>
        
        <div id="map-maker-content">
          <div id="map-editor-panel">
            <div id="map-canvas-container">
              <canvas id="map-canvas" width="600" height="600"></canvas>
            </div>
            
            <div id="drawing-tools">
              <div class="tool-section">
                <h3>Drawing Tools</h3>
                <div class="tool-grid">
                  <button class="tile-button" data-tile=".">Empty (.)</button>
                  <button class="tile-button" data-tile="#">Wall (#)</button>
                  <button class="tile-button" data-tile="X">Exit (X)</button>
                  <button class="tile-button" data-tile="W">Water (W)</button>
                  <button class="tile-button" data-tile="T">Tree (T)</button>
                  <button class="tile-button" data-tile="C">Column (C)</button>
                  <button class="tile-button" data-tile="U">Upstairs (U)</button>
                  <button class="tile-button" data-tile="D">Downstairs (D)</button>
                  <button class="tile-button" data-tile="o">Decor (o)</button>
                  <button class="tile-button" data-tile="$">Gold ($)</button>
                  <button class="tile-button" data-tile="S">Spawner (S)</button>
                </div>
              </div>
              
              <div class="tool-section">
                <h3>Player Position</h3>
                <label>
                  <input type="checkbox" id="player-position-mode"> Set Player Position
                </label>
                <div class="input-group">
                  <label>X: <input type="number" id="player-x" step="0.1" min="0"></label>
                  <label>Y: <input type="number" id="player-y" step="0.1" min="0"></label>
                  <label>Angle: <input type="number" id="player-angle" step="0.1" min="0" max="6.28"></label>
                  <button id="update-player-position">Update</button>
                </div>
              </div>
              
              <div id="spawner-properties" class="tool-section" style="display: none;">
                <h3>Spawner Properties</h3>
                <div class="spawner-info">
                  <p>Selected Spawner: <span id="spawner-location">None</span></p>
                </div>
                <div class="input-group">
                  <label>Entity Type: 
                    <select id="spawner-entity-type">
                      <option value="P">Pogel (P)</option>
                      <option value="O">Obetrl (O)</option>
                    </select>
                  </label>
                </div>
                <div class="input-group">
                  <label>Spawn Interval (ms): <input type="number" id="spawner-interval" value="15000" min="1000" step="1000"></label>
                  <label>Max Entities: <input type="number" id="spawner-max-entities" value="2" min="1" max="10"></label>
                </div>
                <div class="button-group">
                  <button id="update-spawner">Update Spawner</button>
                  <button id="delete-spawner">Delete Spawner</button>
                </div>
              </div>
            </div>
          </div>
          
          <div id="map-controls-panel">
            <div class="panel-section">
              <h3>Available Maps</h3>
              <div id="map-list" class="scrollable-list">
                <!-- Map list will be populated here -->
                <div class="loading-indicator">Loading maps...</div>
              </div>
            </div>
            
            <div class="panel-section">
              <h3>Map Properties</h3>
              <div class="input-group">
                <label>Map Name: <input type="text" id="map-name"></label>
                <label>Width: <input type="number" id="map-width" min="8" max="64" value="16"></label>
                <label>Height: <input type="number" id="map-height" min="8" max="64" value="16"></label>
                <button id="resize-map">Resize</button>
              </div>
              
              <div class="input-group">
                <label>Text Color: <input type="text" id="text-color" value="white"></label>
                <label>Background: <input type="text" id="bg-color" value="black"></label>
                <label>Exits To: <input type="text" id="exits-to"></label>
              </div>
            </div>
            
            <div class="panel-section">
              <h3>Actions</h3>
              <div class="button-group">
                <button id="new-map">New Map</button>
                <button id="save-map">Save Map</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // Style the map maker
    var style = document.createElement('style');
    style.textContent = `
      #map-maker-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background-color: #111;
        color: #eee;
        font-family: 'Consolas', Courier, monospace;
      }
      
      #map-maker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 20px;
        background-color: #222;
        border-bottom: 1px solid #444;
      }
      
      #map-maker-header h2 {
        margin: 0;
        color: #ffcc00;
      }
      
      #back-to-main-menu {
        background-color: #333;
        color: white;
        border: 1px solid #555;
        padding: 5px 10px;
        cursor: pointer;
      }
      
      #map-maker-content {
        display: flex;
        flex: 1;
        overflow: hidden;
      }
      
      #map-editor-panel {
        flex: 2;
        display: flex;
        flex-direction: column;
        padding: 10px;
        border-right: 1px solid #333;
      }
      
      #map-canvas-container {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        border: 1px solid #333;
        background-color: #000;
        margin-bottom: 10px;
        overflow: hidden;
      }
      
      #map-canvas {
        background-color: #111;
      }
      
      #drawing-tools {
        padding: 10px;
        background-color: #222;
        border: 1px solid #333;
      }
      
      .tool-section {
        margin-bottom: 15px;
      }
      
      .tool-section h3 {
        margin-top: 0;
        margin-bottom: 10px;
        color: #aaa;
        border-bottom: 1px solid #333;
        padding-bottom: 5px;
      }
      
      .tool-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 5px;
      }
      
      .tile-button {
        background-color: #333;
        color: white;
        border: 1px solid #555;
        padding: 5px;
        cursor: pointer;
      }
      
      .tile-button.active {
        background-color: #ffcc00;
        color: black;
        font-weight: bold;
      }
      
      .input-group {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 5px;
      }
      
      .input-group label {
        display: flex;
        align-items: center;
      }
      
      .input-group input {
        background-color: #333;
        color: white;
        border: 1px solid #555;
        padding: 3px 5px;
        margin-left: 5px;
        width: 60px;
      }
      
      #map-controls-panel {
        flex: 1;
        padding: 10px;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }
      
      .panel-section {
        margin-bottom: 20px;
        padding: 10px;
        background-color: #222;
        border: 1px solid #333;
      }
      
      .panel-section h3 {
        margin-top: 0;
        margin-bottom: 10px;
        color: #aaa;
        border-bottom: 1px solid #333;
        padding-bottom: 5px;
      }
      
      .scrollable-list {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #333;
        background-color: #111;
      }
      
      .map-list-item {
        padding: 5px 10px;
        cursor: pointer;
        border-bottom: 1px solid #222;
      }
      
      .map-list-item:hover {
        background-color: #333;
      }
      
      .button-group {
        display: flex;
        gap: 10px;
      }
      
      .button-group button {
        flex: 1;
        background-color: #333;
        color: white;
        border: 1px solid #555;
        padding: 8px;
        cursor: pointer;
        font-size: 14px;
      }
      
      #new-map {
        background-color: #226;
      }
      
      #save-map {
        background-color: #262;
      }
      
      /* Input styles */
      input[type="text"], input[type="number"] {
        background-color: #333;
        color: white;
        border: 1px solid #555;
        padding: 5px;
      }
      
      /* Button hover states */
      button:hover {
        background-color: #444;
      }
      
      #new-map:hover {
        background-color: #337;
      }
      
      #save-map:hover {
        background-color: #373;
      }
    `;
    document.head.appendChild(style);
    
    // Get references to UI elements
    mapMakerState.mapCanvas = document.getElementById('map-canvas');
    mapMakerState.mapNameInput = document.getElementById('map-name');
    mapMakerState.widthInput = document.getElementById('map-width');
    mapMakerState.heightInput = document.getElementById('map-height');
    mapMakerState.colorInput = document.getElementById('text-color');
    mapMakerState.bgColorInput = document.getElementById('bg-color');
    mapMakerState.playerXInput = document.getElementById('player-x');
    mapMakerState.playerYInput = document.getElementById('player-y');
    mapMakerState.playerAInput = document.getElementById('player-angle');
    mapMakerState.exitsToInput = document.getElementById('exits-to');
    
    // Initialize input values
    mapMakerState.mapNameInput.value = mapMakerState.currentMapName;
    mapMakerState.widthInput.value = mapMakerState.nMapWidth;
    mapMakerState.heightInput.value = mapMakerState.nMapHeight;
    mapMakerState.colorInput.value = mapMakerState.color;
    mapMakerState.bgColorInput.value = mapMakerState.background;
    mapMakerState.playerXInput.value = mapMakerState.fPlayerX;
    mapMakerState.playerYInput.value = mapMakerState.fPlayerY;
    mapMakerState.playerAInput.value = mapMakerState.fPlayerA;
    
    // Add event listeners
    
    // Back to main menu
    document.getElementById('back-to-main-menu').addEventListener('click', function() {
      if (mapMakerState.mapModified && !confirm('You have unsaved changes. Exit anyway?')) {
        return;
      }
      hideMapMaker();
    });
    
    // Map canvas events
    mapMakerState.mapCanvas.addEventListener('mousedown', handleMapMouseDown);
    mapMakerState.mapCanvas.addEventListener('mousemove', handleMapMouseMove);
    mapMakerState.mapCanvas.addEventListener('mouseup', handleMapMouseUp);
    mapMakerState.mapCanvas.addEventListener('mouseleave', handleMapMouseUp);
    mapMakerState.mapCanvas.addEventListener('click', handlePlayerPositionClick);
    
    // Tile buttons
    var tileButtons = document.querySelectorAll('.tile-button');
    tileButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        // Remove active class from all buttons
        tileButtons.forEach(function(btn) {
          btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Set current tile
        mapMakerState.currentTile = button.dataset.tile;
      });
    });
    
    // Set default tile button as active
    tileButtons[0].classList.add('active');
    
    // New map button
    document.getElementById('new-map').addEventListener('click', createNewMap);
    
    // Save map button
    document.getElementById('save-map').addEventListener('click', saveMap);
    
    // Resize map button
    document.getElementById('resize-map').addEventListener('click', resizeMap);
    
    // Update player position button
    document.getElementById('update-player-position').addEventListener('click', updatePlayerPosition);
    
    // Spawner buttons
    document.getElementById('update-spawner').addEventListener('click', function() {
      updateSpawnerProperties();
      renderMap();
    });
    
    document.getElementById('delete-spawner').addEventListener('click', deleteSpawner);
    
    // Handle window resize
    window.addEventListener('resize', function() {
      // Only if map maker is visible
      if (document.getElementById('map-maker-container').style.display !== 'none') {
        renderMap();
      }
    });
    
    // Create initial empty map
    createNewMap();
    
    // Load available maps
    loadAvailableMaps();
  };
  
  /**
   * Show the map maker
   */
  var showMapMaker = function() {
    var mapMakerContainer = document.getElementById('map-maker-container');
    if (mapMakerContainer) {
      mapMakerContainer.style.display = 'flex';
      renderMap();
    }
    
    // Hide game elements
    document.getElementById('game').style.display = 'none';
    
    // Refresh map list
    loadAvailableMaps();
  };
  
  /**
   * Hide the map maker
   */
  var hideMapMaker = function() {
    var mapMakerContainer = document.getElementById('map-maker-container');
    if (mapMakerContainer) {
      mapMakerContainer.style.display = 'none';
    }
    
    // Show game elements
    document.getElementById('game').style.display = 'flex';
    
    // Show main menu
    document.getElementById('main-menu').style.display = 'flex';
  };
  
  // Public API
  return {
    init: init,
    showMapMaker: showMapMaker,
    hideMapMaker: hideMapMaker,
    setGameState: setGameState
  };
})();