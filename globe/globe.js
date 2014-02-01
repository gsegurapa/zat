(function($){
  "use strict";

  var fleet_appId = 'fc5d0d2b';
  var fleet_appKey = 'd3236520871e1ab3e5f748af515029a8';
  var tracker_appId = '368357de';
  var tracker_appKey = '26901bf7d1f3534aa1e7a5a3be111b39';

  var airline = ''; // default is alaska airlines
  var codeshares = false;
  var airport = '';
  var arrDep = 'dep';
  var auto = 'off';
  var duration = 5;  // five seconds
  var zoomFactor = 1.0;
  var airplaneIcon = 'airplane';
  var scaleIcon = 1.0;
  var globe = 'regular';
  var interactive = true;
  var appId = '', appKey = '';

  var earth;  // the globe
  var airports; // airport information
  var default_airport = 'AS';

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
    if (p.airplaneIcon) { airplaneIcon = p.airplaneIcon; }
    if (p.scaleIcon) { scaleIcon = +p.scaleIcon; }
    // if (p.globe) { globe = p.globe; }
    if (p.interactive) { interactive = p.interactive === 'true'; }
    if (p.appKey) { appKey = p.appKey; }
  }

  getParams(window.location.href); // params from URL

  // if (appId.length === 0 || appKey.length === 0) {
  //   if (airport.length === 0) {
  //     appId = fleet_appId;
  //     appKey = fleet_appKey;
  //   } else {
  //     appId = tracker_appId;
  //     appKey = tracker_appKey;
  //   }
  // } else if (appId === fleet_appId && appKey === fleet_appKey) {
  //   appId = '';
  //   appKey = '';
  //   alert('invalid appId and appKey');
  // }

  $(document).ready(function() {

    showcode();

    var file = { regular: 'world-110m-withlakes.json', simple: 'world-50m.json' }[globe];
    earth = planetaryjs.planet();
    earth.loadPlugin(planetaryjs.plugins.earth({
      topojson: { file: file },
      oceans: { fill: '#13a'},
      land: { fill: '#1a3', shadow: { shadowOffsetX: 2, shadowOffsetY: 2, shadowColor: 'black' } },
      borders: { stroke: '#000'}
    }));
    if (globe === 'regular') {
      earth.loadPlugin(lakes({
        fill: '#24a'
      }));
    }
    earth.loadPlugin(autocenter());
    earth.loadPlugin(autoscale());
    earth.loadPlugin(planetaryjs.plugins.zoom({
      scaleExtent: [100, 2500]
    }));

    earth.loadPlugin(flights());

    if (auto === 'off') { // drag manually
      earth.loadPlugin(planetaryjs.plugins.drag());
      earth.projection.rotate([100, -20, 0]);
      if (interactive) { $('#automessage').text('Drag globe, click on flights').show(); }
    } else if (auto === 'rotate') {
      earth.projection.rotate([100, -10, 0]);
      earth.loadPlugin(autorotate(duration));
    } else if (auto === 'flights' || auto === 'airports') {
      earth.loadPlugin(planetaryjs.plugins.pings());
    }

    earth.draw(document.getElementById('globe'));

    mainloop();

    $('#what, #airlinelogo').click(function() {
      $('#what, #airlinelogo').hide();
      $('#code').val(airline || airport).show().focus().select().keydown(keyf).blur(changecode);
    });

    function keyf(e) {
      if (e.keyCode === 13) { // carriage return
        changecode();
      }
    }

    function changecode() {
      var $code = $('#code');
      $code.off('keydown', keyf).off('blur', changecode);
      var val = $.trim($code.val().toUpperCase());
      if (val.length > 2) {
        airport = val;
        airline = '';
      } else {
        airline = val;
        airport = '';
      }
      console.log(airline, airport);
      $code.hide();
      showcode();
      mainloop();
      return false;
    }

    function showcode() { // display airport or airline code
      if (airport.length > 0 && airline.length === 0) {
        $('#what').text(airport).show();
      } else {
        if (airline.length === 0) { airline = default_airport; }
        $('#airlinelogo').attr('src', 'http://dem5xqcn61lj8.cloudfront.net/logos/'+airline+'.gif').show();
      }
    }

  }); // end document ready

  // main API call
  function mainloop() {
    // https://developer.flightstats.com/api-docs/flightstatus/v2/fleet
    // https://developer.flightstats.com/api-docs/flightstatus/v2/airport
    var url, params = { includeFlightPlan: false, maxPositions: 2,
      appId: airport.length === 0 ? fleet_appId : tracker_appId,
      appKey: airport.length === 0 ? fleet_appKey : tracker_appKey };
    if (airport.length === 0) {
      url = 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/fleet/tracks/'+airline;
      if (codeshares) { params.codeshares = true; }
    } else {
      url = 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/airport/tracks/'+airport+'/'+arrDep;
      if (airline.length > 0) { params.carrier = airline; }
    }

    $.ajax({
      url: url,
      data: params,
      dataType: 'jsonp',
      success: getFlights
    });

    function getFlights(data /* , status, xhr */) {
      if (data.error) {
        console.log(data.error);
      }
      // console.log('flightdata', data);
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
                  }).delay(duration * 200).fadeIn(duration * 300, function() {
                    earth.plugins.pings.add(p.longitude, p.latitude,
                        { color: 'white', angle: 3, ttl: duration * 500 });
                  });
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
                  }).delay(duration * 200).fadeIn(duration * 300, function() {
                    earth.plugins.pings.add(p.positions[0].lon, p.positions[0].lat,
                        { color: 'white', angle: 3, ttl: duration * 500 });
                  });
                var r = d3.interpolate(earth.projection.rotate(), [-p.positions[0].lon, -p.positions[0].lat]);
                return function(t) {
                  earth.projection.rotate(r(t));
                };
              })
              .transition()
                .each('end', transition);
        })();
      } else if (auto === 'off') {
        $('#globe').on('click', clickplane);
        $mess.show();
      }


      function clickplane(e) {  // click on plane icon to display flight info
        var mp = earth.projection.invert([e.pageX, e.pageY]);
        var mindist = 1000;
        var flight = null;
        $.each(data.flightTracks, function(i, v) {
          var dist = d3.geo.distance(mp, [v.positions[0].lon, v.positions[0].lat]);
          if (dist < mindist) {
            mindist = dist;
            flight = v;
          }
        });
        if (mindist < 0.02 * scaleIcon) {
          $mess.text(flight.carrierFsCode+' '+flight.flightNumber+': '+
            airportname(airports[flight.departureAirportFsCode])+
            ' to '+airportname(airports[flight.arrivalAirportFsCode])).show();
        } else {
          $mess.text('').hide();
        }
      }

    }
  } // end mainloop

  function airportname(p) { // airport information: code, city, state or country
    return p.fs+' '+p.city+' '+(p.stateCode ? p.stateCode : p.countryName);
  }


  // plugins -----------------------------------------------------------

  function flights(config) {
    var flist = [];
    var airplaneIcons = {
      triangle: [ [0,0.5], [0.3,-0.5], [-0.3,-0.5], [0,0.5] ],
      airplane: [ [0, 0.6], [0.1, 0.5], [0.1, 0.1], [0.7, -0.3], [0.1, -0.1], [0.1, -0.4], [0.2, -0.5],
          [-0.2, -0.5], [-0.1, -0.4], [-0.1, -0.1], [-0.7, -0.3], [-0.1, 0.1], [-0.1, 0.5], [0, 0.6] ],
    };
    var icon = airplaneIcons[airplaneIcon].map(function(v) { return [scaleIcon * v[0], scaleIcon * v[1]]; });
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
        context.fillStyle = '#eee';
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
        if (world.objects.ne_110m_lakes) {
          lakesf = topojson.feature(world, world.objects.ne_110m_lakes);
        }
      });

      planet.onDraw(function() {
        if (lakesf === null) { return; }
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

  // rate is in degrees per second
  function autorotate(rate) {
    return function(planet) {
      var tick = null;
      planet.onDraw(function() {
        if (!tick) {
          tick = new Date();
        } else {
          var now = new Date();
          var delta = now - tick;
          var rotation = planet.projection.rotate();
          rotation[0] += rate * delta * 0.001;
          if (rotation[0] >= 180) { rotation[0] -= 360; }
          planet.projection.rotate(rotation);
          tick = now;
        }
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