var through = require("through2"), 
    crypto = require("crypto"),
    path = require("path"),
    fs = require("fs");

function cached(options) {
    // Merge the options with the defaults
    cached.options = Object.keys(options || {}).reduce(function(defaults, key) {
        defaults[key] = options[key];
        return defaults;
    }, cached.options);

    // Load the cache file if any, synchronously.
    if(fs.existsSync(cached.options.cacheFile))
        cached.fromFile(cached.options.cacheFile);

    // Save the cache on exits and ctrl+c
    process.on("exit", cached.toFile.bind(null, cached.options.cacheFile));
    process.on("SIGINT", cached.toFile.bind(null, cached.options.cacheFile));

    // Return the stream function
    var callback = function() {
        return through.obj(function(file, enc, callback) {
            if (file.isNull()) {
                return callback(null, file);
            }

            // Ensure we have a stream
            var fileStream; 
            if(file.isStream()) fileStream = file.contents;
            else if(file.isBuffer()) {
                fileStream = through();
                fileStream.end(file.contents);
            }

            // Test if the file has changed
            cached.changed(file.path, fileStream, function(err, changed) {
                // If the file has changed, push it on, otherwise don't bother
                callback(err, changed ? file : null);
            });
        });
    };

    // Add a reference to cached for testing
    callback.cached = cached;

    return callback;
}

/**
 * Gulp cache configuration options.
 * @type {Object}
 */
cached.options = {
    // The path to the cache file. Defaults to ".gulp-cache" in the same directory as the entry file
    cacheFile: path.join(path.dirname(require.main.filename), ".gulp-cache")
};

/**
 * The cached object store.
 * @type {Object}
 */
cached.cache = {};

/**
 * Write the cache to a file. (Synchronous)
 * @param  {String}   file     /path/to/cache
 */
cached.toFile = function(file) {
    fs.writeFileSync(file, JSON.stringify(cached.cache));
};

/**
 * Import the cache from a file. (Synchronous)
 * @param  {String}   file     /path/to/cache
 */
cached.fromFile = function(file) {
    cached.cache = JSON.parse(fs.readFileSync(file, "utf8"));
};

/**
 * Test whether a file has changed within the cache since last
 * time it was ran.
 *     
 * @param  {String}   name     Name of the file. (unique)
 * @param  {ReadableStream}   stream   The readable file stream.
 * @param  {Function} callback Callback with (err, changed {boolean})
 */
cached.changed = function(name, stream, callback) {
    cached.md5(stream, function(err, hash) {
        if(err) return callback(err);

        // Get the old hash
        var currentHash = cached.cache[name];

        // Update the hash
        cached.cache[name] = hash;

        // Compare
        if(!currentHash || currentHash !== hash) callback(null, true);
        else callback(null, false);
    });
};

/**
 * MD5 an incoming file stream.
 * @param  {ReadableStream}   stream   The readable file stream.
 * @param  {Function} callback Callback with (err, md5Hash)
 */
cached.md5 = function(stream, callback) {
    var hash = crypto.createHash("md5");
    hash.setEncoding("hex");
    
    stream
        .on("error", callback)
        .on("end", function() {
            hash.end();
            callback(null, hash.read());
        });

    stream.pipe(hash)
};

module.exports = cached;