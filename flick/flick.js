// FlightStats flight tracker
/*global L:false, jQuery:false */

(function($){
	"use strict";

	var updateRate = 10000;	// 10 seconds
	var aniRate = 250;	// 1/4 second

	// process URL parameters
	var flightID, // flightstats flight id
			airline,
			flightnum,
			timeFormat=12, // 12 or 24
			units='metric', // metric or US
			mapType = 'street', // name of map
			showWeather = false,
			graph_on = false; // true or false

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
	}

	getParams(window.location.href); // read parameters from URL

	if (flightID === undefined) { window.location = "flight.html"; } // setup tool -- remove for production

	var appId = '9543a3e8',
			appKey = '91d511451d9dbf38ede3efafefac5f09';

	var tiles = { // base maps
		street: L.tileLayer(
			'http://maptiles-{s}.flightstats-ops.com/surfer/{z}/{x}/{y}.png',
			{ subdomains: 'abcd',
				minZoom: 0, maxZoom: 11
		}),
		terrain: L.tileLayer(
			'http://maptiles-{s}.flightstats-ops.com/mapboxterrain/{z}/{x}/{y}.png',
			{	subdomains: 'abcd',
				minZoom: 0, maxZoom: 11
			}),
		satellite: L.tileLayer(
			'http://maptiles-{s}.flightstats-ops.com/satellite/{z}/{x}/{y}.png',
			{ subdomains: 'abcd',
				minZoom: 0, maxZoom: 11
		}),
		acetate: L.tileLayer(
			'http://maptiles-{s}.flightstats-ops.com/acetate/{z}/{x}/{y}.png',
			{ subdomains: 'abcd',
				minZoom: 0, maxZoom: 10
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

		// console.log('hey!');

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
		var tracking = false, $trackbutton, maxZoom = 11;
		var logo = false, logoimg, logourl;	// airline logo image and prefetch (for flight label)
		var flightLabel;	// label for the airplane icon
		var flightData,	// flight data returned by API
				pos,	// position data returned by API
				timestamp,	// time of API call
				nodata;	// haven't received data from API recently
		var curpos,	// current lat/lng of animation
				currot, // current heading of animation
				frames = 0,	// frame of animation remaining
				anitimer;	// animation timer
		var vlat, vlng, vrot;	// velocities for animation

		var map = L.map('map_div', {	// create map
			attributionControl: false,
			zoomControl: false,
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
			});

		// get position data from API
		function mainloop() {

			$.ajax({  // Call Flight Track by flight ID API
					url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/track/' + flightID,
					data: { appId: appId, appKey: appKey, includeFlightPlan: plan===undefined, extendedOptions: 'includeNewFields' },
					dataType: 'jsonp',
					success: getFlight
				});

			// $.ajax({	// Call Flight Status by flight ID API
			// 		url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/status/' + flightID,
			// 		data: { appId: appId, appKey: appKey, extendedOptions: 'includeNewFields' },
			// 		dataType: 'jsonp',
			// 		success: getStatus
			// });

			function getFlight(data /*, status, xhr */) { // callback
				if (!data || data.error) {
					alert('AJAX error: '+data.error.errorMessage);
					return;
				}

				var lon;	// temp variable for longitude

				flightData = data.flightTrack;
				var newpos = flightData.positions[0];
				var newdate = Date.parse(newpos.date);
				if (timestamp === undefined) { timestamp = newdate; }	// if uninitialized
				timestamp += updateRate;	// 10 seconds
				// if (console && console.log) console.log(timestamp - newdate);
				if (timestamp - newdate > 120000) {	// two minutes
					if (!nodata) {
						if (console && console.log) { console.log('position data lost '+timestamp); }
						airplane.setActive(false);
						setPositions(true);
						// $('.airplaneicon').attr('src', 'img/airplane-gray.png');
					}
					nodata = true;
				}

				if (pos && newpos.lat === pos.lat && newpos.lon === pos.lon &&
						newpos.date === pos.date && pos.altitudeFt === newpos.altitudeFt) {
					return; // no new data
				}
				pos = newpos;
				timestamp = newdate;
				if (nodata) {
					nodata = false;
					if (console && console.log) { console.log('position data reestablished '+timestamp); }
					airplane.setActive(true);
					// $('.airplaneicon').attr('src', 'img/airplane-purple.png');
				}
				if (console && console.log) { console.log('Flex API data: ', data); }

				if (airports === undefined) { // first time called
					airports = getAppendix(data.appendix.airports);
					airlines = getAppendix(data.appendix.airlines);
					departureAirport = flightData.departureAirportFsCode;
					var depa = airports[departureAirport];
					arrivalAirport = flightData.arrivalAirportFsCode;
					var arra = airports[arrivalAirport];

					// Need to update this test to take into account flights that fly the "wrong" way around
					// the world. In particular Singapore to New York (because of the wind).
					// Could do this by looking at flight plan, except flight plan is sometimes wrong.
					// See https://www.pivotaltracker.com/projects/709005#!/stories/40465187
					// See setfullview for hack to fix Singapore flights
					wrap = Math.abs(depa.longitude - arra.longitude) > 180; // does route cross anti-meridian?

					lon = +depa.longitude;
					dpos = L.latLng(+depa.latitude, wrap && lon>0 ? lon-360 : lon, true);
					lon = +arra.longitude;
					apos = L.latLng(+arra.latitude, wrap && lon>0 ? lon-360 : lon, true);
					lon = +pos.lon;
					fpos = L.latLng(+pos.lat, wrap && lon>0 ? lon-360 : lon, true);
					currot = +(flightData.heading || flightData.bearing);

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
					if (tracking) { map.panTo(fpos); }
					lon = +pos.lon;
					fpos = L.latLng(+pos.lat, wrap && lon>0 ? lon-360 : lon, true);
					phat(fpos, +(flightData.heading || flightData.bearing), +pos.altitudeFt, timestamp);
					setPositions();
					setFlightLabel();
					doGraph();
				}

				// map is ready, draw everything for the first time
				function mapReady(/* e */) {

					// add additional zoom control buttons
					var $zoomdiv = $('.leaflet-control-zoom');
					// zoom in and turn on tracking
					$trackbutton = $(zoomcontrol._createButton('Track Flight', 'leaflet-control-zoom-track', $zoomdiv[0],
							function(/* e */) {
								tracking = true;
								$trackbutton.css('background-color', '#d8e');
								settrackingview(this);
								setPositions();
							}, map)).css({'background-image': 'url(img/icon-track.png)', margin: '5px 0' });
					// zoom out to show entire flight
					$(zoomcontrol._createButton('Whole Flight', 'leaflet-control-zoom-flight', $zoomdiv[0],
							function(/* e */) {
								tracking = false;
								$trackbutton.css('background-color', '');
								setfullview(this);
							}, map)).css({'background-image': 'url(img/icon-full.png)', margin: '5px 0' });
					$(zoomcontrol._createButton('Show Graph', 'leaflet-control-show-graph', $zoomdiv[0],
							function(/* e */) {
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
							}, map)).css({'background-image': 'url(img/icon-graph.png)' });
					map.on('dragstart', function(/* e */) {
						if (tracking) {
							tracking = false;
							$trackbutton.css('background-color', '');							
						}
					});

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
							lon = +p[i].lon;
							positions[i] = L.latLng(+p[i].lat, wrap && lon>0 ? lon-360 : lon, true);
						}
						plan = L.polyline(positions, { color: '#939', weight: 5, dashArray: '18, 12'}).bindLabel('flight plan').addTo(map);
						layercontrol.addOverlay(plan, 'flight plan');
					} else { // if there is NO flight plan, draw great circle
						var npoints = Math.max(128 - 16 * map.getZoom(), 4);
						plan = L.polyline([dpos, apos], { color: '#939', weight: 6, dashArray: '1, 12'}).
								greatCircle(npoints).addTo(map).bindLabel(airline+flightnum+' route');
						layercontrol.addOverlay(plan, 'route');
					}

					setPositions(); // draw actual flight position data

					// flight marker (airplane)
					var alt = +(pos.altitudeFt || airports[departureAirport].elevationFeet || airports[arrivalAirport].elevationFeet || 0);
					var heading = +(flightData.heading || flightData.bearing);
					if (flightData.positions.length >= 2) {
						p = flightData.positions[1];
						var a2 = +(p.altitudeFt || alt);
						if (a2 > 5000) { a2 = alt; }	// fix bad data for airplanes on ground
						lon = +p.lon;
						var fp2 = L.latLng(+p.lat, wrap && lon>0 ? lon-360 : lon, true);
						curpos = fp2;
						airplane = flightMarker(fp2).addTo(map).rotate(heading).setShadow(a2).stamp(p.date);
						phat(fpos, heading, +pos.altitudeFt, timestamp);	// start airplane moving
					} else {
						airplane = flightMarker(fpos).addTo(map).rotate(heading).setShadow(alt).stamp(p.date);
					}
					
					setFlightLabel();

				} // end mapReady

				function setPositions(all) { // draw flight positions
					var p = flightData.positions;
					var positions = [];
					var last = null, ct;
					var i = tracking && !all ? 2 : 0;
					var lon = +p[i].lon;
					var tail = L.latLng(+p[i].lat, wrap && lon>0 ? lon-360 : lon, true);	// last point in flight path displayed
					multi = [[tail, tail]]; // dummy path for tail
					for (; i < p.length; i++) {
						ct = Date.parse(p[i].date);
						if (last) {
							if (Math.abs(ct - last) > 600000) {	// no data for 10 minutes
								multi.push(positions);
								positions = [];
							}
						}
						lon = +p[i].lon;
						positions.push(L.latLng(+p[i].lat, wrap && lon>0 ? lon-360 : lon, true));
						last = ct;
					}
					multi.push(positions);
					if (path) {	// layer already exists
						path.setLatLngs(multi);
					} else {	// create layer
						path = L.multiPolyline(multi, { color: '#606', opacity: 0.8, weight: 2 }).addTo(map).bindLabel('flight path');
						layercontrol.addOverlay(path, 'flight path');
					}
				} // end setPositions

				// update position of airplane, using animation
				function phat(p, h, a, t) {	// position, heading, altitude, time
					if (!isNaN(a)) { airplane.setShadow(a); }
					if (curpos) {	// calculate heading from positions
						h = (90 + (Math.atan2(curpos.lat - p.lat, p.lng - curpos.lng) * L.LatLng.RAD_TO_DEG)) % 360;
						if (h < 0) { h += 360; }
					}
					currot %- 360;
					if (currot < 0) { currot += 360; }
					var turn = h - currot;	// calculate shortest turn
					turn = turn > 180 ? turn - 360 : (turn < -180 ? turn + 360 : turn );
					var dt = t - airplane.stamp();	// time delta between updates in milliseconds
					airplane.stamp(t);
					if (dt > 120000 || map.getZoom() < 5) {	// don't animate jumps or low zoom levels
						airplane.rotate(h).stamp(t).setLatLng(p);	// can't chain setLatLng because of bug
						if (tracking) { map.panTo(p); }
						return;
					}
					var speed = curpos.distanceTo(p) * 1000 / dt; // in meters / second
					// console.log(speed, dt);
					frames = Math.floor(dt / aniRate);	// add number of frames for this move
					vlat = (p.lat - curpos.lat) / frames;
					vlng = (p.lng - curpos.lng) / frames;
					vrot =  turn / frames;
					// if (speed > 343.2) { // limit to the speed of sound in meters/sec
     //        var speedratio = 343.2 / speed;
     //        vlat *= speedratio;
     //        vlng *= speedratio;
     //        frames = Math.floor(frames / speedratio);
     //      }
     //      if (Math.abs(turn / dt) > 2000) {  // maximum turn rate 2 degrees per second
     //        vrot = (vrot > 0 ? 0.002 : -0.002) * dt;
     //      }
					if (!anitimer) {
						anitimer = setInterval(function() {
							// console.log(frames, vlat, vlng, vrot);
							var lon = curpos.lng + vlng;
							curpos = L.latLng(curpos.lat + vlat, wrap && lon>0 ? lon-360 : lon, true);
							currot += vrot;
							airplane.rotate(currot).setLatLng(curpos);	// can't chain setLatLng because of bug
							// if (tracking) { map.panTo(curpos); }
							if (path) {	// draw tail
								multi[0][0] = curpos;
								path.setLatLngs(multi);
							}
							if (frames <= 0) {	// stop movement
								vlat = 0;
								vlng = 0;
								vrot = 0;
							} else { frames--; }
						}, aniRate);
					}
				}	// end phat

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
			}

			function getStatus(data /*, status, xhr */) { // status callback
				if (!data || data.error) {
					alert('AJAX error: '+data.error.errorMessage);
					return;
				}
				if (console && console.log) { console.log('Flight status: ', data); }

			}	// end getStatus

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

	});	// end document ready

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
			$(this._icon).find('img').css('transform', 'rotate('+deg+'deg)');			
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
					var z = A * Math.sin(starty) + B * Math.sin(endy);
					var lat = R2D * Math.atan2(z, Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)));
					var lon = R2D * Math.atan2(y, x);
          points.push(L.latLng(lat, wrap && lon>0 ? lon-360 : lon, true));
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
