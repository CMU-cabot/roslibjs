/**
 * @fileOverview
 * @author Graeme Yeates - github.com/megawac
 */

'use strict';

var Canvas = require('canvas');
var CBOR = require('cbor-js');
var typedArrayTagger = require('../cborTypedArrayTags');
var Image = Canvas.Image || window.Image;

/**
 * If a message was compressed as a PNG image (a compression hack since
 * gzipping over WebSockets * is not supported yet), this function places the
 * "image" in a canvas element then decodes the * "image" as a Base64 string.
 *
 * @private
 * @param data - An object containing the PNG data.
 * @param callback - Function with the following params:
 * @param callback.data - The uncompressed data.
 */
function decompressPng(data, callback, type) {
  // Uncompresses the data before sending it through (use image/canvas to do so).
  var image = new Image();
  // When the image loads, extracts the raw data (JSON message).
  image.onload = function() {
    // Creates a local canvas to draw on.
    var canvas = new Canvas();
    var context = canvas.getContext('2d');

    // Sets width and height.
    canvas.width = image.width;
    canvas.height = image.height;

    // Prevents anti-aliasing and loosing data
    context.imageSmoothingEnabled = false;
    context.webkitImageSmoothingEnabled = false;
    context.mozImageSmoothingEnabled = false;

    // Puts the data into the image.
    context.drawImage(image, 0, 0);
    // Grabs the raw, uncompressed data.
    var imageData = context.getImageData(0, 0, image.width, image.height).data;

    if (type == 'json') {
      // Constructs the JSON.
      var jsonData = '';
      for (var i = 0; i < imageData.length; i += 4) {
        // RGB
        jsonData += String.fromCharCode(imageData[i], imageData[i + 1], imageData[i + 2]);
      }
      callback(JSON.parse(jsonData));
    } else if (type == 'cbor') {
      var i = imageData.length - 1;
      for (; ; i--) {
        if ((i % 4) == 3) continue;
        if (imageData[i] == 10) continue; // \n
        if (imageData[i] == 61) continue; // +
        break;
      }
      var len = Math.floor(i / 4) * 3 + (i % 4) + 1;
      var encodedLen = Math.floor(len * 6 / 8);
      const bytes = new Uint8Array(encodedLen);
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      const charMap = Array.from(chars).reduce((acc, char, index) => {
        acc[char.charCodeAt(0)] = index;
        return acc;
      }, {});
      var index = 0;
      for (let i = 0, bc = 0, bs = 0; i < imageData.length; i++) {
        if ((i % 4) == 3) continue;
        bs = (bs << 6) | charMap[imageData[i]];
        bc += 6;
        if (bc >= 8) {
          bc -= 8;
          bytes[index++] = (bs >> bc) & 0xFF;
        }
      }
      var decoded = CBOR.decode(bytes.buffer, typedArrayTagger);
      callback(decoded);
    }
  };
  // Sends the image data to load.
  image.src = 'data:image/png;base64,' + data;
}

module.exports = decompressPng;
