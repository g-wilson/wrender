# Wrender

Image compression and transformation reverse-proxy for Express apps.

----

This library can be used to serve up compressed and transformed images from a high-resolution source (e.g. Amazon S3) suitable for caching and delivery by a CDN.

It is an open-source re-implementation of [Car Throttle](https://www.carthrottle.com/about/)'s image delivery service, which (running behind Cloudfront) handles hundreds of GBs and tens of millions of requests every day.

The image processing is extremely fast and is handled by [Sharp](https://github.com/lovell/sharp), which implements the [libvips](https://github.com/jcupitt/libvips) library as a native module. As such, Node.js [Streams](https://nodejs.org/api/stream.html) are used to abstract the handling of image data.

The recommended usage is part of a larger express-based application although a simple server is provided for example, testing and non-production environments. Rate-limiting, authentication, logging, and other such features can be implemented alongside and are not provided here.

```js
const express = require('express');
const wrender = require('wrender');

const app = express();
app.use('/images', wrender());
```

----

### Compression Defaults

- All images are converted to JPEG and compressed at quality level 85.

- All EXIF data is stripped (including colour profiles).

- All images are converted to sRGB colour space.

- If include EXIF is set to true, all metadata is preserved, and an sRGB ICC colour profile is assigned.

- Cache headers are set expire 1 year in the future. Set your web server or CDN to respect the headers.

- Source images larger than 3000px in each dimension are not transformed and an error response is sent.

### Usage

```js

const wrender = require('wrender');

// Available options, all totally optional
const options = {

  // JPEG compression level to apply
  quality: 85, // Default

  // Optionally preserve original format
  convertGIF: true, // Default
  convertPNG: true, // Default

  // Include source image metadata
  includeEXIF: false, // Default

  // Maximum output image dimensions allowed
  maxWidth: 3000, // Default
  maxHeight: 3000, // Default

  // Response 'max age' cache header (seconds)
  maxAge: 31536000, // Default

  // Timeout for fetching source image
  timeout: 10000, // Default

  // Only allow specified UA
  userAgent: 'Amazon CloudFront',

  // Only allow specified image hosts
  // Uses Micromatch syntax
  hostWhitelist: [
    '**.giphy.com/**',
    's3.amazonaws.com',
  ],
  hostBlacklist: [
    'hack.thepla.net',
  ],

  // Only allow sources specified as rewrites below.
  // Disables all user-specified sources regardless of whitelist/blacklist
  rewritesOnly: false, // Default

  // Optionally you can hide the source from your URLs by rewriting them on the fly.
  // Added to the router in order.
  rewrites: [
    {
      // Match path (uses "path-to-regexp" same as Express)
      path: '/uploads/:source(.*)',

      // Source URI prefix. Protocol is optional and will default to `http://`
      origin: 'https://uploads-bucket.s3.amazonaws.com/workspace/uploads/',

      // Request options
      // https://github.com/request/request#requestoptions-callback
      request: {
        headers: {
          'X-Wrender-Token': '1234abcd',
        },
        qs: {
          foo: 'bar',
        },
        auth: {
          'user': 'username',
          'pass': 'password',
          'sendImmediately': false
        },
      },
    },

    // Example: Facebook profile pictures
    // This request: {wrender}/crop/100/60/fb/101203123/picture
    // Fetches the source from: http://graph.facebook.com/101203123/picture?width=1024&height=1024
    // And is then cropped to 100x60 as per the recipe
    {
      path: '/fb/:source(.*)',
      origin: 'graph.facebook.com/',
      qs: { width: 1024, height: 1024 },
    },

  ],

  // You can specify your own recipes, or use the pre-defined ones, or both!
  // Skip this property to use the default recipes
  recipes: [
    // You can pick recipes from wrender you want to use
    wrender.recipes.proxy,

    // You can pick recipes from wrender and pass them default values
    // Useful to hide options from the URLs
    {
      path: '/thumbnail/:source',
      recipe: wrender.invoke(wrender.recipes.resizex, { width: 150 }),
    },

    // You can also write your own synchronous recipes
    {
      path: '/rotate/:angle/:source',
      recipe(image, params) {
        image.rotate(parseInt(params.angle, 10));
      },
    },

    // You can also write your own asynchronous recipes
    {
      path: '/rotate/:angle/:source',
      recipe(image, params, next) {
        image.rotate(parseInt(params.angle, 10));
        next();
      },
    },
  ],

  // If you want to use our recipes AND your own, that's easy to do too:
  recipes: wrender.recipes.defaults.concat([
    {
      path: '/teeny/:source',
      recipe: wrender.invoke(wrender.recipes.crop, { height: 100, width: 100 }),
    }
  ])

};

// As part of your Express app
app.use('/images', wrender(options));
```

----

### Recipes

Different strategies for image handling are defined as the first parameter of the URL path.

`/:source` is a the path to the source image, excluding protocol. e.g. `/static.carthrottle.com/workspace/uploads/articles/dsc_6267-56ead06f7fda8.jpg`

If the path contains a query-string, encode the path first. e.g. `"/static.carthrottle.com%2Fworkspace%2Fuploads%2Farticles%2F%3Ffilename%3Ddsc_6267-56ead06f7fda8.jpg`

**Proxy**

`/proxy/:source`

Applies compression to the source image, but no other transformation.

**Resize**

`/resize/:width/:height/:source`

Resizes the source image with no respect to aspect ratio.

**Resize Width**

`/resizex/:width/:source`

Resizes the source image to the desired width, maintaining aspect ratio.

**Resize Height**

`/resizey/:height/:source`

Resizes the source image to the desired height, maintaining aspect ratio.

**Crop**

`/crop/:width/:height/:source`

Resizes the source image to the desired dimensions (maintaining aspect ratio), then performs a crop from the centre.

----

### TODO

**Recipes**

Expand the functionality of the image processing recipes. A list of Sharp's transformation methods can be found [here](http://sharp.dimens.io/en/stable/api-operation/).

**Tests**

The initial version is quite messy, everything is one file. I'd like to refactor it so that unit tests can be written for each stage of the process, and also have some end-to-end tests to check things like the response headers.
