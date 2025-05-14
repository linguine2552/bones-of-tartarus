# Bones of Tartarus
## A fork of the 3D ASCII Game Engine by justMoritz
## Used to create the multiplayer browser rogue like game Tartarus

![Tartarus](https://raw.githubusercontent.com/linguine2552/Images/main/untitled.GIF)

![Tartarus](https://raw.githubusercontent.com/linguine2552/Images/main/untitled2.GIF)


 ╔════════════════════════════════╗
║                               TASKS                                ║
 ╚════════════════════════════════╝

> add sound effects

> add music

> add first person sprites

> add health and attack system w/ mana

> add loot and inventory system

> add class creator page and stats system

 ╔════════════════════════════════╗
║                      C H A N G E L O G                        ║
 ╚════════════════════════════════╝
 
 >> augment lookup and down
 >> augment floor shading ^
 >> add skybox
 >> add skybox elements
 >> fix skybox element positioning
 >> fix mouse tracking when unfocused in game
>> remove sprint and jump
>> add headbob when walking
>> add arrow key up and down look
>> remove wip tower code
>> add compass to ui
>> fix wall lighting bug for north and south faces
>> add multiplayer
>> fix multiplayer movement replication
>> add movement animations
>> add turn in place animations
>> fix player wall collision
>> add player collision
>> fix fov culling sprites on close collision
>> fix headbob magnification bug on lookFactor > 0
>> add server authoritative npc entities
>> add better settings UI
>> add main menu
>> add map maker page
>> add entity spawners
>> fix skybox downward look angle bug
>> fix sprite rendering offset bug
>> fix lookup sensitivity bug

  1. Add a distance-based correction factor:
  var distanceCorrection = 1.0 + (fDistanceFromPlayer * 0.05);
  var fMiddleOfSprite = (0.5 * (fSpriteAngle / (gameState.fFOV / 2.0)) +
  0.5) * +(gameState.nScreenWidth) * distanceCorrection;

  2. Add a manual horizontal offset based on distance:
  var distanceOffset = Math.min(10, fDistanceFromPlayer * 2.5);
  var fMiddleOfSprite = (0.5 * (fSpriteAngle / (gameState.fFOV / 2.0)) +
  0.5) * +(gameState.nScreenWidth) + distanceOffset;

  3. Implement proper perspective projection by adjusting the formula to
  better account for the field of view at varying distances.