# Gulp Cache Money
Cache money is a gulp plugin that only runs the plugin if any of the files have changed. It saves the cache to a file called '.gulp-cache'.

## Installation
Install via npm:

    $ npm install --save-dev gulp-cache-money


## Usage
Just add pass `cache` into the gulp chain right after you `src` your files.

```js
var cache = require("gulp-cache-money")({
    cacheFile: __dirname + "/.cache"
});

gulp.task(function() {
    gulp.src("index.js")
        .pipe(cache())
        .pipe(browserify())
        .dest("/build.js");
});
```

## `cached( options )`
This is the function exported from `gulp-cache-money`. Pass in an options object to configure the cache. The returned function is what you (call and) pass into your gulp build chain. `gulp-cache-money` works by md5'ing any incoming files and comparing the hashes, if the file hasn't changed it's remove from the `vinyl-fs` file stream and thus removed from any more processing.

### Options
* `cacheFile` -- The path to where you want to store you cache. Defaults to `.gulp-cache` in the directory of the entry file. (i.e. gulpfile.js)


### License & Author
Created and maintained by Adrian Cooney &lt;adrian.cooney@teamwork.com&gt;

The MIT License (MIT)

Copyright (c) <2015> <Teamwork.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.