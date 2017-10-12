# Wrender

Image compression and transformation reverse-proxy for Express apps.

----

This library can be used to serve up compressed and transformed images from a high-resolution origin (e.g. Amazon S3) suitable for caching and delivery by a CDN.

It is an open-source re-implementation of [Car Throttle](https://www.carthrottle.com/about/)'s image delivery service, which (running behind Cloudfront) handles hundreds of GBs and tens of millions of requests every day.

The image processing is extremely fast and is handled by [Sharp](https://github.com/lovell/sharp), which implements the [libvips](https://github.com/jcupitt/libvips) library as a native module. As such, Node.js [Streams](https://nodejs.org/api/stream.html) are used to abstract the handling of image data.

The recommended usage is part of a larger [express](https://expressjs.com)-based application although a simple server is provided for example, testing and non-production environments. Rate-limiting, authentication, logging, and other such features are best implemented alongside with relevant packages and therefore are not provided here, although we do present a few examples to better demonstrate certain use-cases.

## Compression Defaults

- All images are converted to JPEG and compressed at quality level 85.

- All EXIF data is stripped (including colour profiles).

- All images are converted to sRGB colour space.

- If include EXIF is set to true, all metadata is preserved, and an sRGB ICC colour profile is assigned.

- Cache headers are set expire 1 year in the future. Set your web server or CDN to respect the headers.

- Source images larger than 3000px in each dimension are not transformed and an error response is sent.

## Usage

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

## Recipes

Different strategies for image handling are defined as the first parameter of the URL path. All recipe paths contain `/:origin`, which refers to the specific origin the client wishes to use. Failure to end your recipe with `/:origin` will result in an error being thrown, so ideally you should configure recipes on boot. For example, a recipe of `/hello/:origin` would match:

```
/hello/https://static.carthrottle.com/workspace/uploads/articles/dsc_6267-56ead06f7fda8.jpg
# Note the protocol, that's important to allow HTTPS origins
# If the origin contains a query string, you must encode the URL first:
`/hello/http%3A%2F%2Fstatic.carthrottle.com%2Fworkspace%2Fuploads%2Farticles%2F%3Ffilename%3Ddsc_6267-56ead06f7fda8.jpg`
```

### Built-in recipes

These are the recipes that are attached if you omit `recipes` from the config object you supply to `wrender`.

- **Proxy**
  - Exposed at `wrender.recipes.proxy`
  - The default path is `/proxy/:origin`
  - Applies compression to the source image, but no other transformations.
- **Resize**
  - Exposed at `wrender.recipes.resize`
  - The default path is `/resize/:width/:height/:origin`
  - You can also resize by `:width` or `:height`, whilst maintaining the aspect ratio, by setting either `:width` or `:height` to `0`.
- **Crop**
  - Exposed at `wrender.recipes.crop`
  - The default path is `/crop/:width/:height/:origin`
  - Resizes the source image to the desired dimensions (maintaining aspect ratio), then performs a crop from the centre.

## API

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

    // Or you can attach custom recipes (see documentation below)
    wrender.createRecipe('/mirror/:origin', image => {
      wrender.invokeRecipe(wrender.recipes.resize, image, { width: 200, height: 200 });
      image.flop();
    }),
  ],

  // If you want to use our recipes AND your own, that's easy to do too:
  // recipes: Object.keys(wrender.recipes).map(k => wrender.recipes[k]).concat([
  //   wrender.createRecipe('/tiny/:origin', image => {
  //     wrender.invokeRecipe(wrender.recipes.resize, image, { width: 100, height: 100 });
  //   }),
  //   wrender.createRecipe('/huge/:origin', image => {
  //     wrender.invokeRecipe(wrender.recipes.resize, image, { height: 1800, width: 2560 });
  //   }),
  // ]),

  // Specify how images can be fetched from the origin.
  origins: [

    wrender.origins.http({
      // Prefix the origin to allow multiple endpoints
      prefix: '/http',

      // Since the HTTP origin is based on Request, you can provide an object of defaults
      // Underneath this will trigger `request.defaults` in an attempt to keep performance high
      defaults: {
        auth: { user: 'dan-kmemes-7312@hotmail.com', pass: 'correct-horse-battery-staple' },
      },
    }),

    wrender.origins.fs({
      // Prefix the origin as appropriate
      prefix: '/fs',
      // Pull data from a particular mount point
      mount: '/data',
    }),

    // Custom origins (see documentation below)
    wrender.createOrigin('/s3/:Bucket/:Key(*)', ({ source }) => {
      // const s3 = new AWS.S3({ region: 'us-east-1' });
      return s3.getObject({ Bucket, Key }).createReadStream();
    });

    // The default origin is HTTP, but without a prefix it acts as a catch-all
    wrender.origins.http(),
  ],
});

app.use('/images', instance);
/**
 * Available recipes:
 * - /proxy/:origin
 * - /resize/:width/:height/:origin
 * - /crop/:width/:height/:origin
 *
 * Available origins:
 * - /http/:url
 * - /fs/:path
 * - /s3/:Bucket/:Key
 *
 * All together, available routes are, noting that the instance is mounted to "/images":
 * - /images/proxy/http/:url
 * - /images/proxy/fs/:path
 * - /images/proxy/s3/:Bucket/:Key
 * - /images/resize/:width/:height/http/:url
 * - /images/resize/:width/:height/fs/:path
 * - /images/resize/:width/:height/s3/:Bucket/:Key
 * - /images/crop/:width/:height/http/:url
 * - /images/crop/:width/:height/fs/:path
 * - /images/crop/:width/:height/s3/:Bucket/:Key
 */
```

## Custom Recipes

Custom recipes are designed to allow you complete customisation of how images are transformed before being served to the client, by using [the Sharp API](http://sharp.dimens.io/en/stable/api-operation).

Recipes are created using the `wrender.createRecipe` method with the following arguments:

```js
wrender.createRecipe(path, handler)
// Where `path` is a string defining the first part of the mount point, ending in /:origin
// Where `handler` is a synchronous function, with the arguments (image, params)
//   `image` is the Sharp instance, for you to instruct the transformation
//   `params` is the req.params, which contain the variables in the route that you set with `path`
```

### Recipe examples

Asynchronous recipes are not supported. If you're looking to do an asynchronous operation with your recipe, consider using [the underlying `sharp` package](https://npm.im/sharp).

```js
wrender.createRecipe('/mirror/:origin', image => {
  wrender.invokeRecipe(wrender.recipes.resize, image, { width: 200, height: 200 });
  image.flop();
})
```

This recipe will resize the image using the built-in resize recipe, to 200x200, then flop the image about the horizontal X axis, as [discussed in the Sharp API operation docs](http://sharp.dimens.io/en/stable/api-operation/#flop).

```js
wrender.createRecipe('/thumbnail/:source', image => wrender.invoke(wrender.recipes.resize, image, { width: 150 }))
```

By using `wrender.invokeRecipe(recipe, image, [params])` you can call existing recipes with pre-defined values. This is useful if you wish to hide options from the URLs to prevent undesired costs or DoS attacks:

```js
const watermark = new Buffer('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

wrender.createRecipe('/watermark/:origin', image => {
  wrender.invokeRecipe(wrender.recipes.resize, image, { width: 200, height: 200 });
  image.overlayWith(watermark, { gravity: 'northeast', top: 0 });
})
```

Following [the overlayWith docs](http://sharp.dimens.io/en/stable/api-composite/#overlaywith), we can see how we would implement a watermark recipe.

## Custom Origins

Not every use-case involves fetching information from a public-facing image endpoint. Therefore *wrender* support custom origins, which can also be used to obfuscate the source of your images.

Origins are created using the `wrender.createOrigin` method with the following arguments:

```js
wrender.createOrigin(path, handler)
// Where `path` is a string defining the last part of the mount point
// Where `handler` is a synchronous function, with the arguments (params)
// Or `handler` can be an asynchronous function with the arguments (params, callback)
//   `params` is the req.params, which contain the variables in the route that you set with `path`
//   `callback` is your familiar node callback (err, stream)
```

Ensure params in your origin paths are unique to your origin, as conflicting params with recipes will lead to unexpected behaviours. For example, a recipe with `/resize/:width/:height/:origin` and an origin with `/fb/:width/:profile_id` will lead to `/resize/:width/:height/fb/:width/:profile_id`. Not good!

`handler` expects [a readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) to be returned, either by returning (synchronously) or by a callback (asynchronously), ready to be piped into a temporary file & transformed by the recipe.

### Origin examples

#### Whitelist/blacklist HTTP origins

Sometimes you might want to run your HTTP(S) origins through a whitelist/blacklist, to ensure only origins you allow (or prevent origins you disallow) from being hit by your *wrender*  instance.

```js
const micromatch = require('micromatch');
const request = require('request');
const url = require('url');

function createHTTPOriginWithBlacklist(opts) {
  if (typeof opts === 'string') opts = { prefix: opts };
  opts = opts || {};

  const req = request.defaults(Object.assign({}, opts.defaults || {}, { followRedirect: false }));

  const isBlacklisted = (({ whitelist, blacklist }) => {
    if (Array.isArray(whitelist) && whitelist.length) {
      return source => !micromatch.any(url.parse(source).hostname, whitelist);
    }
    else if (Array.isArray(blacklist) && blacklist.length) {
      return source => micromatch.any(url.parse(source).hostname, blacklist);
    }
    else {
      return () => false;
    }
  })(opts);

  return wrender.createOrigin(`${opts.prefix || ''}/:source(*)`, function makeRequest({ source }, callback) {
    if (isBlacklisted(source)) return callback(new Error(`${source} is not a valid remote URL`));

    const stream = req(source);
    stream.on('response', res => {
      if (res.statusCode >= 301 && res.statusCode <= 303 && res.headers.location) {
        makeRequest({ source: res.headers.location }, callback);
      } else if (res.statusCode !== 200 && res.statusCode !== 304) {
        callback(new Error(`${res.statusCode} response from ${source}`));
      } else {
        callback(null, stream);
      }
    });
  });
}

app.use('/images', wrender({
  origins: [
    createHTTPOriginWithBlacklist({
      // Only allow specified image hosts - uses micromatch syntax
      whitelist: [ '**.giphy.com/**', 's3.amazonaws.com' ],
      // Or blacklist specific image hosts - again, micromatch syntax
      blacklist: [ 'hack.thepla.net' ],
    }),
  ],
}));

// => /images/proxy/https://s3.amazonaws.com/user-uploads.someimportantcompany.com/profiles/1505c30c51bb93545db48919b3cce7f9.jpg
//   => Will succeed, since s3.amazonaws.com is in the whitelist
// => /images/proxy/https://i.imgur.com/cl4Bu.gif
//   => Will fail, since i.imgur.com isn't in the whitelist
// => /images/proxy/https://hack.thepla.net/evilcorp.exe
//   => Hasn't got a chance, since it's not in the whitelist, and irrelevantly isn't in the blacklist
//   => In this example, you would need to remove the whitelist array in order to only use the blacklist
```

We don't implement this, but as you can see from above it's relatively straightforward since `createOrigin` allows asynchronous functions.

#### Private S3 Buckets

```js
const AWS = require('aws-sdk');

const s3 = new AWS.S3({ region: 'us-east-1' });

app.use('/images', wrender({
  origins: [
    wrender.createOrigin('/s3/:Bucket/:Key(*)', ({ Bucket, Key }) => s3.getObject({ Bucket, Key }).createReadStream());
  ],
}));

// => /images/proxy/s3/user-uploads.someimportantcompany.com/profiles/1505c30c51bb93545db48919b3cce7f9.jpg
//   => Streams from S3, as long as the s3 instance has the correct permissions
//   => Super-effective with EC2 instance roles & ECS task roles
```

#### Facebook Profile Pictures

```js
const request = require('request')

app.use('/images', wrender({
  origins: [
    wrender.createOrigin('/fb/:profile_id', ({ profile_id }) => {
      return request(`https://graph.facebook.com/${profile_id}/picture?width=1024&height=1024`);
    }),
  ],
}));

// => /images/proxy/fb/113741208636938
//   => https://graph.facebook.com/113741208636938/picture?width=1024&height=1024
```

This is also a good example for using custom origins to rewrite URLs.

## Roadmap

- [x] Pluggable recipes
- [x] Pluggable origins
- [x] ~~HTTP origin: Blacklist/whitelist~~
- [x] HTTP orign: Redirects, basic auth
- [x] HTTP origin: support for TLS requests
- [ ] Dockerfile
- [ ] Integration tests
- [ ] CI
- [x] Origin: Private S3 buckets using IAM
- [x] Recipe: Watermark/overlay
