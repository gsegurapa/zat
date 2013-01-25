// FlightStats flight tracker
/*global L:false, jQuery:false, Morris:false */

(function($){
	// "use strict";

	var updateRate = 10000;	// 10 seconds
	var aniRate = 250;	// 1/4 second
	var rotRate = aniRate / 500;	// 2 degrees per second max

	// process URL parameters
	var flightID, // flightstats flight id
			airline,
			flightnum,
			timeFormat=12, // 12 or 24
			units='metric', // metric or US
			mapType = 'street', // name of map
			showWeather = false,
			view = '2D',
			debug = false;	// interactive debug

	function getParams(p) {
    var params = {}; // parameters
    p.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { params[key] = value; });

    if (params.id) { flightID = params.id; }
    if (params.timeFormat) { timeFormat = +params.timeFormat; }
    if (params.units) { units = params.units; }
    if (params.mapType) { mapType = params.mapType; }
    if (params.showWeather) { showWeather = params.showWeather === 'true'; }
    if (params.airline) { airline = params.airline; }
    if (params.flight) { flightnum = params.flight; }
    if (params.view) { view = params.view.toUpperCase(); }	// 3D or 3d
    if (params.debug) { debug = params.debug === 'true'; }
	}

	getParams(window.location.href); // read parameters from URL

	if (!window.console) {	// make sure console functions don't cause an error
    (function() {
      var stub = function(){};
      var names = ["log", "debug", "info", "warn", "error", "assert", "dir", "dirxml",
      "group", "groupEnd", "time", "timeEnd", "count", "trace", "profile", "profileEnd"];
      window.console = {};
      for (var i = 0; i < names.length; ++i) {
        window.console[names[i]] = stub;
      }
    }());
	}

	if (flightID === undefined) { window.location = "flight.html"; } // setup tool -- remove for production

	var appId = '9543a3e8',
			appKey = '91d511451d9dbf38ede3efafefac5f09';

	var tiles = { // base maps
		street: L.tileLayer(
			'http://maptiles-{s}.flightstats-ops.com/surfer/{z}/{x}/{y}.png',
			{ subdomains: 'abcd',
				minZoom: 0, maxZoom: 11
		}),
		satellite: L.tileLayer(
			'http://maptiles-{s}.flightstats-ops.com/satellite/{z}/{x}/{y}.png',
			{ subdomains: 'abcd',
				minZoom: 0, maxZoom: 11
		}),
		terrain: L.tileLayer(
			'http://maptiles-{s}.flightstats-ops.com/mapboxterrain/{z}/{x}/{y}.png',
			{	subdomains: 'abcd',
				minZoom: 0, maxZoom: 11
			}),
		stamen: L.tileLayer(
			'http://maptiles-{s}.flightstats-ops.com/terrain/{z}/{x}/{y}.jpg',
			{ subdomains: 'abcd',
				minZoom: 4, maxZoom: 12
		})
	};

	// Flightstats weather tiles -----------------------------------------------------------
  L.TileLayer.FSWeather = L.TileLayer.extend({
    initialize: function(options) {
      L.Util.setOptions(this, options);    
    },
    getTileUrl: function(xy) {
      var z = this._getZoomForUrl();
      var de = L.TileLayer.FSWeather.weather_tiles_range[z];
      return (de && xy.x >= de.x.min && xy.x <= de.x.max && xy.y >= de.y.min && xy.y <= de.y.max) ?
        ['http://www.flightstats.com/googlemaptiles/weather/noaa/radar/z', z,
            '/radar_tile_z', z, 'x', xy.x, 'y', xy.y, '.png'].join('') : '';
    }
  });
  
  L.TileLayer.FSWeather.weather_tiles_range = {
			2: { x: {min: 0, max: 1}, y: {min: 1, max: 1} },
			3: { x: {min: 0, max: 2}, y: {min: 2, max: 3} },
			4: { x: {min: 0, max: 5}, y: {min: 4, max: 7} },
			5: { x: {min: 0, max: 10}, y: {min: 8, max: 14} },
			6: { x: {min: 0, max: 20}, y: {min: 16, max: 28} }
  };

	var weather = new L.TileLayer.FSWeather({
      opacity: '0.5',
      // attribution: "Weather data &copy; 2011 IEM Nexrad",
      minZoom: 2, maxZoom: 6
  });

	// layers and layer control
	var layercontrol = L.control.layers(
		tiles,
		{ weather: weather }
	);
	var defaultlayers = [tiles[mapType]];
	if (showWeather) { defaultlayers.push(weather); }

	// var scalecontrol = L.control.scale();

	var attributioncontrol = L.control.attribution({ prefix: false }).
			addAttribution('<a class="attribution" href="http://maptiles-a.flightstats-ops.com/attribution.html" target="_blank">Attribution</a>');

	var zoomcontrol = L.control.zoom();

	$(document).ready(function() {

		var airports, airlines;	// appendices from API
		var departureAirport,	// code of departure airport
				dpos,	// lat/lng position of departure airport
				arrivalAirport,	// code of arrival airport
				apos,	// lat/lng position of arrival airport
				airplane,	// L.marker for airplane icon
				fpos,	// lat/lng position of airplane
				plan,	// L.polyline of flight plan (or great circle)
				path,	// L.polyline of actual flight path
				multi,	// lat/lngs for flight path
				wrap;	// does route cross the anti-meridian?
		var tracking = 0, $trackbutton, maxZoom = 11;
		var logo = false, logoimg, logourl;	// airline logo image and prefetch (for flight label)
		var flightLabel;	// label for the airplane icon
		var flightData,	// flight data returned by API
				pos,	// position data returned by API
				timestamp,	// time of API call
				nodata;	// haven't received data from API recently
		var curpos,	// current lat/lng of animation
				currot, // current heading of animation
				curspeed, // current speed of airplane in mph
				curheading,	// current heading
				frames = 0,	// frames of animation remaining
				rotframes,	// frames of animation in rotation remaining
				anitimer;	// animation timer
		var vlat, vlng, vrot;	// animation parameters
		var zooming = false;	// true during zoom animation
		// debug stuff
		var graph_on = false, // graph is showing
				numpos,
				data_off = 0,	// index of where data is off for testing
				data_on = 0;	// index of where data is back on

    // create map
		var map = L.map('map_div', {	// create map
			attributionControl: false,
			zoomControl: false,
			zoomAnimation: true,
			markerZoomAnimation: true,
			layers: defaultlayers,
			worldCopyJump: false,
			inertia: false
		}).addControl(layercontrol).addControl(attributioncontrol).addControl(zoomcontrol).
			on('layeradd', function(e) { // reset zoom on basemap change
				var layer = e.layer;
				var m = layer._map;
				if (!layer.options || !layer.options.maxZoom) { return; }
				$.each(tiles, function(k, v) {
					if (v === layer) {
						maxZoom = layer.options.maxZoom;
						if (m.getZoom() > maxZoom) { m.setZoom(maxZoom); }
						return false;	
					}
				});
			}).
			on('zoomstart', function(/* e */) {
				zooming = true;
			}).
			on('zoomend', function(/* e */) {
				zooming = false;
			});

		// get position data from API
		function mainloop() {

			$.ajax({  // Call Flight Track by flight ID API
					url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/track/' + flightID,
					data: { appId: appId, appKey: appKey, includeFlightPlan: plan===undefined, extendedOptions: 'includeNewFields' },
					dataType: 'jsonp',
					success: getFlight
				});

			//	$.ajax({	// Call Flight Status by flight ID API
			//		url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/status/' + flightID,
			//		data: { appId: appId, appKey: appKey, extendedOptions: 'includeNewFields' },
			//		dataType: 'jsonp',
			//		success: getStatus
			//	});

			function getFlight(data /*, status, xhr */) { // callback
				if (!data || data.error) {
					alert('AJAX error: '+data.error.errorMessage);
					return;
				}

				flightData = data.flightTrack;
				var p = flightData.positions;
				numpos = p.length;

				if (data_off !== 0) {	// simulate data loss for testing
					if (data_on === 0) {	// data is dead
						p.splice(0, numpos-data_off);					
					} else {	// data is back on
						p.splice(-data_on, data_on-data_off);
					}
				}

				var newpos = p[0];
				var newhead = +(flightData.heading || flightData.bearing);
				var newdate = Date.parse(newpos.date);
				if (timestamp === undefined) { timestamp = newdate; }	// if uninitialized
				timestamp += updateRate;	// 10 seconds
				// if (debug) console.log(timestamp - newdate);
				if (timestamp - newdate > 120000) {	// two minutes
					if (!nodata) {
						showMessage(
							'This flight is temporarily beyond<br />'+
							'the range of our tracking network<br />'+
							'or over a large body of water');
						airplane.setActive(false);	// set airplane color to gray
						setFlightPath(true);	// draw entire flight history
					}
					nodata = true;
				}

				if (pos && newpos.lat === pos.lat && newpos.lon === pos.lon &&
						newpos.date === pos.date && pos.altitudeFt === newpos.altitudeFt) {
					return; // data has not changed
				}
				if (debug) { console.log('Flex API data: ', data); }

				pos = newpos;
				timestamp = newdate;
				if (nodata) {
					nodata = false;
					showMessage('Reestablishing position data<br />'+(new Date(timestamp)).toUTCString());
					airplane.setActive(true);	// set airplane color back to purple
					if (wrap !== undefined) {	// jump to new position
						phat(createLatLng(+pos.lat, +pos.lon, wrap), newhead, +pos.altitudeFt, timestamp);
					}
				}

				if (airports === undefined) { // first time called
					airports = getAppendix(data.appendix.airports);
					airlines = getAppendix(data.appendix.airlines);
					departureAirport = flightData.departureAirportFsCode;
					var depa = airports[departureAirport];
					arrivalAirport = flightData.arrivalAirportFsCode;
					var arra = airports[arrivalAirport];

					// This test does not take into account flights that fly the "wrong" way around
					// the world. In particular Singapore to New York (because of the wind).
					// Could do this by looking at flight plan, except flight plan is sometimes wrong.
					// See https://www.pivotaltracker.com/projects/709005#!/stories/40465187
					// See setfullview for hack to fix long Singapore flights
					wrap = Math.abs(depa.longitude - arra.longitude) > 180; // does route cross anti-meridian?

					dpos = createLatLng(+depa.latitude, +depa.longitude, wrap);
					apos = createLatLng(+arra.latitude, +arra.longitude, wrap);
					fpos = createLatLng(+pos.lat, +pos.lon, wrap);
					// currot = +(flightData.heading || flightData.bearing);

					var ac = flightData.carrierFsCode.toLowerCase();
					// logo sizes: 90x30, 120x40, 150x50, 256x86
					logourl = 'http://dem5xqcn61lj8.cloudfront.net/NewAirlineLogos/'+ac+'/'+ac+'_120x40.png';
					logoimg = $('<img/>'); // prefetch
					logoimg.load(function(/* e */) {	// if image exists, use it
						logo = true;
						// setFlightLabel();
					});
					logoimg.attr('src', logourl);	// prefetch image

					map.on('load', mapReady);
					setfullview(map);

				} else {	// update
					fpos = createLatLng(+pos.lat, +pos.lon, wrap);
					if (tracking) { map.panTo(curpos ? halfway(curpos, fpos) : fpos); }
					aniPhats(fpos, newhead, +pos.altitudeFt, timestamp, +pos.speedMph);
					setFlightPath();
					setFlightLabel();
					if (graph_on) { doGraph(); }
				}

				// map is ready, draw everything for the first time
				function mapReady(/* e */) {

			    if (view === '3D') {
			      $('#map_div').addClass('threed');
			    }

					// add additional zoom control buttons
					var $zoomdiv = $('.leaflet-control-zoom');
					// zoom in and turn on tracking
					$trackbutton = $(zoomcontrol._createButton('', 'Track Flight', 'leaflet-control-zoom-track', $zoomdiv[0],
							function(e) {
								if (tracking === 2) {
									tracking = 0;
									$trackbutton.css('background-color', '');
									setfullview(this);
								} else {
									tracking = 2;
									$trackbutton.css('background-color', '#d8e');
									settrackingview(this);
									setFlightPath();
								}
								L.DomEvent.stopPropagation(e);
							}, map)).css({'background-image': 'url(img/icon-track.png)', 'border-top': 'solid rgb(170, 170, 170) 1px' });
					// // zoom out to show entire flight
					// $(zoomcontrol._createButton('', 'Whole Flight', 'leaflet-control-zoom-flight', $zoomdiv[0],
					// 		function(e) {
					// 			tracking = false;
					// 			$trackbutton.css('background-color', '');
					// 			setfullview(this);
					// 			L.DomEvent.stopPropagation(e);
					// 		}, map)).css({'background-image': 'url(img/icon-full.png)' });
					map.on('dragstart', function(/* e */) {
						if (tracking === 2) {
							tracking = 1;
							$trackbutton.css('background-color', '');							
						}
					});

					if (debug) {	// interactive debug mode
						$(document).keydown(function(e) {
          		switch(e.which) {
          			case 71: // "g" graph
	          			if (graph_on) {	// hide graph
										$('#map_div').animate({height: '100%'}, 'fast');
										$('#graph1_div, #graph2_div').hide();
										graph_on = false;
									} else {	// show graph
										$('#graph1_div, #graph2_div').show();
										$('#map_div').animate({height: '80%'}, 'fast');
										graph_on = true;
										doGraph();
									}
          			break;
          			case 83: // "s" stop data
          				if (data_off === 0 || data_on !== 0) {	// first time
          					data_off = numpos;
          					data_on = 0;
          				} else {
          					data_on = numpos;
          					if (data_on === data_off) {
          						data_on = data_off = 0;
          					}
          				}
          				console.log('debug data_off: '+data_off+' data_on: '+data_on+' numpos: '+numpos+' frames: '+frames);
          			break;
          		}
          		e.stopPropagation();
          	});
					}

					// departing airport marker
					L.marker(dpos, {
							icon: L.icon({	// departing airport icon
									iconUrl: 'img/tower-blue.png',
									iconSize: [78, 145],
									iconAnchor: [17, 97],
									popupAnchor: [2, -93],
									labelAnchor: [7, -60]
							})
						}).addTo(map).bindLabel('<div class="labelhead">Depart '+departureAirport+'</div>'+depa.name+
								'<br />'+depa.city+(depa.stateCode ? ', '+depa.stateCode : '')+', '+depa.countryCode);
								// '<br />Local time: '+(new Date(depa.localTime).toLocaleTimeString());

					// arriving airport marker
					L.marker(apos, {
							icon: L.icon({	// arriving airport icon
									iconUrl: 'img/tower-orange.png',
									iconSize: [78, 145],
									iconAnchor: [17, 97],
									popupAnchor: [2, -93],
									labelAnchor: [7, -60]
							})
						}).addTo(map).bindLabel('<div class="labelhead">Arrive '+arrivalAirport+'</div>'+arra.name+
								'<br />'+arra.city+(arra.stateCode ? ', '+arra.stateCode : '')+', '+arra.countryCode);
								// '<br />Local time: '+(new Date(arra.localTime).toLocaleTimeString());	
					
					// do flight plan (waypoints)
					var p = flightData.waypoints;
					if (p) { // there is a flight plan
						var positions = new Array(p.length);
						for (var i = 0; i < p.length; i++) {
							positions[i] = createLatLng(+p[i].lat, +p[i].lon, wrap);
						}
						plan = L.polyline(positions, { color: '#939', weight: 5, dashArray: '18, 12'}).bindLabel('flight plan').addTo(map);
						layercontrol.addOverlay(plan, 'flight plan');
					} else { // if there is NO flight plan, draw great circle
						var npoints = Math.max(128 - 16 * map.getZoom(), 4);
						plan = L.polyline([dpos, apos], { color: '#939', weight: 6, dashArray: '1, 15'}).
								greatCircle(npoints).addTo(map).bindLabel(airline+flightnum+' route');
						layercontrol.addOverlay(plan, 'route');
					}

					// flight marker (airplane)
					var alt = +(pos.altitudeFt || airports[departureAirport].elevationFeet || airports[arrivalAirport].elevationFeet || 0);
					var heading = +(flightData.heading || flightData.bearing);
					if (flightData.positions.length > 2) {
						p = flightData.positions[2];
						var a2 = +(p.altitudeFt || alt);
						if (a2 > 40000) { a2 = alt; }	// fix bad data for airplanes on ground
						var fp2 = createLatLng(+p.lat, +p.lon, wrap);
						var speed = +pos.speedMph;
						// if (fp2.distanceTo(fpos) > speed * 53.6448) {	// more than 2 minutes of distance
						if (fp2.distanceTo(fpos) > speed * 100) {	// more than 3.7 minutes of distance
							phat(fpos, heading, alt, p.date);	// set initial position
						} else {
							phat(fp2, heading, a2, p.date);	// set initial position
							aniPhats(fpos, heading, +pos.altitudeFt, timestamp, +pos.speedMph);	// start airplane moving
						}
					} else {
						phat(fpos, heading, alt, p.date);	// set initial position
					}
					
					setFlightLabel();
					setFlightPath(); // draw actual flight position data

				} // end mapReady

				function setFlightPath(all) { // draw flight positions
					var p = flightData.positions;
					var positions = [];
					var last = null, ct, tail;
					var i = 1;
					if (all || !curpos || curspeed < 120) {	// draw all positions
						tail = createLatLng(+p[i].lat, +p[i].lon, wrap);
					} else { // find last point in flight path to be displayed
						var m = Math.min(p.length, 10);
						for ( ; i < m; i++) {
							tail = createLatLng(+p[i].lat, +p[i].lon, wrap);
							var h = calcHeading(curpos, tail);
							// console.log('angle for '+i+' = '+smallAngle(curheading, h), curheading, h);
							if (Math.abs(smallAngle(curheading, h)) > 90) { break; }
							// var angle = h - curheading;
							// angle = angle > 180 ? angle - 360 : (angle < -180 ? angle + 360 : angle );
							// if (angle > 90) { break; }
						}
					}
					multi = [[tail, tail]]; // dummy path for tail
					for (; i < p.length; i++) {
						ct = Date.parse(p[i].date);
						if (last) {
							if (Math.abs(ct - last) > 120000) {	// no data for 2 minutes
								multi.push(positions);
								positions = [];
							}
						}
						positions.push(createLatLng(+p[i].lat, +p[i].lon, wrap));
						last = ct;
					}
					multi.push(positions);
					if (path) {	// layer already exists
						path.setLatLngs(multi);
					} else {	// create layer
						path = L.multiPolyline(multi, { color: '#606', opacity: 0.8, weight: 2 }).addTo(map).bindLabel('flight path');
						layercontrol.addOverlay(path, 'flight path');
					}
				} // end setFlightPath

				// set position of airplane icon
				function phat(p, h, a, t) {	// position, heading, altitude, time
					curpos = p;
					currot = h;
					if (airplane) {
						airplane.rotate(h).setShadow(a).stamp(t).setLatLng(p);	// can't chain setLatLng because of bug
						if (tracking) { map.panTo(p); }
					} else {
						airplane = flightMarker(p).addTo(map).rotate(h).setShadow(a).stamp(t);
					}
				}	// end phat

				// update position of airplane, using animation
				function aniPhats(p, h, a, t, s) {	// position, heading, altitude, time, speed
					if (!isNaN(a)) { airplane.setShadow(a); }
					if (curpos) {	// calculate heading from positions
						h = calcHeading(curpos, p);
					}
					curheading = h;

					var dt = t - airplane.stamp();	// time delta between updates in milliseconds
					airplane.stamp(t);
					// if (dt > 120000 || map.getZoom() < 5) {	// don't animate jumps or low zoom levels
					if (dt > 240000) {	// don't animate jumps
						phat(p, h, a, t);
						// airplane.rotate(h).stamp(t).setLatLng(p);	// can't chain setLatLng because of bug
						// if (tracking) { map.panTo(p); }
						return;
					}

					if (debug && curspeed && Math.abs(s - curspeed) > 100) { console.log('speed jump', s, curspeed); }
					if (s) { curspeed = s; }	// valid speed

					var fminute = 60000 / aniRate;	// a minute of frames

					currot = (currot + 360) % 360;
					var turn = smallAngle(currot, h);
					// if (Math.abs(turn) > 90 && speed > 200) {	// stop plane from going backwards
					// 	return;
					// }					

					// number of frames to move that distance at current speed (s)
					frames = Math.floor(curpos.distanceTo(p) * 2236.936292 / (curspeed * aniRate));
					if (frames <= 0) {
						curpos = p;
						return;
					}
					if (debug) {  console.log('frames: '+frames+' at: '+curspeed+' mph'); }

					frames = Math.min(frames, fminute * 2);
					if (frames > fminute) {
						frames -= Math.ceil((frames - fminute) * 0.5);
					}
					rotframes = Math.ceil(frames/2);
					vlat = (p.lat - curpos.lat) / frames;
					vlng = (p.lng - curpos.lng) / frames;
					vrot =  turn / rotframes;
					if ((vrot > rotRate && curspeed > 200) || vrot > rotRate * 2) {	// max 2 degrees per second
						if (debug) { console.log('rotate limit: '+vrot); }
						vrot = rotRate;
						rotframes = turn / vrot;
					}

					// only continue on after loss of data if plane is at altitude and speed
					if (curspeed > 250 && a > 10000) {
						frames += fminute; // plus one more minute of frames
					}	

     			// animation timer
					if (!anitimer) {
						anitimer = setInterval(step, aniRate);	// airplane animation
					}

					function step() {	// animation step
						curpos = createLatLng(curpos.lat + vlat, curpos.lng + vlng, wrap);
						currot += vrot;
						if (!zooming) {	// don't update position while zooming animation is in progress
							airplane.rotate(currot).setLatLng(curpos);	// can't chain setLatLng because of bug
						// if (tracking) { map.panTo(curpos); }
							if (path) {	// draw tail
								multi[0][0] = curpos;
								path.setLatLngs(multi);
							}
						}
						if (frames <= 0) {	// stop movement
							vlat = 0;
							vlng = 0;
							vrot = 0;
							clearInterval(anitimer);
							anitimer = null;
						} else {
							if (rotframes <= 0) {
								vrot = 0;
							} else {
								rotframes--;
							}
							frames--;
						}
					}	// end step
				}	// end aniPhats

			} // end getFlight

			function doGraph() {	// draw graph
				$('#graph1_div, #graph2_div').empty();
				Morris.Line({
					element: 'graph1_div',
					data: flightData.positions,
					xkey: 'date',
					ykeys: ['altitudeFt'],
					labels: ['Altitude'],
					postUnits: ' ft',
					smooth: false,
					pointSize: 2,
					hideHover: true
				});	
				Morris.Line({
					element: 'graph2_div',
					data: flightData.positions,
					xkey: 'date',
					ykeys: ['speedMph'],
					labels: ['Speed'],
					postUnits: ' mph',
					smooth: false,
					pointSize: 2,
					hideHover: true,
					lineColors: ['#f08']
				});	
			}	// end doGraph

			function calcHeading(p1, p2) {	// heading in degrees of vector from p1 to p2
				var toRad = L.LatLng.DEG_TO_RAD;
				var lat1 = p1.lat * toRad,
						lat2 = p2.lat * toRad,
						dLng = (p2.lng - p1.lng) * toRad;
				return (Math.atan2(
						Math.sin(dLng)*Math.cos(lat2),
						Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng)) *
					L.LatLng.RAD_TO_DEG + 360) % 360;
			}

			function smallAngle(o, n) {	// smallest angle from o to n (degrees)
				var t = n - o;	// difference between new and old
				return t > 180 ? t - 360 : (t < -180 ? t + 360 : t );
			}

			//	function getStatus(data /*, status, xhr */) { // status callback
			//		if (!data || data.error) {
			//		alert('AJAX error: '+data.error.errorMessage);
			//		return;
			//	}
			//	if (console && console.log) { console.log('Flight status: ', data); }

			// }	// end getStatus

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

			function setfullview(m) { // set map view including both airports and current position of flight
				var flightBounds;	// area of world to display
				if (Math.abs(180 - Math.abs(dpos.lng - apos.lng)) < 5) {
					m.fitWorld();
					return;
				}
				if (wrap) { // shift by 180 degrees if flight crosses anti-meridian
					flightBounds = L.latLngBounds([
							[dpos.lat, dpos.lng+180],
							[apos.lat, apos.lng+180],
							[fpos.lat, fpos.lng+180]
						]).pad(0.05);
					var c = flightBounds.getCenter();
					m.setView(L.latLng(c.lat, c.lng - 180, true), m.getBoundsZoom(flightBounds));
				} else {
					flightBounds = L.latLngBounds([ dpos, apos, fpos ]).pad(0.05);
					m.fitBounds(flightBounds);
				}
			}

			function settrackingview(m) {
				if (fpos) { m.setView(fpos, maxZoom > 9 ? 9 : maxZoom); }
			}

		} // end mainloop

		mainloop();
		setInterval(mainloop, updateRate); // update every 10 seconds

		function setFlightLabel() {
			var label = (logo ? '<img class="labelimg" src="'+logourl+'" /><br />' :
						'<div class="labelhead fakelogo">'+airlines[flightData.carrierFsCode].name+'&nbsp;</div>')+
				'Flight: '+flightData.carrierFsCode+' #'+flightData.flightNumber+
				'<br />Route: '+departureAirport+' to '+arrivalAirport+
				(flightData.delayMinutes ? '<br />Delayed: '+flightData.delayMinutes+' min' : '<br />On Time')+
				'<br />Altitude: '+pos.altitudeFt+' ft'+
				'<br />Speed: '+pos.speedMph+' mph'+
				'<br />Heading: '+(+flightData.heading).toFixed()+'&deg;'+
				'<br />Bearing to '+arrivalAirport+': '+(+flightData.bearing).toFixed()+'&deg;'+
				'<br />Latitude: '+fpos.lat.toFixed(2)+
				'<br />Longitude: '+fpos.lng.toFixed(2)+
				'<br />Equipment: '+flightData.equipment;
			if (flightLabel) {
				flightLabel.updateLabelContent(label);
			} else {
				flightLabel = airplane.bindLabel(label);					
			}
		}

		function halfway(p1, p2) {	// return lat/lng halfway between two points
			return L.latLng(p1.lat + (p2.lat - p1.lat) * 0.5, p1.lng + (p2.lng - p1.lng) * 0.5, true);
		}

	});	// end document ready

	function createLatLng(lat, lon, wrap) {
				return L.latLng(lat, wrap && lon>0 ? lon-360 : lon, true);
	}

	function showMessage(message) {
		$('#message').html(message);
		$('#messagepopup').show().on('click', function() { $(this).hide(); });
	}

	// airplane flight marker
	var FlightMarker = L.Marker.extend({
		defaultFlightMarkerOptions: {
			icon: L.divIcon({ // airplane icon (rotatable)
					html: '<img class="airplaneshadow" src="img/shadow4.png" /><img class="airplaneicon" src="img/airplane-purple.png" />',
					iconSize: [62, 62],
					iconAnchor: [31, 31],
					labelAnchor: [15, -4],
					className: ''
			}),
			zIndexOffset: 1000
		},
		initialize: function (latlng) {
			L.Util.setOptions(this, this.defaultFlightMarkerOptions);
			this._latlng = L.latLng(latlng);
			this._stamp = 0;
		},
		rotate: function(deg) { // add rotate function to Marker class
			$(this._icon).find('img').rotate(deg); // css('transform', 'rotate('+deg+'deg)');			
			return this;
		},
		stamp: function(ds) {
			if (ds) {
				if (typeof ds === 'string') { ds = Date.parse(ds); }
				this._stamp = ds;
				return this;
			}
			return this._stamp;
		},
		setShadow: function(alt) {	// shadow for flight icon
			var $shadow = $(this._icon).find('.airplaneshadow');
			var offset = Math.round(alt * 0.0005); // shadow offset based on altitude
			var shimg = 'img/shadow'+ (Math.max(0, Math.min(9, Math.floor(alt / 3000))))+'.png'; // shadow image 0-9 (progressive blur)
			if ($shadow.attr('src') !== shimg) { $shadow.attr('src', shimg); }
			$shadow.css({opacity: 0.6, left: offset, top: offset});
			return this;
		},
		setActive: function(v) {	// change color when data feed lost
			$(this._icon).find('.airplaneicon').attr('src', v ? 'img/airplane-purple.png' : 'img/airplane-gray.png');
			return this;
		}
	});
	var flightMarker = function(latlng) { // factory
		return new FlightMarker(latlng);
	};

	// add great circle to Polyline
	L.Polyline.include({	// draw a polyline using geodesics
		greatCircle: function(npoints) {
			var points = [];
			var start = this._latlngs[0],
					end = this._latlngs[1];
			start.lng = (start.lng + 180) % 360 + ((start.lng < -180 || start.lng === 180) ? 180 : -180);
			end.lng = (end.lng + 180) % 360 + ((end.lng < -180 || end.lng === 180) ? 180 : -180);
			if (npoints <= 2) {
				points.push([start.lat, start.lng]);
				points.push([end.lat, end.lng]);
			} else {
				var D2R = L.LatLng.DEG_TO_RAD;
				var R2D = L.LatLng.RAD_TO_DEG;
				var startx = D2R * start.lng,
						starty = D2R * start.lat,
						endx = D2R * end.lng,
						endy = D2R * end.lat;
				var w = startx - endx,
						h = starty - endy;
				var g = 2.0 * Math.asin(Math.sqrt(Math.pow(Math.sin(h / 2.0), 2) +
                Math.cos(starty) * Math.cos(endy) * Math.pow(Math.sin(w / 2.0), 2)));
				var isg = 1 / Math.sin(g);
				var delta = 1.0 / (npoints - 1);
				var wrap = Math.abs(start.lng - end.lng) > 180; // does route cross anti-meridian
				for (var i = 0; i < npoints; i++) {
          var step = delta * i;
					var A = Math.sin((1 - step) * g) * isg;
					var B = Math.sin(step * g) * isg;
					var x = A * Math.cos(starty) * Math.cos(startx) + B * Math.cos(endy) * Math.cos(endx);
					var y = A * Math.cos(starty) * Math.sin(startx) + B * Math.cos(endy) * Math.sin(endx);
					// var z = A * Math.sin(starty) + B * Math.sin(endy);
					points.push(createLatLng(R2D *
							Math.atan2(A * Math.sin(starty) + B * Math.sin(endy), Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))),
							R2D * Math.atan2(y, x), wrap));
					// var lat = R2D * Math.atan2(z, Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)));
					// var lon = R2D * Math.atan2(y, x);
          // points.push(L.latLng(lat, wrap && lon>0 ? lon-360 : lon, true));
        }
			}
			this._latlngs = points;
			return this;
		}
	});

}(jQuery));

			//	window.handleResponse = function(data) { // results from Chris' API
			//		if (console && console.log) console.log('mobile API: ',data);
			//		p = data.PositionalUpdate;
			//		if (console && console.log) console.log('mobile API length: '+p.length,
			//				'actual start: ('+(+p[0].latitude).toFixed(4)+','+(+p[0].longitude).toFixed(4)+')');
			//		positions = new Array(p.length);
			//		for (i = 0; i < p.length; i++) {
			//			lon = p[i].longitude;
			//			positions[i] = L.latLng(p[i].latitude, lon>90 ? lon-360:lon, true);
			//		}
			//		var path = L.polyline(positions, { color: '#f22', opacity: 0.3, weight: 6 }).bindLabel('flight path').addTo(map);
			//		layercontrol.addOverlay(path, 'mobile API path');
			//	}	// end handleResponse
			// Call the mobile API
			// var url = 'http://www.flightstats.com/go/InternalAPI/singleFlightTracker.do?id='+flightID+'&airlineCode='+airline+'&flightNumber='+
			//		flightnum+'&version=1.0&key=49e3481552e7c4c9%253A-5b147615%253A12ee3ed13b5%253A-5f90&responseType=jsonp';
			//	var script = document.createElement('script');
			//	script.setAttribute('src', url);
			//	document.getElementsByTagName('head')[0].appendChild(script); // load the script
