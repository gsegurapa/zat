(function($){
  "use strict";

  var fleet_appId = 'fc5d0d2b';
  var fleet_appKey = 'd3236520871e1ab3e5f748af515029a8';
  var tracker_appId = '368357de';
  var tracker_appKey = '26901bf7d1f3534aa1e7a5a3be111b39';

  var airline = ''; // default is alaska
  var codeshares = false;
  var airport = '';
  var arrDep = 'dep';
  var auto = 'false';
  var duration = 5;  // five seconds
  var zoomFactor = 1.0;
  var airplaneIcon = 'triangle';
  var appId = '', appKey = '';

  var airports;

  function getParams(st) {
    
    var p = {}; // parameters
    st.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { p[key] = value; });

    if (p.airline) { airline = p.airline; }
    if (p.codeshares) { codeshares = p.codeshares === 'true'; }
    if (p.airport) { airport = p.airport; }
    if (p.arrDep) { arrDep = p.arrDep; }
    if (p.auto) { auto = p.auto; }
    if (p.duration) { duration = +p.duration; }
    if (p.zoomFactor) { zoomFactor = +p.zoomFactor; }
    if (p.appId) { appId = p.appId; }
    if (p.appKey) { appKey = p.appKey; }
  }

  getParams(window.location.href); // params from URL

  if (appId.length === 0 || appKey.length === 0) {
    if (airport.length === 0) {
      appId = fleet_appId;
      appKey = fleet_appKey;
    } else {
      appId = tracker_appId;
      appKey = tracker_appKey;
    }
  } else if (appId === fleet_appId && appKey === fleet_appKey) {
    appId = '';
    appKey = '';
    alert('invalid appId and appKey');
  }

  if (airport.length > 0 && airline.length === 0) {
    $('#what').text(airport);
  } else {
    if (airline.length === 0) { airline = 'AS'; }
    $('#what').replaceWith('<img id="linelogo" src="http://dem5xqcn61lj8.cloudfront.net/logos/'+airline+'.gif" />');
  }

  // if (airport.length === 0) {
  //   if (airline.length === 0) { airline = 'AS'; }
  //   $('#what').replaceWith('<img id="linelogo" src="http://dem5xqcn61lj8.cloudfront.net/logos/'+airline+'.gif" />');
  // } else {
  //   $('#what').text(airport);
  // }

	var earth = planetaryjs.planet();
	earth.loadPlugin(planetaryjs.plugins.earth({
    topojson: { file: 'world-110m-withlakes.json' },
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

  if (auto === 'false') { // drag manually
    earth.loadPlugin(planetaryjs.plugins.drag());
    earth.projection.rotate([100, -20, 0]);
  }

  earth.loadPlugin(flights());

  earth.draw(document.getElementById('globe'));


  function mainloop() {
    // https://developer.flightstats.com/api-docs/flightstatus/v2/fleet
    // https://developer.flightstats.com/api-docs/flightstatus/v2/airport
    var url, data = { appId: appId, appKey: appKey, includeFlightPlan: false, maxPositions: 1 };
    if (airport.length === 0) {
      url = 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/fleet/tracks/'+airline;
      if (codeshares) { data.codeshares = true; }
    } else {
      url = 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/airport/tracks/'+airport+'/'+arrDep;
      if (airline.length > 0) { data.carrier = airline; }
    }

    console.log('data', data);

    $.ajax({
      url: url,
      data: data,
      dataType: 'jsonp',
      success: getFlights
    });

    function getFlights(data /* , status, xhr */) {
      console.log(data);
      // $('#what').text(data.appendix.airlines[0].name);
      airports = getAppendix(data.appendix.airports);
      earth.plugins.flights.add(data.flightTracks);

      var i = -1, a, n;
      var $mess = $('#automessage');

      if (auto === 'airports') {
        a = data.appendix.airports;
        n = a.length;

        (function transition() {
          d3.transition().duration(duration * 1000)
              .each('start', function() { i = (i + 1) % n; })
              .tween('rotate', function() {
                var p = a[i];
                $mess.fadeOut(duration * 300, function() {
                    $mess.text((airport.length > 0 ? (arrDep == 'dep' ? 'To ' : 'From ') : '')+airportname(p));
                  }).delay(duration * 200).fadeIn(duration * 300);
                var r = d3.interpolate(earth.projection.rotate(), [-p.longitude, -p.latitude]);
                return function(t) {
                  earth.projection.rotate(r(t));
                };
              })
              .transition()
                .each('end', transition);
        })();
      } else if (auto === 'flights') {
        a = data.flightTracks;
        n = a.length;

        (function transition() {
          d3.transition().duration(duration * 1000)
              .each('start', function() { i = (i + 1) % n; })
              .tween('rotate', function() {
                var p = a[i];
                $mess.fadeOut(duration * 300, function() {
                    $mess.text(p.carrierFsCode+' '+p.flightNumber+': '+
                        airportname(airports[p.departureAirportFsCode])+
                        ' to '+airportname(airports[p.arrivalAirportFsCode]));
                  }).delay(duration * 200).fadeIn(duration * 300);
                var r = d3.interpolate(earth.projection.rotate(), [-p.positions[0].lon, -p.positions[0].lat]);
                return function(t) {
                  earth.projection.rotate(r(t));
                };
              })
              .transition()
                .each('end', transition);
        })();
      }

    }
  }

  mainloop();

  function airportname(p) {
    return p.fs+' '+p.city+' '+(p.stateCode ? p.stateCode : p.countryName);
  }


  // plugins -----------------------------------------------------------

  function flights(config) {
    var flist = [];
    var airplaneIcons = {
      triangle: [ [0,0.5], [0.3,-0.5], [-0.3,-0.5], [0,0.5] ],
      plane: [ [-0.2, -1], [0.2, -1] ]
    };
    var icon = airplaneIcons[airplaneIcon];
    config = config || {};
    config.color = config.color || 'red';
    // color = "rgba(" + color.r + "," + color.g + "," + color.b + "," + alpha + ")";
    config.size = config.size || 5;

    var addFlights = function(tracks) {
      flist = [];
      $.each(tracks, function(i, v) {
        var p = v.positions[0];
        var d = airports[v.departureAirportFsCode];
        var a = airports[v.arrivalAirportFsCode];
        flist.push({
          color: config.color,
          size: config.size,
          plane: [p.lon, p.lat],
          heading: v.heading || v.bearing || 0,
          dep: [d.longitude, d.latitude],
          arr: [a.longitude, a.latitude],
        });
      });
    };

    var drawFlights = function(planet, context) {
      var pathcontext = planet.path.context(context).pointRadius(2);
      $.each(flist, function(i, v) {  // route
        context.beginPath();
        pathcontext({ type: 'LineString', coordinates: [v.dep, v.plane, v.arr] });
        // pathcontext({ type: 'LineString', coordinates: [v.plane, v.arr] });        
        context.strokeStyle = v.color;
        context.stroke();

        context.beginPath();  // endpoints (airports)
        pathcontext({ type: 'MultiPoint', coordinates: [v.dep, v.arr] });
        context.fillStyle = v.color;
        context.fill();
      });
      $.each(flist, function(i, v) {  // airplanes
        // var plane = d3.geo.circle().origin(v.plane).angle(60 * v.size / planet.projection.scale())();
        // console.log(v.plane[0], v.plane[1], v.heading);
        var rotfun = d3.geo.rotation([-v.plane[0], -v.plane[1], v.heading]).invert;
        var plane = { type: 'Polygon', coordinates: [icon.map(rotfun)] };
        context.beginPath();
        pathcontext(plane);
        context.strokeStyle = 'black';
        context.fillStyle = '#ddd';
        context.shadowColor = 'black';
        context.shadowBlur = 10;
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 3;
        context.fill();
        // context.stroke();
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
  // function arc(options) {
  //   options = options || {};
  //   var arclist = [];

  //   return function(planet) {
  //     planet.onDraw(function () {
  //       planet.withSavedContext(function (context) {
  //         var arc = {type: "LineString", coordinates: [[40, 30], [40, -50]]};
  //         context.beginPath();
  //         planet.path.context(context)(arc);
  //         context.stroke();
  //         context.closePath();
  //       });
  //     });
  //   };
  // }

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
        planet.projection.scale(zoomFactor * Math.min(width, height) / 2);
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