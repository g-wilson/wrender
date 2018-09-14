const debug = require('debug')('wrender:origins');
const stream = require('stream');
const crypto = require('crypto');
const PNGlib = require('pnglib');
const hsl2rgb = require('../lib/hsl2rgb');
const originController = require('../lib/origin');

const DEFAULTS = {
  background: [ 240, 240, 240, 255 ],
  margin: 1,
  size: 500,
  saturation: 0.7,
  brightness: 0.5,
  gridSize: 5,
  invert: false,
};

/**
 *
 * Procedural image generator.
 * Creates a PNG as a Buffer object from any input string.
 * Based on Identicon.js but updated to support:
 *  - optional grid size
 *  - renders to Node.js Buffer
 *  - async rendering to prevent CPU blocking with large images
 *
 * -- BASED ON ---
 * Identicon.js 2.3.1
 * http://github.com/stewartlord/identicon.js
 * Copyright 2017, Stewart Lord
 * Released under the BSD license
 * http://www.opensource.org/licenses/bsd-license.php
 *
 */
class Identicon {

  constructor(hash, options) {
    if (options.gridSize) options.gridSize = parseInt(options.gridSize, 10);
    if (options.size) options.size = parseInt(options.size, 10);

    if (options.gridSize && (parseInt(options.gridSize, 10) % 2) === 0) {
      throw new Error('gridSize must be an odd number');
    }

    this.options = Object.assign({}, DEFAULTS, options || {});

    this.hash = crypto.createHash('sha512').update(hash).digest('hex');
    this.size = this.options.size;
    this.gridSize = this.options.gridSize;
    this.margin = Math.max(Math.round(this.options.margin), 1);

    const hue = parseInt(this.hash.substr(-7), 16) / 0xfffffff;
    const { saturation, brightness } = this.options;

    if (this.options.invert === true) {
      this.foreground = this.options.background;
      this.background = hsl2rgb(hue, saturation, brightness);
      this.foreground2 = hsl2rgb(hue, Math.max(saturation - 0.3, 0), Math.min(brightness + 0.3, 1));
    } else {
      this.background = this.options.background;
      this.foreground = hsl2rgb(hue, saturation, brightness);
      this.foreground2 = hsl2rgb(hue, Math.max(saturation - 0.3, 0), Math.min(brightness + 0.3, 1));
    }

    this.image = new PNGlib(this.size, this.size, 256);
  }

  // Loops through the pixel grid and determines which colour to draw
  // Resolves to a PNG Buffer
  async render() {
    const gridWithmargin = (this.gridSize + (2 * this.margin));
    const widthPx = Math.round(this.size / gridWithmargin);

    const bg = this.image.color.apply(this.image, this.background);
    const fg = this.image.color.apply(this.image, this.foreground);
    const fg2 = this.image.color.apply(this.image, this.foreground2);

    for (let col = 0; col < gridWithmargin; col++) {
      for (let row = 0; row < gridWithmargin; row++) {
        const x = (row * widthPx);
        const y = (col * widthPx);

        // Margins
        if (
          col < this.margin || col >= (gridWithmargin - this.margin) ||
          row < this.margin || row >= (gridWithmargin - this.margin)
        ) {
          this.rectangle(x, y, widthPx, widthPx, bg);
          continue;
        }

        // Picks a character from the hash
        let i = (col * gridWithmargin) + row;

        // If we're 50% across a row, pick backwards
        if (row > Math.floor(gridWithmargin / 2)) {
          i = (col * gridWithmargin) + (gridWithmargin - row - 1);
        }

        // Loop back to the start if it is too high
        if (i > this.hash.length) {
          i -= this.hash.length;
        }

        // Set a colour based on the character code
        let color = bg;
        if (parseInt(this.hash.charAt(i), 16) % 2) color = fg;
        else if (parseInt(this.hash.charAt(i), 16) % 3) color = fg2;

        // Draws a rectangle to the canvas
        // We make this asynchronous so this nested loop doesn't block the thread
        await Promise.resolve()
          .then(() => this.rectangle(x, y, widthPx, widthPx, color));
      }
    }

    // Asynchronously resolve the PNG as a Buffer object
    return Promise.resolve(Buffer.from(this.image.getBase64(), 'base64'));
  }

  // Write some colour pixels to the PNG
  rectangle(x, y, w, h, color) {
    for (let i = x; i < x + w; i++) {
      for (let j = y; j < y + h; j++) {
        this.image.buffer[this.image.index(i, j)] = color;
      }
    }
  }

}

/**
 * Origin constructor function
 */
module.exports = function initialsOrigin(opts) {
  opts = opts || {};

  return originController.createOrigin(`${opts.prefix || '/identicon'}/:token`, async ({ token, size, width }) => {
    debug('Identicon origin');

    // We can use any size/width param from the recipe to make sure the size will match
    const reqOpts = Object.assign({}, opts);
    if (size) reqOpts.size = size;
    else if (width) reqOpts.size = width;

    const img = new Identicon(token, reqOpts);
    const bufferStream = new stream.PassThrough();

    bufferStream.end(await img.render());
    return bufferStream;
  });
};
