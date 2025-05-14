/**
 * Utils.js - Utility functions for the TARTARUS game engine
 * 
 * Contains math constants, helper functions, and performance optimizations
 */

var GameUtils = (function() {
  // Constants for frequently used math values
  var PI___    = +(Math.PI);
  var PI_0     = 0.0;
  var PIx0_25  = +(PI___ * 0.25);
  var PIx05    = +(PI___ * 0.5);
  var PIx0_75  = +(PI___ * 0.75);
  var PIx1     = PI___;
  var PIx1_5   = +(PI___ * 1.5);
  var PIx2     = +(PI___ * 2.0);
  var I80divPI = (180/PI___);
  var PIdiv4   = PI___ / 4.0;

  /**
   * Generate a random integer between min and max (inclusive)
   */
  var randomIntFromInterval = function(min, max) {
    return ~~(Math.random() * (max - min + 1) + min);
  };

  /**
   * Prints debug output to a specified element (if available)
   */
  var debugOutput = function(input, debugElement) {
    // Only update if the debug element exists
    if (debugElement) {
      debugElement.innerHTML = input;
    }
    // If debug information is important, log it to console as a fallback
    console.debug(input);
  };

  /**
   * Returns true every a-th iteration of b
   */
  var everyAofB = function(a, b) {
    return (a && (a % b === 0));
  };

  /**
   * Lookup-table for controlling row skipping in perspective correction
   */
  var skipEveryXrow = function(input) {
    input = Math.round(input);
    switch (Number(input)) {
      case 0: return 0; break;
      case 1: return 8; break;
      case 2: return 6; break;
      case 3: return 4; break;
      case 4: return 3; break;
      case 5: return 2; break;
      case 6: return 2; break;
      case 7: return 2; break;
      case 8: return 1; break;

      case -1: return 8; break;
      case -2: return 8; break;
      case -3: return 7; break;
      case -4: return 7; break;
      case -5: return 6; break;
      case -6: return 6; break;
      case -7: return 5; break;
      case -8: return 5; break;
      case -9: return 4; break;
      case -10: return 4; break;
      case -11: return 3; break;
      case -12: return 3; break;
      case -13: return 3; break;
      case -14: return 2; break;
      case -15: return 2; break;
      case -16: return 2; break;

      default:
        return 0;
    }
  };

  /**
   * Determines which pixel to use when compositing layers
   */
  var printCompositPixel = function(sInput, sOverlay, nIndex) {
    var sOutput = "";
    // if sOverlay !0, appends it to the output instead
    if (sOverlay && sOverlay[nIndex] != 0) {
      sOutput += sOverlay[nIndex];
    } else {
      sOutput += sInput[nIndex];
    }
    return sOutput;
  };

  /**
   * Array manipulation helper functions
   */
  function toConsumableArray(arr) {
    return arrayWithoutHoles(arr) || iterableToArray(arr) || unsupportedIterableToArray(arr) || nonIterableSpread();
  }

  function arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return arrayCopy(arr);
  }

  function iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
  }

  function unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
  }

  function nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  function arrayCopy(arr) {
    var n = arr.length, copy = new Array(n);
    for (var i = 0; i < n; i++) {
      copy[i] = arr[i];
    }
    return copy;
  }

  function arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    var copy = new Array(len);
    for (var i = 0; i < len; i++) {
      copy[i] = arr[i];
    }
    return copy;
  }

  /**
   * Retrieve a fixed number of elements from an array, evenly distributed but
   * always including the first and last elements.
   */
  var evenlyPickItemsFromArray = function(allItems, neededCount) {
    if (neededCount >= allItems.length) {
      return toConsumableArray(allItems);
    }

    var result = [];
    var totalItems = allItems.length;
    var interval = totalItems / neededCount;

    for (var i = 0; i < neededCount; i++) {
      var evenIndex = ~~(i * interval + interval / 2);
      result.push(allItems[evenIndex]);
    }

    return result;
  };

  /**
   * Get window width
   */
  var getWidth = function() {
    if (self.innerWidth) {
      return self.innerWidth;
    }
    if (document.documentElement && document.documentElement.clientWidth) {
      return document.documentElement.clientWidth;
    }
    if (document.body) {
      return document.body.clientWidth;
    }
  };

  /**
   * Get window height
   */
  var getHeight = function() {
    return Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  };

  // Public API
  return {
    // Constants
    PI: PI___,
    PI_0: PI_0,
    PIx0_25: PIx0_25,
    PIx05: PIx05,
    PIx0_75: PIx0_75,
    PIx1: PIx1,
    PIx1_5: PIx1_5,
    PIx2: PIx2,
    I80divPI: I80divPI,
    PIdiv4: PIdiv4,
    
    // Functions
    randomIntFromInterval: randomIntFromInterval,
    debugOutput: debugOutput,
    everyAofB: everyAofB,
    skipEveryXrow: skipEveryXrow,
    printCompositPixel: printCompositPixel,
    evenlyPickItemsFromArray: evenlyPickItemsFromArray,
    getWidth: getWidth,
    getHeight: getHeight
  };
})();