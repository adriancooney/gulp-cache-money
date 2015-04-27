var path = require("path"),
    fs = require("fs"),
    assert = require("assert"),
    vfs = require("vinyl-fs"),
    through = require("through2");

const EXAMPLE_FILE = path.join(__dirname, "example.txt");
const CACHE_FILE = path.join(__dirname, "cache.json");

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

        it("should have loaded an existing cache file", function() {
            // The existing cache file is checked into git
            // so it will always be there. Forever.
            assert(cached.cache[EXAMPLE_FILE]);
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

    describe("cached", function() {
        before(function(done) {
            fs.writeFile(EXAMPLE_FILE, "Hello World!\n", done);
        });

        it("should test whether or not a file has changed", function(done) {
            pipe(function(files) {
                assert.equal(files.length, 1);
                pipe(function(files) {
                    assert.equal(files.length, 0);
                    done();
                });
            })
        });

        after(function(done) {
            fs.unlink(EXAMPLE_FILE, done);
        })

        function pipe(callback) {
            var files = [], bytes;
            var chain = vfs.src(EXAMPLE_FILE)
                .pipe(cache())
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