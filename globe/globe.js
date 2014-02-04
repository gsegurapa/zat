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
  var showDelays = true;
  var interactive = true;
  var appId = '', appKey = '';

  var earth;  // the globe
  var airports; // airport information
  var default_airport = 'AS';
  var highlight = null; // which flight to highlight
  var autodata, autoindex;  // for auto parameter
  var $mess;  // infomessage


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
    if (p.showDelays) { showDelays = p.showDelays === 'true'; }
    if (p.interactive) { interactive = p.interactive === 'true'; }
    if (p.appKey) { appKey = p.appKey; }
  }

  getParams(window.location.href); // params from URL

  $(document).ready(function() {

    showcode();
    $mess = $('#automessage');

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
    earth.loadPlugin(planetaryjs.plugins.drag({
      onDragStart: function() { earth.plugins.autorotate.pause(); },
      onDragEnd: function() { earth.plugins.autorotate.pause(auto !== 'rotate'); }
    }));
    earth.loadPlugin(autorotate(duration, auto !== 'rotate'));
    earth.loadPlugin(flights());
    earth.loadPlugin(planetaryjs.plugins.pings());

    // initial rotation
    earth.projection.rotate({ off: [100, -20, 0], rotate: [0, -10, 0], scroll: [100, -30, 0] }[auto]);

    earth.draw(document.getElementById('globe'));

    mainloop();

    $('#zatlogo').click(function() {
      if (auto === 'off') {
        auto = 'rotate';
        earth.plugins.autorotate.pause(false);
        $mess.finish().text('rotate').show().fadeOut(1500);
      } else if (auto === 'rotate') {
        auto = 'scroll';
        earth.plugins.autorotate.pause();
        $mess.finish().text('scroll').show().css('opacity', 1);
        autotransition();
      } else if (auto === 'scroll') {
        auto = 'off';
        $mess.finish().text('drag globe, click on airplanes').show().css('opacity', 1);
      }
    });

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
      // console.log(airline, airport);
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
      // console.log('flightdata', data);
      if (data.error) {
        console.log(data.error);
      }
      airports = getAppendix(data.appendix.airports);
      earth.plugins.flights.add(data.flightTracks);
      autodata = data.flightTracks;
      autoindex = -1;
      $('#globe').on('click', clickplane);

      if (auto === 'scroll') {
        autoindex = -1;
        $mess.show();
        autotransition();
      } else if (auto === 'off' && interactive === true) {
        $mess.text('drag globe, click on airplanes').show();
        if (airport.length > 0) {
          d3.transition().duration(duration * 300).tween('rotate', function() {
            var a = airports[airport];
            var r = d3.interpolate(earth.projection.rotate(), [-a.longitude, -a.latitude]);
            return function(t) { earth.projection.rotate(r(t)); };
          });
        }
      }
    }
  } // end mainloop

  function autotransition() { // scroll between flights
    d3.transition().duration(duration * 1000)
        .each('start', function() { autoindex = (autoindex + 1) % autodata.length; })
        .tween('rotate', function() {
          var p = autodata[autoindex],
              pos = p.positions[0];
          highlight = +p.flightId;
          d3.select('#automessage').transition().duration(duration * 300).style('opacity', 0)
            .transition().delay(duration * 400)
                .text(messtext(p))
            .transition().duration(duration * 300).style('opacity', 1.0)
            .each('end', function() {
              earth.plugins.pings.add(pos.lon, pos.lat,
                  { color: 'white', angle: 3, ttl: duration * 500 });
            });
          var r = d3.interpolate(earth.projection.rotate(), [-pos.lon, -pos.lat]);
          return function(t) {
            earth.projection.rotate(r(t));
          };
        })
        .transition()
          .each('end', function() { if (auto === 'scroll') { autotransition(); } });
  }

  function clickplane(e) {  // click on plane icon to display flight info
    var mp = earth.projection.invert([e.pageX, e.pageY]);
    var mindist = 1000;
    var flight = null;
    $.each(autodata, function(i, v) {
      var dist = d3.geo.distance(mp, [v.positions[0].lon, v.positions[0].lat]);
      if (dist < mindist) {
        mindist = dist;
        flight = v;
      }
    });
    if (mindist < 0.02 * scaleIcon) {
      $mess.text(messtext(flight)).show();
      highlight = +flight.flightId;
      earth.plugins.pings.add(flight.positions[0].lon, flight.positions[0].lat,
                  { color: 'white', angle: 3, ttl: duration * 500 });
    } else {
      $mess.text('').hide();
      highlight = null;
    }
  }

  function messtext(pl) {
    return pl.carrierFsCode+' '+pl.flightNumber+':'+
        (pl.departureAirportFsCode !== airport ? ' from '+airportname(airports[pl.departureAirportFsCode]) : '')+
        (pl.arrivalAirportFsCode !== airport ? ' to '+airportname(airports[pl.arrivalAirportFsCode]) : '')+
        (showDelays && pl.delayMinutes >= 15 ? ' ('+pl.delayMinutes+' mins late)' : '');
  }

  function airportname(p) { // airport information: code, city, state or country
    return p.fs+' '+p.city+' '+(p.countryCode === 'US' || p.countryCode === 'CA' ? p.stateCode : p.countryCode);
  }


  // plugins -----------------------------------------------------------

  function flights(config) {
    var flist = [];
    var airplaneIcons = {
      triangle: [ [0,0.5], [0.3,-0.5], [-0.3,-0.5], [0,0.5] ],
      airplane: [ [0, 0.6], [0.1, 0.5], [0.1, 0.1], [0.7, -0.3], [0.1, -0.1], [0.1, -0.4], [0.2, -0.5],
          [-0.2, -0.5], [-0.1, -0.4], [-0.1, -0.1], [-0.7, -0.3], [-0.1, 0.1], [-0.1, 0.5], [0, 0.6] ]
    };
    var si = scaleIcon * 1.1;
    var icon = airplaneIcons[airplaneIcon].map(function(v) { return [si * v[0], si * v[1]]; });
    si = scaleIcon * 2;
    var sicon = airplaneIcons[airplaneIcon].map(function(v) { return [si * v[0], si * v[1]]; });
    config = config || {};
    config.color = config.color || 'red';
    // color = "rgba(" + color.r + "," + color.g + "," + color.b + "," + alpha + ")";
    // config.size = config.size || 5;

    var addFlights = function(tracks) {
      flist = [];
      $.each(tracks, function(i, v) {
        var p = v.positions[0];
        var d = airports[v.departureAirportFsCode];
        var a = airports[v.arrivalAirportFsCode];
        flist.push({
          plane: [p.lon, p.lat],
          id: v.flightId,
          heading: v.heading || v.bearing || 0,
          dep: [d.longitude, d.latitude],
          arr: [a.longitude, a.latitude]
        });
      });
    };

    var drawFlights = function(planet, context) {
      var pathcontext = planet.path.context(context).pointRadius(2);
      var selected = null;
      $.each(flist, function(i, v) {  // route
        if (highlight === v.id) {
          selected = v;
          return;
        }
        context.beginPath();
        pathcontext({ type: 'LineString', coordinates: [v.dep, v.plane, v.arr] });
        context.strokeStyle = config.color;
        context.lineWidth = 1;
        context.stroke();

        context.beginPath();  // endpoints (airports)
        pathcontext({ type: 'MultiPoint', coordinates: [v.dep, v.arr] });
        context.fillStyle = config.color;
        context.fill();
      });
      // draw highlighted route
      if (selected) {
        context.beginPath();
        pathcontext.pointRadius(4)({ type: 'LineString', coordinates: [selected.dep, selected.plane, selected.arr] });
        context.strokeStyle = '#fa2';
        context.lineWidth = 3;
        context.stroke();

        context.beginPath();  // endpoints (airports)
        pathcontext({ type: 'MultiPoint', coordinates: [selected.dep, selected.arr] });
        context.fillStyle = '#fa2';
        context.fill();
      }
      $.each(flist, function(i, v) {  // airplanes
        // var plane = d3.geo.circle().origin(v.plane).angle(60 * v.size / planet.projection.scale())();
        var rotfun = d3.geo.rotation([-v.plane[0], -v.plane[1], v.heading]).invert;
        var plane = { type: 'Polygon', coordinates: [(highlight === v.id ? sicon : icon).map(rotfun)] };
        context.beginPath();
        pathcontext(plane);
        // context.strokeStyle = 'black';
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
  function autorotate(rate, paused) {
    var stop = paused === true;
    return function(planet) {
      planet.plugins.autorotate = {
        pause: function(b) {
          stop = b !== false;
          if (!stop) { tick = null; }
        }
      };
      var tick = null;
      planet.onDraw(function() {
        if (stop) { return; }
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

      // if (auto === 'airports') {
      //   autodata = data.appendix.airports;
      //   autolength = autodata.length;

        // (function transition() {
        //   d3.transition().duration(duration * 1000)
        //       .each('start', function() { i = (i + 1) % autolength; })
        //       .tween('rotate', function() {
        //         var p = autodata[i];
        //         $mess.fadeOut(duration * 300, function() {
        //             $mess.text((airport.length > 0 ? (arrDep == 'dep' ? 'To ' : 'From ') : '')+airportname(p));
        //           }).delay(duration * 200).fadeIn(duration * 300, function() {
        //             earth.plugins.pings.add(p.longitude, p.latitude,
        //                 { color: 'white', angle: 3, ttl: duration * 500 });
        //           });
        //         var r = d3.interpolate(earth.projection.rotate(), [-p.longitude, -p.latitude]);
        //         return function(t) {
        //           earth.projection.rotate(r(t));
        //         };
        //       })
        //       .transition()
        //         .each('end', transition);
        // })();
      // } else

        // (function transition() {
        //   d3.transition().duration(duration * 1000)
        //       .each('start', function() {i = (i + 1) % autolength; })
        //       .tween('rotate', function() {
        //         var p = autodata[i];
        //         $mess.fadeOut(duration * 300, function() {
        //             $mess.text(p.carrierFsCode+' '+p.flightNumber+': '+
        //                 airportname(airports[p.departureAirportFsCode])+
        //                 ' to '+airportname(airports[p.arrivalAirportFsCode]));
        //           }).delay(duration * 200).fadeIn(duration * 300, function() {
        //             earth.plugins.pings.add(p.positions[0].lon, p.positions[0].lat,
        //                 { color: 'white', angle: 3, ttl: duration * 500 });
        //           });
        //         var r = d3.interpolate(earth.projection.rotate(), [-p.positions[0].lon, -p.positions[0].lat]);
        //         return function(t) {
        //           earth.projection.rotate(r(t));
        //         };
        //       })
        //       .transition()
        //         .each('end', transition);
        // })();

  // helper function to find control point for quadratic curve to draw curve through 3 points
//   function findControlPoint(s1, s2, s3) {
//     var // Unit vector, length of line s1,s3
//         ux1 = s3.x - s1.x,
//         uy1 = s3.y - s1.y,
//         ul1 = Math.sqrt(ux1*ux1 + uy1*uy1)
//         u1 = { x: ux1/ul1, y: uy1/ul1 },
 
//         // Unit vector, length of line s1,s2
//         ux2 = s2.x - s1.x,
//         uy2 = s2.y - s1.y,
//         ul2 = Math.sqrt(ux2*ux2 + uy2*uy2),
//         u2 = { x: ux2/ul2, y: uy2/ul2 },
 
//         // Dot product
//         k = u1.x*u2.x + u1.y*u2.y,
 
//         // Project s2 onto s1,s3
//         il1 = { x: s1.x+u1.x*k*ul2, y: s1.y+u1.y*k*ul2 },
 
//         // Unit vector, length of s2,il1
//         dx1 = s2.x - il1.x,
//         dy1 = s2.y - il1.y,
//         dl1 = Math.sqrt(dx1*dx1 + dy1*dy1),
//         d1 = { x: dx1/dl1, y: dy1/dl1 },
 
//         // Midpoint
//         mp = { x: (s1.x+s3.x)/2, y: (s1.y+s3.y)/2 },
 
//         // Control point on s2,il1
//         cpm = { x: s2.x+d1.x*dl1, y: s2.y+d1.y*dl1 },
 
//         // Translate based on distance from midpoint
//         tx = il1.x - mp.x,
//         ty = il1.y - mp.y,
//         cp = { x: cpm.x+tx, y: cpm.y+ty };
 
//     return cp;
// }
