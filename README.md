# Wrender

Image compression and transformation reverse-proxy for Express apps.

----

This library can be used to serve up compressed and transformed images from a high-resolution source (e.g. Amazon S3) suitable for caching and delivery by a CDN.

It is an open-source re-implementation of [Car Throttle](https://www.carthrottle.com/about/)'s image delivery service, which (running behind Cloudfront) handles hundreds of GBs and tens of millions of requests every day.

The image processing is extremely fast and is handled by [Sharp](https://github.com/lovell/sharp), which implements the [libvips](https://github.com/jcupitt/libvips) library as a native module. As such, Node.js [Streams](https://nodejs.org/api/stream.html) are used to abstract the handling of image data.

The recommended usage is part of a larger express-based application although a simple server is provided for example, testing and non-production environments. Rate-limiting, authentication, logging, and other such features can be implemented alongside and are not provided here.

----

### Roadmap

- [x] Pluggable recipes
- [ ] Pluggable origins
- [x] HTTP origin: Blacklist/whitelist
- [x] HTTP orign: Redirects, basic auth
- [ ] HTTP origin: support for TLS requests
- [ ] Dockerfile
- [x] Integration tests
- [ ] CI
- [ ] Origin: Private S3 buckets using IAM
- [ ] Recipe: Watermark/overlay

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
const express = require('express');
const wrender = require('wrender');

const app = express();

const instance = wrender({
  quality: 90,
  maxAge: 86400,
});

app.use('/images', instance);
```

For a complete example with full configuration object and defaults, see below.

----

### Built-in Recipes

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

### Full Example

```js
const wrender = require('wrender');

const instance = wrender({

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

  // You can specify your own recipes, or use the pre-defined ones, or both!
  // Skip this property to use the default recipes
  recipes: [

    // You can pick recipes from wrender you want to use
    wrender.recipes.proxy,
    wrender.recipes.resize,
    wrender.recipes.crop,
    wrender.recipes.resizex,
    wrender.recipes.resizey,

    // Or you can attach custom recipes (see documentation below)
    require('./myCustomRecipe'),

  ],

  // If you want to use our recipes AND your own, that's easy to do too:
  recipes: wrender.recipes.defaults.concat([
    wrender.createRecipe('/tiny/:source', wrender.invoke(wrender.recipes.resize, { height: 100, width: 100 }),
    wrender.createRecipe('/huge/:source', wrender.invoke(wrender.recipes.resize, { height: 1800, width: 2560 }),
  ])

  // Specify how images can be fetched from the origin.
  // Omit this property to use the HTTP origin (with no whitelist/blacklist).
  origins: [

    // Built-in origin.
    wrender.origins.http({
      // Only allow specified image hosts - Uses Micromatch syntax
      whitelist: [
        '**.giphy.com/**',
        's3.amazonaws.com',
      ],
      blacklist: [
        'hack.thepla.net',
      ],
    }),

    // Custom origins (see documentation below)
    facebookPictureOrigin: require('../origins/facebookPicture'),
    privateS3Origin: require('../origins/privateS3'),

  ],

});

app.use('/images', instance)
```

### Custom Recipes

Custom recipes are designed to allow the developer to customise the way in which images are transformed before being served to the client.

A custom recipe can be attached on any path on the server. A handler function is s

Recipes are created using the `wrender.createRecipe(path, handler)` method with the following arguments:

**path (String):**:

Specify a mount path using path-to-regexp style syntax, allowing you to create custom parameters with which to transform the image.

**handler (Function):**

A function which is given an `image` argument which is an instance of [Sharp](https://github.com/lovell/sharp), an object of URL parameters from the path, and an optional callback function.

### Recipe examples

You can pick recipes from wrender and pass them default values. This is useful for hiding options from the URLs to prevent denial of service:

```js
wrender.createRecipe('/thumbnail/:source', wrender.invoke(wrender.recipes.resizex, { width: 150 })
```

You can write your own synchronous recipes:

```js
wrender.createRecipe('/rotate/:angle/:source', (image, { angle }) => {
  image.rotate(parseInt(angle, 10));
})
```

You can also write your own asynchronous recipes:

```js
wrender.createRecipe('/rotate/:angle/:source', (image, { angle }, next) => {
  image.rotate(parseInt(angle, 10));
  next();
})
```

### Custom Origins

Custom origins are designed to allow the developer to customise the way in which images are fetched from their source.

Origins are created using the `wrender.createOrigin(path, handler)` method with the following arguments:

**path (String):**

Specify a mount path using path-to-regexp style syntax, allowing you to create custom parameters which can be used to resolve the source image.

**handler (Function):**

The handler function is a synchronous function which must return a [readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) object.

`wrender.request` can be used as a convenient way to create basic HTTP requests which resolve to a redable stream.

#### Origin Example: Facebook profile pictures

This request: `{wrender}/crop/100/60/fb/101203123`

Fetches the source from: `http://graph.facebook.com/101203123/picture?width=1024&height=1024` and is then cropped to 100x60 as per the recipe

```js
const wrender = require('wrender')

const origin = wrender.createOrigin('/fb/:profile_id', ({ profile_id }) => {
  return wrender.request(`http://graph.facebook.com/${profile_id}/picture?width=1024&height=1024`)
})

module.exports = origin
```

#### Origin Example: Private S3 Bucket

This request: `{wrender}/crop/100/60/users/uploads/2017/mypicture.jpg`

Fetches the source from: `http://user-uploads.someimportantcompany.com/uploads-2017/mypicture.jpg` and is then cropped to 100x60 as per the recipe

```js
const wrender = require('wrender')

const origin = wrender.createOrigin('/users/uploads/:year/:upload_path(.*)', ({ year, upload_path }) => {
  const s3opts = {
    Bucket: 'user-uploads.someimportantcompany.com',
    Key: `uploads-${year}/${upload_path}`,
  };
  return s3.getObject(s3opts).createReadStream(); // Assume `s3` is the result of `new AWS.S3(credentials)`
})

module.exports = origin
```
