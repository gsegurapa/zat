(function($){
  "use strict";

  var appId = 'fc5d0d2b';
  var appKey = 'd3236520871e1ab3e5f748af515029a8';

  var airline = 'AS'; // default is alaska
  var airports;

  function getParams(st) {
    
    var p = {}; // parameters
    st.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { p[key] = value; });

    if (p.airline) { airline = p.airline; }
  }

  getParams(window.location.href); // params from URL override
	
	var earth = planetaryjs.planet();
	earth.loadPlugin(planetaryjs.plugins.earth({
    topojson: { file: '../world-110m-withlakes.json' },
    oceans: { fill: '#248'},
    land: { fill: '#284', shadow: { shadowOffsetX: 2, shadowOffsetY: 2, shadowColor: 'black' } },
    borders: { stroke: '#000'}
	}));
	earth.loadPlugin(lakes({
    fill: '#348'
  }));
  earth.loadPlugin(autocenter());
  earth.loadPlugin(autoscale());
  earth.loadPlugin(planetaryjs.plugins.zoom({
    scaleExtent: [100, 2500]
  }));
  earth.loadPlugin(planetaryjs.plugins.drag());
  earth.projection.rotate([100, -20, 0]);

  earth.loadPlugin(flights());

  earth.draw(document.getElementById('globe'));



  function mainloop() {
    // https://developer.flightstats.com/api-docs/flightstatus/v2/fleet
    $.ajax({
      url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/fleet/tracks/'+airline,
      data: { appId: appId, appKey: appKey, includeFlightPlan: true, maxPositions: 1 },
      dataType: 'jsonp',
      success: getFlights
    });

    function getFlights(data /* , status, xhr */) {
      console.log(data);
      airports = getAppendix(data.appendix.airports);
      earth.plugins.flights.add(data.flightTracks);
    }
  }

  mainloop();


  // plugins -----------------------------------------------------------

  function flights(config) {
    var flist = [];
    config = config || {};
    config.color = config.color || 'red';
    // color = "rgba(" + color.r + "," + color.g + "," + color.b + "," + alpha + ")";
    config.angle = config.angle || 0.2;

    var addFlights = function(tracks) {
      flist = [];
      $.each(tracks, function(i, v) {
        var p = v.positions[0];
        var d = airports[v.departureAirportFsCode];
        var a = airports[v.arrivalAirportFsCode];
        flist.push({
          color: config.color,
          angle: config.angle,
          plane: [p.lon, p.lat],
          dep: [d.longitude, d.latitude],
          arr: [a.longitude, a.latitude]
        });
      });
    };

    var drawFlights = function(planet, context) {
      $.each(flist, function(i, v) {
        context.strokeStyle = v.color;
        var arc = { type: 'LineString', coordinates: [v.dep, v.arr] };
        var circle = d3.geo.circle().origin(v.plane).angle(v.angle)();
        context.beginPath();
        planet.path.context(context)(arc);
        planet.path.context(context)(circle);
        context.stroke();
        context.closePath();
      });
    };
  
    return function(planet) {
      planet.plugins.flights = {
        add: addFlights
      };

      planet.onDraw(function() {
        planet.withSavedContext( function(context) {
          drawFlights(planet, context);
        });
      });
    };

  }

  // draw a set of arcs
  function arc(options) {
    options = options || {};
    var arclist = [];

    return function(planet) {
      planet.onDraw(function () {
        planet.withSavedContext(function (context) {
          var arc = {type: "LineString", coordinates: [[40, 30], [40, -50]]};
          context.beginPath();
          planet.path.context(context)(arc);
          context.stroke();
          context.closePath();
        });
      });
    };
  }

	// This plugin takes lake data from the special
  // TopoJSON we're loading and draws them on the map.
  function lakes(options) {
    options = options || {};
    var lakesf = null;

    return function(planet) {
      planet.onInit(function() {
        // We can access the data loaded from the TopoJSON plugin
        // on its namespace on `planet.plugins`. We're loading a custom
        // TopoJSON file with an object called "ne_110m_lakes".
        var world = planet.plugins.topojson.world;
        lakesf = topojson.feature(world, world.objects.ne_110m_lakes);
      });

      planet.onDraw(function() {
        planet.withSavedContext(function(context) {
          context.beginPath();
          planet.path.context(context)(lakesf);
          context.fillStyle = options.fill || 'blue';
          context.fill();
        });
      });
    };
  }

  // Plugin to resize the canvas to fill the window and to
  // automatically center the planet when the window size changes
  function autocenter(options) {
    options = options || {};
    var needsCentering = false;
    var globe = null;

    var resize = function() {
      var width  = window.innerWidth + (options.extraWidth || 0);
      var height = window.innerHeight + (options.extraHeight || 0);
      globe.canvas.width = width;
      globe.canvas.height = height;
      globe.projection.translate([width / 2, height / 2]);
    };

    return function(planet) {
      globe = planet;
      planet.onInit(function() {
        needsCentering = true;
        d3.select(window).on('resize', function() {
          needsCentering = true;
        });
      });

      planet.onDraw(function() {
        if (needsCentering) { resize(); needsCentering = false; }
      });
    };
  }

  // Plugin to automatically scale the planet's projection based
  // on the window size when the planet is initialized
  function autoscale(options) {
    options = options || {};
    return function(planet) {
      planet.onInit(function() {
        var width  = window.innerWidth + (options.extraWidth || 0);
        var height = window.innerHeight + (options.extraHeight || 0);
        planet.projection.scale(Math.min(width, height) / 2);
      });
    };
  }

  // misc functions ----------------------------------------------
  function getAppendix(data) { // read in data from appendix and convert to dictionary
      var ret = {};
      if (data) {
        for (var i = 0; i<data.length; i++) {
          var v = data[i];
          ret[v.fs] = v;
        }
      }
      return ret;
    }

}(jQuery));