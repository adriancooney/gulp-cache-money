var through = require("through2"), 
    crypto = require("crypto"),
    path = require("path"),
    fs = require("fs");

/**
 * Return a clean cache plugin with configuration.
 * @param  {Object} options :cacheFile -- The location of the cache file.
 * @return {Function}         The function to pass into your gulp chain.
 */
function Cached(options) {
    // local `cached` object to use in tests
    var cached = {
        // Merge the options with the defaults
        options: Cached.defaults(options || {}, Cached.options),

        // initialize cache object
        cache: {},

        // initialize `changes` attribute
        changes: false,
        
        toFile: toFile,
        fromFile: fromFile,
        changed: changed,
        onexit: onexit
    };

    /**
     * Write the cache to a file. (Synchronous)
     * @param  {String}   file     /path/to/cache
     */
    function toFile(file) {
        fs.writeFileSync(file, JSON.stringify(cached.cache));
    }

    /**
     * Import the cache from a file. (Synchronous)
     * @param  {String}   file     /path/to/cache
     */
    function fromFile(file) {
        cached.cache = JSON.parse(fs.readFileSync(file, "utf8"));
    }

    /**
     * Test whether a file has changed within the cache since last
     * time it was ran.
     *
     * @param  {String}   name     Name of the file. (unique)
     * @param  {ReadableStream}   stream   The readable file stream.
     * @param  {Function} callback Callback with (err, changed {boolean})
     */
    function changed(name, stream, callback) {
        Cached.sha(stream, function(err, hash) {
            if(err) return callback(err);

            // Get the old hash
            var currentHash = cached.cache[name];

            // Update the hash
            cached.cache[name] = hash;

            // Compare
            if(!currentHash || currentHash !== hash) {
                cached.changes = true;
                callback(null, true);
            } else callback(null, false);
        });
    }

    /**
     * Save the cache file on exit.
     */
    function onexit() {
        if(cached.changes) {
            try {
                toFile(cached.options.cacheFile);
            } catch(err) {
                console.warn("Unable to save cache file to %s.", cached.options.cacheFile);

                if(err.code === "ENOENT")
                    console.warn("The directory %s does not exist.", path.dirname(cached.options.cacheFile));
            }
        }
    }

    // Load the cache file if any, synchronously.
    if(fs.existsSync(cached.options.cacheFile))
        fromFile(cached.options.cacheFile);

    // Save the cache on exits and ctrl+c
    ["exit", "SIGINT"].forEach(function(event) {
        process.on(event, onexit);
    });

    // Return the stream function
    var plugin = function(options) {
        options = Cached.defaults(options || {}, {
            cascade: false
        });

        if(options.cascade) {
            options.files = [];
            options.changed = false;
        }

        var cacheHits = [];
        return through.obj(function(file, enc, callback) {
            var self = this;

            if(file.isNull() || file.isDirectory())
                return callback(null, file);

            // Ensure we have a stream
            var fileStream = through();

            // Pipe in the contents
            file.pipe(fileStream);

            // Test if the file has changed (sha regardless)
            changed(file.path, fileStream, function(err, changed) {

                // If something has already changed and changes are
                // cascading, just push on the file.
                if(options.cascade && options.changed) return callback(err, file)
                // If changes are cascading, we need to maintain a reference to all
                // the files in case changes happen in the future
                else if(options.cascade) {
                    options.files.push(file);

                    // Somethings changes, push all the files back into the stream
                    if(changed) {
                        options.changed = true;
                        options.files.forEach(function(file) {
                            // Push back the file
                            self.push(file);
                        });

                        // And continue
                        return callback(err);
                    }
                }

                // If the file has changed, push it on, otherwise don't bother
                else if(changed) return callback(err, file);

                // Cache hit!
                self.emit("cached", file.path);
                cacheHits.push(file.path);
                callback(err);
            });
        }, function(callback) {
            this.emit("cache-report", cacheHits);
            callback();
        });
    };

    // Add a reference to cached for testing
    plugin.cached = cached;

    return plugin;
}

/**
 * Gulp cache configuration options.
 * @static
 * @type {Object}
 */
Cached.options = {
    // The path to the cache file. Defaults to ".gulp-cache" in the same directory as the entry file
    cacheFile: path.join(path.dirname(require.main.filename), ".gulp-cache")
};

/**
 * SHA an incoming file stream.
 * @static
 * @param  {ReadableStream}   stream   The readable file stream.
 * @param  {Function} callback Callback with (err, shaHash)
 */
Cached.sha = function(stream, callback) {
    var hash = crypto.createHash("sha256");
    hash.setEncoding("hex");

    stream.on("error", callback)
        .on("end", function() {
            hash.end();
            callback(null, hash.read());
        });

    stream.pipe(hash)
};

/**
 * Merge options into a defaults object. (Options overwrite defaults)
 * @static
 * @param  {Object} options  Options object.
 * @param  {Object} defaults Defaults object.
 * @return {Object}          Defaults + Options
 */
Cached.defaults = function(options, defaults) {
    return Object.keys(defaults).reduce(function(options, key) {
        if(typeof options[key] === "undefined") options[key] = defaults[key];
        return options;
    }, options);
};

module.exports = Cached;