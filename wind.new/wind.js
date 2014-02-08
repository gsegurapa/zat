(function() {
    "use strict";

    var INTENSITY_SCALE_STEP = 10;            // step size of particle intensity color scale
    var MAX_WIND_INTENSITY = 17;              // wind velocity at which particle intensity is maximum (m/s)
    var PARTICLE_MULTIPLIER = 7;              // particle count scalar (completely arbitrary--this values looks nice)


    var view = (function() {
            var w = window;
            var d = document && document.documentElement;
            var b = document && document.getElementsByTagName("body")[0];
            var x = w.innerWidth || d.clientWidth || b.clientWidth;
            var y = w.innerHeight || d.clientHeight || b.clientHeight;
            return {width: x, height: y};
        })();

    var cancel; // !!! need to figure out what to do about this

    function distortion(projection, λ, φ, x, y) {
        var hλ = λ < 0 ? H : -H;
        var hφ = φ < 0 ? H : -H;
        var pλ = projection([λ + hλ, φ]);
        var pφ = projection([λ, φ + hφ]);

        // Meridian scale factor (see Snyder, equation 4-3), where R = 1. This handles issue where length of 1º λ
        // changes depending on φ. Without this, there is a pinching effect at the poles.
        var k = Math.cos(φ / 360 * τ);

        return [
            (pλ[0] - x) / hλ / k,
            (pλ[1] - y) / hλ / k,
            (pφ[0] - x) / hφ,
            (pφ[1] - y) / hφ
        ];
    }

    /**
     * @returns {Object} clears and returns the specified Canvas element's 2d context.
     */
    function clearCanvas(canvas) {
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        return canvas;
    }

    /**
     * @returns {Array} of wind colors and a method, indexFor, that maps wind magnitude to an index on the color scale.
     */
    function windIntensityColorScale(step, maxWind) {
        var result = [];
        for (var j = 85; j <= 255; j += step) {
            result.push(asColorStyle(j, j, j, 1.0));
        }
        result.indexFor = function(m) {  // map wind speed to a style
            return Math.floor(Math.min(m, maxWind) / maxWind * (result.length - 1));
        };
        return result;
    }

    // Some hacky stuff to ensure only one layer can be downloaded at a time.
    var nextId = 0;
    var downloadsInProgress = {};
    // !!! this must be rewritten
    function buildGrid(layer) {
        report.status("Downloading...");
        // var cancel = this.cancel;
        var id = nextId++;
        var task = µ.loadJson(layer).then(function(data) {
            if (cancel.requested) return null;
            log.time("build grid");
            var result = layers.buildGrid(data);
            log.timeEnd("build grid");
            return result;
        }).ensure(function() { delete downloadsInProgress[id]; });

        downloadsInProgress[id] = task;
        return task;
    }


    function animate(globe, field) {
        if (!globe || !field) { return; }

        // var cancel = this.cancel;
        var bounds = globe.bounds(view);
        var colorStyles = windIntensityColorScale(INTENSITY_SCALE_STEP, MAX_WIND_INTENSITY);
        var buckets = colorStyles.map(function() { return []; });
        var particleCount = Math.round(bounds.width * PARTICLE_MULTIPLIER);
        // if (µ.isMobile()) {
        //     particleCount *= PARTICLE_REDUCTION;
        // }
        // var fadeFillStyle = µ.isFF() ? "rgba(0, 0, 0, 0.95)" : "rgba(0, 0, 0, 0.97)";  // FF Mac alpha behaves oddly
        var fadeFillStyle = 'rgba(0, 0, 0, 0.5)';

        log.debug("particle count: " + particleCount);
        var particles = [];
        for (var i = 0; i < particleCount; i++) {
            particles.push(field.randomize({age: _.random(0, MAX_PARTICLE_AGE)}));
        }

        function evolve() {
            buckets.forEach(function(bucket) { bucket.length = 0; });
            particles.forEach(function(particle) {
                if (particle.age > MAX_PARTICLE_AGE) {
                    field.randomize(particle).age = 0;
                }
                var x = particle.x;
                var y = particle.y;
                var v = field(x, y);  // vector at current position
                var m = v[2];
                if (m === null) {
                    particle.age = MAX_PARTICLE_AGE;  // particle has escaped the grid, never to return...
                }
                else {
                    var xt = x + v[0];
                    var yt = y + v[1];
                    if (field(xt, yt)[2] !== null) {
                        // Path from (x,y) to (xt,yt) is visible, so add this particle to the appropriate draw bucket.
                        particle.xt = xt;
                        particle.yt = yt;
                        buckets[colorStyles.indexFor(m)].push(particle);
                    }
                    else {
                        // Particle isn't visible, but it still moves through the field.
                        particle.x = xt;
                        particle.y = yt;
                    }
                }
                particle.age += 1;
            });
        }

        var g = d3.select("#animation").node().getContext("2d");
        g.lineWidth = PARTICLE_LINE_WIDTH;
        g.fillStyle = fadeFillStyle;

        function draw() {
            // Fade existing particle trails.
            var prev = g.globalCompositeOperation;
            g.globalCompositeOperation = "destination-in";
            g.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            g.globalCompositeOperation = prev;

            // Draw new particle trails.
            buckets.forEach(function(bucket, i) {
                if (bucket.length > 0) {
                    g.beginPath();
                    g.strokeStyle = colorStyles[i];
                    bucket.forEach(function(particle) {
                        g.moveTo(particle.x, particle.y);
                        g.lineTo(particle.xt, particle.yt);
                        particle.x = particle.xt;
                        particle.y = particle.yt;
                    });
                    g.stroke();
                }
            });
        }

        (function frame() {
            try {
                if (cancel.requested) {
                    field.release();
                    return;
                }
                evolve();
                draw();
                setTimeout(frame, FRAME_RATE);
            }
            catch (e) {
                report.error(e);
            }
        })();
    }

    // contents of grids.js ------------------------------------------------

    /**
     * grids - interpolates grids of weather data
     *
     * Copyright (c) 2014 Cameron Beccario
     * The MIT License - http://opensource.org/licenses/MIT
     *
     * https://github.com/cambecc/earth
     */
    var layers = function() {

        var LAYER_RECIPES = {
            wi10: {
                name: "wind-isobaric-10hPa",
                description: "Wind Velocity @ 10 hPa"
            },
            wi70: {
                name: "wind-isobaric-70hPa",
                description: "Wind Velocity @ 70 hPa"
            },
            wi250: {
                name: "wind-isobaric-250hPa",
                description: "Wind Velocity @ 250 hPa"
            },
            wi500: {
                name: "wind-isobaric-500hPa",
                description: "Wind Velocity @ 500 hPa"
            },
            wi700: {
                name: "wind-isobaric-700hPa",
                description: "Wind Velocity @ 700 hPa"
            },
            wi850: {
                name: "wind-isobaric-850hPa",
                description: "Wind Velocity @ 850 hPa"
            },
            wi1000: {
                name: "wind-isobaric-1000hPa",
                description: "Wind Velocity @ 1000 hPa"
            }
        };

        function recipeFor(type) {
            return _.findWhere(_.values(LAYER_RECIPES), {name: [type.param, type.surface, type.level] .join("-")});
        }

        /**
         * @returns {Number} returns remainder of floored division, i.e., floor(a / n). Useful for consistent modulo
         *          of negative numbers. See http://en.wikipedia.org/wiki/Modulo_operation.
         */
        function floorMod(a, n) {
            return a - n * Math.floor(a / n);
        }

        function bilinear(x, y, g00, g10, g01, g11) {
            var a = (1 - x) * (1 - y);
            var b = x * (1 - y);
            var c = (1 - x) * y;
            var d = x * y;
            var u = g00[0] * a + g10[0] * b + g01[0] * c + g11[0] * d;
            var v = g00[1] * a + g10[1] * b + g01[1] * c + g11[1] * d;
            return [u, v, Math.sqrt(u * u + v * v)];
        }

        /**
         * Builds an interpolator for the specified data in the form of JSON-ified GRIB files. Example:
         *
         *     [
         *       {
         *         "header": {
         *           "refTime": "2013-11-30T18:00:00.000Z",
         *           "parameterNumber": 2,
         *           "forecastTime": 6,
         *           "scanMode": 0,
         *           "nx": 360,
         *           "ny": 181,
         *           "lo1": 0,
         *           "la1": 90,
         *           "lo2": 359,
         *           "la2": -90,
         *           "dx": 1,
         *           "dy": 1
         *         },
         *         "data": [3.42, 3.31, 3.19, 3.08, 2.96, 2.84, 2.72, 2.6, 2.47, ...]
         *       }
         *     ]
         *
         */
        function buildGrid(data) {

            var uRecord = null, vRecord = null;
            for (var r = 0; r < data.length; r++) {
                var record = data[r];
                switch (record.header.parameterNumber) {
                    case 2: uRecord = record; break; // U-component_of_wind
                    case 3: vRecord = record; break; // V-component_of_wind
                }
            }
            if (!uRecord || !vRecord) {
                return when.reject("Failed to find both u,v component records");
            }

            var header = uRecord.header;
            var λ0 = header.lo1, φ0 = header.la1;  // the grid's origin (e.g., 0.0E, 90.0N)
            var Δλ = header.dx, Δφ = header.dy;    // distance between grid points (e.g., 2.5 deg lon, 2.5 deg lat)
            var ni = header.nx, nj = header.ny;    // number of grid points W-E and N-S (e.g., 144 x 73)
            var uData = uRecord.data, vData = vRecord.data;
            if (uData.length != vData.length) {
                return when.reject("Mismatched data point lengths");
            }
            var date = new Date(header.refTime);
            date.setHours(date.getHours() + header.forecastTime);

            // Scan mode 0 assumed. Longitude increases from λ0, and latitude decreases from φ0.
            // http://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_table3-4.shtml
            var grid = [], p = 0;
            var isContinuous = Math.floor(ni * Δλ) >= 360;
            for (var j = 0; j < nj; j++) {
                var row = [];
                for (var i = 0; i < ni; i++, p++) {
                    row[i] = [uData[p], vData[p]];
                }
                if (isContinuous) {
                    // For wrapped grids, duplicate first column as last column to simplify interpolation logic
                    row.push(row[0]);
                }
                grid[j] = row;
            }

            function interpolate(λ, φ) {
                var i = µ.floorMod(λ - λ0, 360) / Δλ;  // calculate longitude index in wrapped range [0, 360)
                var j = (φ0 - φ) / Δφ;                 // calculate latitude index in direction +90 to -90

                //         1      2           After converting λ and φ to fractional grid indexes i and j, we find the
                //        fi  i   ci          four points "G" that enclose point (i, j). These points are at the four
                //         | =1.4 |           corners specified by the floor and ceiling of i and j. For example, given
                //      ---G--|---G--- fj 8   i = 1.4 and j = 8.3, the four surrounding grid points are (1, 8), (2, 8),
                //    j ___|_ .   |           (1, 9) and (2, 9).
                //  =8.3   |      |
                //      ---G------G--- cj 9   Note that for wrapped grids, the first column is duplicated as the last
                //         |      |           column, so the index ci can be used without taking a modulo.

                var fi = Math.floor(i), ci = fi + 1;
                var fj = Math.floor(j), cj = fj + 1;

                var row;
                if ((row = grid[fj])) {
                    var g00 = row[fi];
                    var g10 = row[ci];
                    if (g00 && g10 && (row = grid[cj])) {
                        var g01 = row[fi];
                        var g11 = row[ci];
                        if (g01 && g11) {
                            // All four points found, so use bilinear interpolation to calculate the wind vector.
                            return bilinear(i - fi, j - fj, g00, g10, g01, g11);
                        }
                    }
                }
                // console.log("cannot interpolate: " + λ + "," + φ + ": " + fi + " " + ci + " " + fj + " " + cj);
                return null;
            }

            return {
                date: date,
                interpolate: interpolate
            };
        }

        return {
            buildGrid: buildGrid,
            recipeFor: recipeFor
        };

    }();



})();
