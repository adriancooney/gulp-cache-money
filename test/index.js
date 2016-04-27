var path = require("path"),
    fs = require("fs"),
    assert = require("assert"),
    vfs = require("vinyl-fs"),
    through = require("through2"),
    gulp = require("gulp");

const TEST_DIR = __dirname;
const EXAMPLE_FILE = path.join(TEST_DIR, "example.txt");
const CACHE_FILE = path.join(TEST_DIR, "cache.json");
const CACHE_FILE_2 = path.join(TEST_DIR, "cache2.json");

describe("Cached", function() {
    var Cached = require("../");
    var cache, cached;

    describe("Configuration", function() {
        it("should correctly require configure cached", function() {
            cache = Cached({ cacheFile: CACHE_FILE });
            cached = cache.cached; // Extract reference to cached

            assert(cached.options);
            assert(typeof cached === "object");
            assert.equal(cached.options.cacheFile, CACHE_FILE);
        });

        it("should correctly configure two separate cached methods", function() {
            cache1 = Cached({ cacheFile: CACHE_FILE });
            cached1 = cache1.cached; // Extract reference to cached

            cache2 = Cached({ cacheFile: CACHE_FILE_2 });
            cached2 = cache2.cached; // Extract reference to cached

            assert(cached1.options);
            assert(typeof cached1 === "object");
            assert.equal(cached1.options.cacheFile, CACHE_FILE);

            assert(cached2.options);
            assert(typeof cached2 === "object");
            assert.equal(cached2.options.cacheFile, CACHE_FILE_2);
        });
    });

    describe(".defaults", function() {
        it("should correctly merge options and defaults", function() {
            var options = { foo: "bar" },
                defaults = { foo: "wuggles", bar: "foo" };

            options = Cached.defaults(options, defaults);

            assert.equal(options.bar, "foo");
            assert.equal(options.foo, "bar");
        });
    });

    describe(".sha", function() {

        before(function(done) {
            fs.writeFile(EXAMPLE_FILE, "Hello World!\n", done);
        });

        it("should SHA a stream and return the hash", function(done) {
            Cached.sha(fs.createReadStream(EXAMPLE_FILE), function(err, hash) {
                if(err) return done(err);

                assert.equal(hash, "03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340");
                done();
            });
        });

        after(function(done) {
            fs.unlink(EXAMPLE_FILE, done);
        });
    });

    describe(".toFile/.fromFile", function() {

        before(function() {
            cache = Cached({ cacheFile: CACHE_FILE });
            cached = cache.cached; // Extract reference to cached
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

    describe("onexit", function() {
        var tempCache = __dirname + "/cache-temp.json";

        it("should save the cache file on changes", function() {
            cached.changes = true;
            cached.options.cacheFile = tempCache
            cached.onexit();
            assert(fs.existsSync(tempCache));
        });

        it("should not throw an error if the cache directory does not exist", function() {
            cached.options.cacheFile = __dirname + "unknown-dir/FOO-BOO";
            cached.onexit();
        });

        after(function(done) {
            fs.unlink(tempCache, done);
            cached.changes = false;
        });
    });

    describe("stream continuation", function() {
        before(function() {
            for(var i = 0; i < 5; i++) fs.writeFileSync(path.join(__dirname, i + "-file.txt"), "Hello world!");
        });

        it("should still continue with the stream even if no files", function(done) {
            var trial = 1, output = [];

            gulp.task("example-task", function() {
                console.log("Running task 'example-task'.")

                var files = [];
                return gulp.src(__dirname + "/*.txt")
                    .pipe(cache())
                    .pipe(through.obj(function(file, enc, callback) {
                        files.push(file);
                        callback(null, file);
                    }, function(callback) {
                        console.log("%d files in #%s passthrough.", files.length, trial);
                        callback();
                    }));
            });

            gulp.task("another-task", ["example-task"], function(next) {
                trial++;

                console.log("Running task 'another-task'.");
                if(trial <= 3) {
                    next();
                    gulp.start(["another-task"]);
                } else done();
            })

            gulp.start(["another-task"]);
        });

        after(function() {
            fs.readdirSync(__dirname).filter(function(entry) {
                return entry.match(/\d-file\.txt/);
            }).forEach(function(file) {
                fs.unlinkSync(path.join(__dirname, file));
            });
        });
    });
});