// FlightStats flight tracker
/*global L:false, jQuery:false, Morris:false */

(function($){
	"use strict";

	// tuning parameters
	var updateRate = 10000;	// 10 seconds
	var aniRate = 250;	// 1/4 second
	var rotRate = aniRate / 500;	// 2 degrees per second max

	var map;
	var airports, airlines;	// appendices from API
	var departureAirport,	// code of departure airport
			dpos,	// lat/lng position of departure airport
			arrivalAirport,	// code of arrival airport
			apos,	// lat/lng position of arrival airport
			airplane,	// L.marker for airplane icon
			fpos,	// lat/lng position of airplane
			multi,	// lat/lngs for flight path
			layers = {
				pathHalo: null, path: null,	// actual path
				planHalo: null, plan: null,	// flight plan (if available)
				arcHalo: null, arc: null,	// shortest arc (geodesic)
				mini: null },
			wrap;	// does route cross the anti-meridian?
	var maxZoom = 12;
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
	var numpos, // debug stuff
			data_off = 0,	// index of where data is off for testing
			data_on = 0;	// index of where data is back on
	var trackcontrol, layercontrol, drawercontrol;	// UI
	var fullscreentimer, hidecontrols, unhidecontrols, drawerwasopen = false;	// hide buttons and drawer timer

	// process URL parameters
	var flightID, // flightstats flight id
			airline,
			flightnum,
			// timeFormat=12, // 12 or 24
			// units='metric', // metric or US
			mapType = 'sat', // name of map
			showWeather = false,
			view = '2D',
			debug = false,	// interactive debug
			zoom = 'auto',	// show zoom control
			hide = 'auto';	// auto hide controls

	function getParams(p) {
    var params = {}; // parameters
    p.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { params[key] = value; });

    if (params.id) { flightID = params.id; }
    // if (params.timeFormat) { timeFormat = +params.timeFormat; }
    // if (params.units) { units = params.units; }
    if (params.mapType) { mapType = params.mapType; }
    if (params.showWeather) { showWeather = params.showWeather === 'true'; }
    if (params.airline) { airline = params.airline; }
    if (params.flight) { flightnum = params.flight; }
    if (params.view) { view = params.view.toUpperCase(); }	// 3D or 3d
    if (params.debug) { debug = params.debug === 'true'; }
    if (params.hide) { hide = params.hide === 'true'; }
    if (params.zoom) { zoom = params.zoom === 'true'; }
	}

	getParams(window.location.href); // read parameters from URL
	if (hide === 'auto') { hide = L.Browser.touch; }
	if (zoom === 'auto') { zoom = !L.Browser.touch; }

	if (flightID === undefined) { // setup tool -- remove for production
		window.location = 'flight.html?debug='+debug+'&hide='+hide+'&zoom='+zoom;
	} 

	if (debug) {	// interactive debug mode
		$(document).keydown(function(e) {
			switch(e.which) {
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
	}

	var appId = '9543a3e8',
			appKey = '91d511451d9dbf38ede3efafefac5f09';

	var tiles = { // base maps
		sat: L.tileLayer(
			'http://maps{s}.flightstats.com/aerial/{z}/{x}/{y}.png',
			{ subdomains: '1234',
				zIndex: 2,
				minZoom: 0, maxZoom: 12
		}),
		map: L.tileLayer(
			'http://maps{s}.flightstats.com/streets/{z}/{x}/{y}.png',
			{ subdomains: '1234',
				zIndex: 2,
				minZoom: 0, maxZoom: 12
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

	var overlays = {
		weather: new L.TileLayer.FSWeather({
			opacity: '0.5',
			// attribution: "Weather data &copy; 2011 IEM Nexrad",
			zIndex: 4,
			minZoom: 2, maxZoom: 6
		}),
		labels: L.tileLayer(
			// 'http://129.206.74.245:8003/tms_h.ashx?x={x}&y={y}&z={z}',
			'http://maps{s}.flightstats.com/labels/{z}/{x}/{y}.png',
			{ subdomains: '1234',
			zIndex: 5,
				minZoom: 0, maxZoom: 12
		}),
		terrain: L.tileLayer(
			// 'http://129.206.74.245:8004/tms_hs.ashx?x={x}&y={y}&z={z}',
			'http://maps{s}.flightstats.com/terrain/{z}/{x}/{y}.png',
			{ subdomains: '1234',
				opacity: 0.7,
				zIndex: 3,
				minZoom: 0, maxZoom: 12
		})
	};

	var defaultlayers = [tiles[mapType]];	// default map layers
	if (showWeather) { defaultlayers.push(overlays.weather); }
	// var scalecontrol = L.control.scale();

	$(document).ready(function() {

		trackcontrol = new TrackControl();
		layers = $.extend(layers, tiles, overlays);
		layercontrol = new LayerControl(layers);

		function flightinfo() {	// info about flight for drawer
			var airlinename = airlines[flightData.carrierFsCode].name
			return (logo ? '<img class="labelimg" src="'+logourl+'" /><br />' :
							'<div class="labelhead fakelogo">'+airlinename+'&nbsp;</div>')+
					'<div style="text-align:center;width:100%">('+flightData.carrierFsCode+') '+airlinename+' #'+flightData.flightNumber+
					(flightData.delayMinutes >= 15 ? '<br /><span style="color:red">Delayed by '+flightData.delayMinutes+' minutes</span>' : '<br />On Time')+'</div>'+
					'<table id="flightinfo"><tr><td>Route:</td><td class="t2">'+departureAirport+' to '+arrivalAirport+'</td></tr>'+
					'<tr><td>Altitude:</td><td class="t2">'+pos.altitudeFt+' ft ('+(pos.altitudeFt * 0.3048).toFixed()+' m)</td></tr>'+
					'<tr><td>Speed:</td><td class="t2">'+pos.speedMph+' mph ('+(pos.speedMph * 1.60934).toFixed()+' kph)</td></tr>'+
					'<tr><td>Heading:</td><td class="t2">'+(+(flightData.heading?flightData.heading:flightData.bearing)).toFixed()+' degrees</td></tr>'+
					'<tr><td>Equipment:</td><td class="t2">'+flightData.equipment+'</td></tr></table>';
		}
		drawercontrol = new DrawerControl(flightinfo);

    // create map
		map = L.map('map_div', {	// create map
			attributionControl: false,
			doubleClickZoom: false,
			zoomControl: false,
			zoomAnimation: true,
			markerZoomAnimation: true,
			layers: defaultlayers,
			worldCopyJump: false
		});
		map.addLayer(layercontrol).addLayer(trackcontrol).addLayer(drawercontrol).
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

		hidecontrols = function() {
			if (hide && !drawercontrol.expanded() && !layercontrol.expanded()) {
				$('#control').fadeOut(1000);
				$('.leaflet-control-container').fadeOut(1000);
				drawercontrol.hide();
			}
		};

		unhidecontrols = function() {	// unhide
			if (hide) {
				clearTimeout(fullscreentimer);
				$('#control').finish().fadeIn(100);
				$('.leaflet-control-container').finish().fadeIn(100);
				drawercontrol.unhide();
				fullscreentimer = setTimeout(hidecontrols, 5000);
			}
		};

		if (hide) {
			fullscreentimer = setTimeout(hidecontrols, 10000);
			map.on('click', unhidecontrols);
		}

		if (zoom) {
			map.addControl(L.control.zoom());
			$('.leaflet-control-zoom.leaflet-bar').css('margin','60px 0 0 18px');
		}

		// if tracking is on, don't recenter on double-click zoom
		map.on('dblclick', function(e) {
			if (trackcontrol.isTracking()) {
				map.zoomIn(1);
			} else {
				map.setView(e.latlng, this._zoom + 1);
			}
			return false;
		}).on('dragstart', trackcontrol.reset, trackcontrol);	// turn off tracking on drag

		// --------------------------
		// get position data from API
		function mainloop() {

			$.ajax({  // Call Flight Track by flight ID API
					url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/track/' + flightID,
					data: { appId: appId, appKey: appKey, includeFlightPlan: layers.plan===null, extendedOptions: 'includeNewFields' },
					dataType: 'jsonp',
					success: getFlight
				});

			//	$.ajax({	// Call Flight Status by flight ID API
			//		url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/status/' + flightID,
			//		data: { appId: appId, appKey: appKey, extendedOptions: 'includeNewFields' },
			//		dataType: 'jsonp',
			//		success: getStatus
			//	});

			// Ajax success handler
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
				if (timestamp - newdate > 120000) {	// two minutes
					if (!nodata) {
						showMessage('This flight is temporarily beyond the range of our tracking network or over a large body of water');
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
					logourl = 'http://dem5xqcn61lj8.cloudfront.net/NewAirlineLogos/'+ac+'/'+ac+'_150x50.png';
					// prefetch image
					logoimg = $('<img/>'); // prefetch logo
					logoimg.load(function(/* e */) {	// if image exists, use it
						logo = true;
					});
					logoimg.attr('src', logourl);	// prefetch image

					map.on('load', mapReady);
					setfullview(map);

				} else {	// update
					fpos = createLatLng(+pos.lat, +pos.lon, wrap);
					if (trackcontrol.isTracking()) { map.panTo(curpos ? halfway(curpos, fpos) : fpos); }
					aniPhats(fpos, newhead, +pos.altitudeFt, timestamp, +pos.speedMph);
					setFlightPath();
					drawercontrol.update();
				}

				// ------------------------------------------------
				// map is ready, draw everything for the first time
				function mapReady(/* e */) {

					if (view === '3D') {
						$('#map_div').addClass('threed');
					}

					function depinfo() {
						return '<div class="labelhead">Departing '+departureAirport+'</div>'+depa.name+
								'<br />'+depa.city+(depa.stateCode ? ', '+depa.stateCode : '')+', '+depa.countryCode;
							// '<br />Local time: '+(new Date(depa.localTime).toLocaleTimeString();
					}

					// departing airport marker
					L.marker(dpos, {
							icon: L.icon({	// departing airport icon
									iconUrl: 'img/tower-blue.png',
									iconSize: [78, 145],
									iconAnchor: [17, 97],
									popupAnchor: [2, -93]
							})
						}).addTo(map).on('click', function(e) {
							drawercontrol.content(depinfo);
						});								

					function arrinfo() {
						return '<div class="labelhead">Arriving '+arrivalAirport+'</div>'+arra.name+
								'<br />'+arra.city+(arra.stateCode ? ', '+arra.stateCode : '')+', '+arra.countryCode;
								// '<br />Local time: '+(new Date(arra.localTime).toLocaleTimeString();
					}

					// arriving airport marker
					L.marker(apos, {
							icon: L.icon({	// arriving airport icon
									iconUrl: 'img/tower-orange.png',
									iconSize: [78, 145],
									iconAnchor: [17, 97],
									popupAnchor: [2, -93]
							})
						}).addTo(map).on('click', function(e) {
							drawercontrol.content(arrinfo);
						});
					
					// do shortest arc (geodesic)
					var npoints = Math.max(128 - 16 * map.getZoom(), 4);
					layers.arcHalo = L.polyline([dpos, apos], { color: '#828483', opacity: 0.4, weight: 8}).greatCircle(npoints);
					layers.arc = L.polyline([dpos, apos], { color: '#D1D1D2', opacity: 0.6, weight: 6}).greatCircle(npoints);
					// layers.arcHalo = L.polyline([dpos, apos], { color: '#828', opacity: 0.3, weight: 3}).greatCircle(npoints);
					// layers.arc = L.polyline([dpos, apos], { color: '#3f3', opacity: 0.5, weight: 1}).greatCircle(npoints);

					// do flight plan (waypoints) if available
					var p = flightData.waypoints;
					if (p) { // there is a flight plan
						var positions = new Array(p.length);
						for (var i = 0; i < p.length; i++) {
							positions[i] = createLatLng(+p[i].lat, +p[i].lon, wrap);
						}
						layers.planHalo = L.polyline(positions, { color: '#D1D1D2', opacity: 0.4, weight: 12 }).addTo(map);
						layers.plan = L.polyline(positions, { color: '#362F2D', opacity: 0.6, weight: 8 }).addTo(map);
						// layers.planHalo = L.polyline(positions, { color: '#000', opacity: 0.3, weight: 5 }).addTo(map);
						// layers.plan = L.polyline(positions, { color: '#3f3', opacity: 0.5, weight: 3 }).addTo(map);
					} else {
						layers.arcHalo.addTo(map);
						layers.arc.addTo(map);
						layercontrol.noPlan();
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
					
					setFlightPath(); // draw actual flight position data

				} // end mapReady

				// set position of airplane icon
				function phat(p, h, a, t) {	// position, heading, altitude, time
					curpos = p;
					currot = h;
					if (airplane) {
						airplane.rotate(h).setShadow(a).stamp(t).setLatLng(p);	// can't chain setLatLng because of bug
						if (trackcontrol.isTracking()) { map.panTo(p); }
					} else {
						airplane = flightMarker(p).addTo(map).rotate(h).setShadow(a).stamp(t);
						airplane.on('click', function(e) {
							drawercontrol.content(flightinfo);
						});
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
					//	return;
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
							if (layers.path) {	// draw tail
								multi[0][0] = curpos;
								layers.pathHalo.setLatLngs(multi);
								layers.path.setLatLngs(multi);
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

		} // end mainloop

		mainloop();
		setInterval(mainloop, updateRate); // update every 10 seconds

		function halfway(p1, p2) {	// return lat/lng halfway between two points
			return L.latLng(p1.lat + (p2.lat - p1.lat) * 0.5, p1.lng + (p2.lng - p1.lng) * 0.5, true);
		}

	});	// end document ready

	function createLatLng(lat, lon, wrap) {
				return L.latLng(lat, wrap && lon>0 ? lon-360 : lon, true);
	}

	function showMessage(message) {
		$('#message').html(message);
		$('#messagepopup').show().on('click', function(e) { $(this).hide(); });
	}

	// airplane flight marker
	var FlightMarker = L.Marker.extend({
		defaultFlightMarkerOptions: {
			icon: L.divIcon({ // airplane icon (rotatable)
					html: '<img class="airplaneshadow" src="img/shadow4.png" /><img class="airplaneicon" src="img/plane.png" />',
					iconSize: [48, 48],	// airplane-purple.png [62, 62],
					iconAnchor: [24, 24],	// [31, 31],
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
			var offset = Math.round(alt * 0.0004); // shadow offset based on altitude
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

	// ---------------------------------------------------------
	// DrawerControl displays information about items on the map
	var DrawerControl = L.Class.extend({

		initialize: function(dfun) {
			this._defaultfun = dfun;
			this._fun = dfun;
		},

		onAdd: function(map) {
			this._map = map;
			this._expanded = false;	// is drawer open?
			this._visible = true;	// is drawer and pull showing or hidden

			var drawer = L.DomUtil.get('drawer');

			L.DomEvent.on(drawer, 'click', this._toggle, this)
						.on(drawer, 'click', L.DomEvent.stop);
		},

		onRemove: function(map) {

		},

		_toggle: function(e) {
			if (this._expanded) {
				this.collapse(e);
				fullscreentimer = setTimeout(hidecontrols, 5000);
			} else {
				unhidecontrols();
				this.expand(e);
			}
		},

		expand: function() {
			drawerwasopen = false;
			if ($('#drawer-content').html() === '') {
				$('#drawer-content').html(this._fun());
			}
			$('#drawer').animate({bottom: 0}, 200);
			this._expanded = true;
			$('#drawer-pull').css('cursor', 's-resize');
			if (layercontrol.expanded()) { layercontrol.collapse(); }
			return this;
		},

		collapse: function() {
			$('#drawer').animate({bottom: -200}, 200);
			this._expanded = false;
			$('#drawer-pull').css('cursor', 'n-resize');
			return this;
		},

		expanded: function() {
			return this._expanded;
		},

		hide: function() {
			$('#drawer').animate({bottom: -215}, 500);
		},

		unhide: function() {
			if (!this._expanded) {
				$('#drawer').finish();
				$('#drawer').animate({bottom: -200}, 200);
			}
		},

		content: function(fun) {
			this._fun = fun;
			$('#drawer-content').html(fun());
			if (!this._expanded) { this.expand(); }
		},

		update: function() {
			if (this._fun !== this._defaultfun) { return; }
			var info = this._fun();
			if (info !== $('#drawer-content').html()) {
				$('#drawer-content').html(info);
			}
		}

	});

	// ---------------------------------------------------------
	// LayerControl is used to select basemaps and overlays
	var LayerControl = L.Class.extend({

		initialize: function(layers, controller) {
			this._layers = layers;
			this._controller = controller;
		},

		onAdd: function(map) {
			this._map = map;
			this._expanded = false;
			this._overlays = { labels: false, terrain: false };
			this._mini = true;	// mini-tracker

			var toggle = L.DomUtil.get('control-layer-toggle');
			var list = L.DomUtil.get('control-layer-list');

			L.DomEvent.on(toggle, 'click', this.expand, this)
						.on(toggle, 'click', L.DomEvent.stop);
			this._map.on('dragstart', this.collapse, this)
						.on('click', this.collapse, this);
			if (L.Browser.touch) {
				L.DomEvent.on(list, 'click', L.DomEvent.stopPropagation)
						.on(toggle, 'click', L.DomEvent.stopPropagation);
			} else {
				L.DomEvent.on(list, 'mousewheel', L.DomEvent.stopPropagation);
			}

			if (this._map.hasLayer(this._layers.sat)) {
				$('#layer-sat').attr('checked', 'checked');
				$('#layer-overlay-name').text('LABELS');
				if (this._map.hasLayer(this._layers.labels)) { this._labels = true; }
			} else {
				$('#layer-map').attr('checked', 'checked');
				$('#layer-overlay-name').text('TERRAIN');				
				if (this._map.hasLayer(this._layers.terrain)) { this._terrain = true; }
			}

			// click on satellite basemap
			L.DomEvent.on(L.DomUtil.get('layer-sat'), 'click', function(e) {
				if (this._map.hasLayer(this._layers.map)) {
					this._map.removeLayer(this._layers.map);
					$('#layer-overlay').removeProp('checked');
					if (this._overlays.terrain) { this._map.removeLayer(this._layers.terrain) }
					this._map.addLayer(this._layers.sat, true);
					$('#layer-overlay-name').text('LABELS');
					if (this._overlays.labels) {
						$('#layer-overlay').prop('checked', 'checked');
						this._map.addLayer(this._layers.labels);
					}
				}
			}, this);

			// click on map basemap (street)
			L.DomEvent.on(L.DomUtil.get('layer-map'), 'click', function(e) {
				if (this._map.hasLayer(this._layers.sat)) {
					this._map.removeLayer(this._layers.sat);
					$('#layer-overlay').removeProp('checked');
					if (this._overlays.labels) { this._map.removeLayer(this._layers.labels); }
					this._map.addLayer(this._layers.map, true);
					$('#layer-overlay-name').text('TERRAIN');
					if (this._overlays.terrain) {
						$('#layer-overlay').prop('checked', 'checked');
						this._map.addLayer(this._layers.terrain);
					}
					
				}
			}, this);

			// click on overlay (labels or terrain)
			L.DomEvent.on(L.DomUtil.get('layer-overlay'), 'click', function(e) {
				var overlay = $('#layer-overlay:checked');
				var layer = $('#layer-overlay-name').text() === 'LABELS' ? 'labels' : 'terrain';
				if (overlay.length > 0) {
					this._map.addLayer(this._layers[layer]);
					this._overlays[layer] = true;
				} else {
					this._map.removeLayer(this._layers[layer]);
					this._overlays[layer] = false;
				}
			}, this);

			// click on actual path
			L.DomEvent.on(L.DomUtil.get('layer-path'), 'click', function(e) {
				if ($('#layer-path:checked').length > 0) {
					this._map.addLayer(this._layers.pathHalo).addLayer(this._layers.path);
					this._layers.pathHalo.bringToFront();
					this._layers.path.bringToFront();
				} else {
					this._map.removeLayer(this._layers.pathHalo);
					this._map.removeLayer(this._layers.path);
				}
			}, this);

			// click on flight plan
			L.DomEvent.on(L.DomUtil.get('layer-plan'), 'click', function(e) {
				if ($('#layer-plan:checked').length > 0) {
					this._map.addLayer(this._layers.planHalo).addLayer(this._layers.plan);
					this._layers.plan.bringToBack();
					this._layers.planHalo.bringToBack();
				} else {
					this._map.removeLayer(this._layers.planHalo);
					this._map.removeLayer(this._layers.plan);
				}
			}, this);

			// click on shortest arc (geodesic)
			L.DomEvent.on(L.DomUtil.get('layer-arc'), 'click', function(e) {
				if ($('#layer-arc:checked').length > 0) {
					this._map.addLayer(this._layers.arcHalo).addLayer(this._layers.arc);
					this._layers.arc.bringToBack();
					this._layers.arcHalo.bringToBack();
				} else {
					this._map.removeLayer(this._layers.arcHalo);
					this._map.removeLayer(this._layers.arc);
				}
			}, this);

			// click on mini-tracker
			L.DomEvent.on(L.DomUtil.get('layer-mini'), 'click', function(e) {
				if ($('#layer-mini:checked').length > 0) {
					// $('<iframe>', { src: 'http://client-test.cloud-east.dev:3500/tracker'}).appendTo('#mini-tracker');
					this._mini = true;
					$('#mini-tracker').show();
				} else {
					// $('#mini-tracker').empty();
					this._mini = false;
					$('#mini-tracker').hide();
				}
			}, this);

			// click on weather
			L.DomEvent.on(L.DomUtil.get('layer-weather'), 'click', function(e) {
				if ($('#layer-weather:checked').length > 0) {
					this._map.addLayer(this._layers.weather);
				} else {
					this._map.removeLayer(this._layers.weather);
				}
			}, this);

		},

		onRemove: function(map) {

		},

		expanded: function() {
			return this._expanded;
		},

		expand: function(e) {
			if (drawercontrol.expanded()) {
				drawerwasopen = true;
				drawercontrol.collapse();
			}
			unhidecontrols();
			if (this._expanded) {
				this.collapse();
				fullscreentimer = setTimeout(hidecontrols, 5000);
			} else {
				$('#control-layer-list').show(100,'linear');
				this._expanded = true;
			}
		},

		collapse: function(e) {
			unhidecontrols();
			$('#control-layer-list').hide(100,'linear');
			this._expanded = false;
			if (drawerwasopen) {
				drawercontrol.expand();
			}
		},

		noPlan: function() {	// no flight plan available
			$('input#layer-plan').removeProp('checked').attr('disabled', 'disabled');
			$('#layer-plan-name').css({color: '#aaa'});
			$('input#layer-arc').prop('checked','checked');
		},

		isMini: function() {
			return this._mini;
		}

	});

	// ---------------------------------------------------------
	// TrackControl is used to track the flight and zoom the map
	var TrackControl = L.Class.extend({

		onAdd: function(map) {

			this._map = map;
			this._tracking = 0;

			var link = this._link = L.DomUtil.get('control-track');
			L.DomEvent
					.on(link, 'click', L.DomEvent.stop)
					.on(link, 'mousedown', L.DomEvent.stop)
					.on(link, 'dblclick', L.DomEvent.stop)
					.on(link, 'click', L.DomEvent.preventDefault)
					.on(link, 'click', this._settrack, this);
		},

		onRemove: function (/* map */) {
		},

		reset: function() {
			if (this._tracking === 2) {
				this._tracking = 1;
				this._link.style.backgroundColor = '';							
			}			
		},

		isTracking: function() {
			return this._tracking === 2;
		},

		_settrack: function(/* e */) {
			unhidecontrols();
			if (this._tracking === 2) {
				this._tracking = 0;
				this._link.style.backgroundColor = '';
				setfullview(this._map);
			} else {
				this._tracking = 2;
				this._link.style.backgroundColor = '#95b';
				settrackingview(this._map);
				setFlightPath();
			}
		}

	});

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
		if (layers.path) {	// layer already exists
			layers.pathHalo.setLatLngs(multi);
			layers.path.setLatLngs(multi);
		} else {	// create layer
			layers.pathHalo = L.multiPolyline(multi, { color: '#828483', opacity: 0.5, weight: 6 }).addTo(map).bringToFront();
			layers.path = L.multiPolyline(multi, { color: '#55f241', opacity: 0.8, weight: 4 }).addTo(map).bringToFront();
			// layers.pathHalo = L.multiPolyline(multi, { color: '#000', opacity: 0.5, weight: 4 }).addTo(map).bringToFront();
			// layers.path = L.multiPolyline(multi, { color: '#a2a', opacity: 0.8, weight: 2 }).addTo(map).bringToFront();
		}
	} // end setFlightPath

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
			//		var path = L.polyline(positions, { color: '#f22', opacity: 0.3, weight: 6 }).addTo(map);
			//		layercontrol.addOverlay(path, 'mobile API path');
			//	}	// end handleResponse
			// Call the mobile API
			// var url = 'http://www.flightstats.com/go/InternalAPI/singleFlightTracker.do?id='+flightID+'&airlineCode='+airline+'&flightNumber='+
			//		flightnum+'&version=1.0&key=49e3481552e7c4c9%253A-5b147615%253A12ee3ed13b5%253A-5f90&responseType=jsonp';
			//	var script = document.createElement('script');
			//	script.setAttribute('src', url);
			//	document.getElementsByTagName('head')[0].appendChild(script); // load the script
