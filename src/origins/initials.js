const debug = require('debug')('wrender:origins');
const sharp = require('sharp');
const crypto = require('crypto');
const hsl2rgb = require('../lib/hsl2rgb');
const originController = require('../lib/origin');

const DEFAULTS = {
  size: 500,
  saturation: 0.7,
  brightness: 0.5,
  color: 'white',
};

function generateSVG({ size, color, text }) {
  const fontSize = Math.max(Math.round((size / (1.3 * text.length)), 10));
  const yPos = ((size + fontSize) / 2) * 0.9;

  return (
    `<svg height="${size}" width="${size}">
        <text x="50%" y="${yPos}" font-size="${fontSize}" fill="${color}" font-family="sans-serif" text-anchor="middle">${text}</text>
    </svg>`
  );
}

/**
 * Origin constructor function
 */
module.exports = function initialsOrigin(opts) {
  opts = Object.assign({}, DEFAULTS, opts || {});

  return originController.createOrigin(`${opts.prefix || '/initials'}/:token/:text`, ({ token, text, size, width }) => {
    debug('initials origin');

    // We can use any size/width param from the recipe to make sure the size will match
    const reqOpts = Object.assign({}, opts);
    if (size && !isNaN(parseInt(size, 10))) reqOpts.size = parseInt(size, 10);
    else if (width && !isNaN(parseInt(width, 10))) reqOpts.size = parseInt(width, 10);

    const svg = generateSVG({
      text: text.toUpperCase(),
      color: reqOpts.color,
      size: reqOpts.size,
    });

    const hash = crypto.createHash('sha512').update(token).digest('hex');

    const hue = parseInt(hash.substr(-7), 16) / 0xfffffff;
    const { saturation, brightness } = reqOpts;
    const [ r, g, b ] = hsl2rgb(hue, saturation, brightness);

    return sharp({
      create: {
        width: reqOpts.size,
        height: reqOpts.size,
        channels: 4,
        background: { r, g, b, alpha: 1 },
      },
    })
      .png()
      .overlayWith(Buffer.from(svg));
  });
};
