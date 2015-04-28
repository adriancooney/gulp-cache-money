var path = require("path"),
    fs = require("fs"),
    assert = require("assert"),
    vfs = require("vinyl-fs"),
    through = require("through2");

const TEST_DIR = __dirname;
const EXAMPLE_FILE = path.join(TEST_DIR, "example.txt");
const CACHE_FILE = path.join(TEST_DIR, "cache.json");

describe("Cached", function() {
    var cache, cached;

    describe("Configuration", function() {
        it("should correctly require configure cached", function() {
            cache = require("../")({ cacheFile: CACHE_FILE });
            cached = cache.cached; // Extract reference to cached

            assert(cached.options);
            assert(typeof cached === "function");
            assert.equal(cached.options.cacheFile, CACHE_FILE);
        });
    });

    describe(".defaults", function() {
        it("should correctly merge options and defaults", function() {
            var options = { foo: "bar" },
                defaults = { foo: "wuggles", bar: "foo" };

            options = cached.defaults(options, defaults);

            assert.equal(options.bar, "foo");
            assert.equal(options.foo, "bar");
        });
    });

    describe(".md5", function() {

        before(function(done) {
            fs.writeFile(EXAMPLE_FILE, "Hello World!\n", done);
        });

        it("should md5 a stream and return the hash", function(done) {
            cached.md5(fs.createReadStream(EXAMPLE_FILE), function(err, hash) {
                if(err) return done(err);

                assert.equal(hash, "8ddd8be4b179a529afa5f2ffae4b9858");
                done();
            });
        });

        after(function(done) {
            fs.unlink(EXAMPLE_FILE, done);
        });
    });

    describe(".toFile/.fromFile", function() {

        before(function() {
            cached.cache = {};
        });

        it("should write the cache to a file.", function() {
            cached.cache["foo"] = "bar";
            cached.toFile(CACHE_FILE);
        });

        it("should read the cache file", function() {
            cached.fromFile(CACHE_FILE);
            assert(cached.cache.foo === "bar");
        });

        after(function(done) {
            fs.unlink(CACHE_FILE, done);
        });
    });

    describe("cache", function() {
        describe("Non cascading changes", function() {
            var pipeExample = pipe.bind(null, EXAMPLE_FILE, {});

            before(function(done) {
                fs.writeFile(EXAMPLE_FILE, "Hello World!\n", done);
            });

            it("should test whether or not a file has changed", function(done) {
                pipeExample(function(files) {
                    assert.equal(files.length, 1);
                    pipeExample(function(files) {
                        assert.equal(files.length, 0);
                        done();
                    });
                })
            });

            after(function(done) {
                fs.unlink(EXAMPLE_FILE, done);
            });
        });

        describe("Cascading changes", function() {
            var pipeTextfiles = pipe.bind(null, path.join(TEST_DIR, "*.txt"), { cascade: true }),
                fileCount = 5;

            before(function() {
                // Remove anything about `files` in the cache
                Object.keys(cached.cache).forEach(function(key) {
                    if(key.match(/file\d\.txt$/)) delete cached.cache[key];
                });

                // Create the random files
                for(var i = 0; i < fileCount; i++)
                    fs.writeFileSync(path.join(TEST_DIR, "file" + i + ".txt"), Math.random() + "");
            });

            it("should correctly cascade have all files when changes cascade", function(done) {
                pipeTextfiles(function(files) {
                    assert.equal(files.length, fileCount, "[1st] Initial cache run has correct amount of passed files.");
                    // Make a change
                    fs.writeFileSync(path.join(TEST_DIR, "file" + (fileCount - 1) + ".txt"), Math.random() + "");

                    pipeTextfiles(function(files) {
                        // Make sure we have all the files again
                        assert.equal(files.length, fileCount, "[2nd] Cache run after change has correct amount of files.");

                        pipeTextfiles(function(files) {
                            // With not changes, we should have zero files
                            assert.equal(files.length, 0, "[3rd] Cache re-run after changes has correct amount of files.");
                            done();
                        });
                    })
                });
            });

            after(function() {
                // Clean up
                fs.readdirSync(TEST_DIR).forEach(function(entry) {
                    if(entry.match(/\.txt$/)) fs.unlinkSync(path.join(TEST_DIR, entry));
                });
            });
        });


        function pipe(src, opts, callback) {
            var files = [], bytes;
            var chain = vfs.src(src)
                .pipe(cache(opts))
                .pipe(through.obj(function(file, enc, callback) {
                    files.push(file);
                    callback(null, file);
                }));
                
            chain.on("end", callback.bind(null, files));

            // Drain the stream
            chain.on("data", function() {});
        }
    });
});