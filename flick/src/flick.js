// FlightStats flight tracker
/*global L:false, jQuery:false */

(function($){
	"use strict";

	L.Map.include({	// fix for maxBounds bug in Leaflet
		panInsideBounds: function(bounds) {
			bounds = L.latLngBounds(bounds);

			var viewBounds = this.getBounds(),
					viewSw = this.project(viewBounds.getSouthWest()),
					viewNe = this.project(viewBounds.getNorthEast()),
					sw = this.project(bounds.getSouthWest()),
					ne = this.project(bounds.getNorthEast()),
					dx = 0,
					dy = 0;

			if (viewNe.y < ne.y) { // north
				dy = ne.y - viewNe.y + Math.max(0, this.latLngToContainerPoint([85.05112878, 0]).y);
			}
			if (viewNe.x > ne.x) { // east
				dx = ne.x - viewNe.x;
			}
			if (viewSw.y > sw.y) { // south
				dy = sw.y - viewSw.y + Math.min(0, this.latLngToContainerPoint([-85.05112878, 0]).y - this.getSize().y);
			}
			if (viewSw.x < sw.x) { // west
				dx = sw.x - viewSw.x;
			}

			return this.panBy(new L.Point(dx, dy, true));
		}
	});

	window.viewDidAppear = function() {
		window.location = the_url;	// restart app
	}

	window.viewWillDisappear = function() {
		clearInterval(maintimer);
		clearInterval(anitimer);
		clearTimeout(fullscreentimer);
	};

	$(window).unload(window.viewWillDisappear);

	// tuning parameters
	var updateRate = 30000;	// 30 seconds
	var aniRate = 250;	// 1/4 second
	var rotRate = aniRate / 500;	// 2 degrees per second max
	var guid = '34b64945a69b9cac:5ae30721:13ca699d305:75ee';

	var the_url = window.location;	// url that initiated the app
	var map;	// Leaflet map object
	var dport,	// departure airport data
			dpos,	// lat/lng position of departure airport
			dmarker,	// departing airport marker
			aport,	// arrival airport data
			apos,	// lat/lng position of arrival airport
			amarker,	// arriving airport marker
			airplane,	// L.marker for airplane icon
			fpos,	// lat/lng position of airplane
			multi,	// lat/lngs for flight path
			layers = {
				pathHalo: null, path: null,	// actual path
				planHalo: null, plan: null,	// flight plan (if available)
				arcHalo: null, arc: null,	// shortest arc (geodesic)
				mini: null },	// mini-tracker
			wrap;	// does route cross the anti-meridian?
	var maxZoom = 11;	// cannot zoom in any more than this
	var logo = true, logoimg, logourl;	// airline logo image and prefetch (for flight label)
	var flightData,	// flight data returned by API
			actualposs = [],	// actual positions (built up)
			apts,	// last actual pos timestamp
			pos,	// current position data returned by API
			timestamp,	// time of API call
			nodata = false;	// haven't received data from API recently
	var curpos,	// current lat/lng of animation
			currot, // current heading of animation
			curspeed, // current speed of airplane in mph
			curheading,	// current heading
			curstatus = null,	// current status
			estland = true,	// can estimate landing
			estdep = true,	// can estimate departure
			taxi = false,	// flight is active, but no positions yet
			frames = 0,	// frames of animation remaining
			rotframes,	// frames of rotation animation remaining
			loadtimer,	// first data load timer
			anitimer,	// animation timer
			maintimer;	// mainloop timer
	var vlat, vlng, vrot;	// animation parameters
	var zooming = false,	// true during zoom animation
			panning = false;	// true during panning animation
	var numpos, // debug stuff for simulating a data loss
			data_off = 0,	// index of where data is off for testing
			data_on = 0;	// index of where data is back on
	var trackcontrol, layercontrol, drawercontrol;	// UI
	var fullscreentimer, hidecontrols, unhidecontrols, drawerwasopen = false;	// hide buttons and drawer timer
	var controlshidden = false;

	// process URL parameters
	var flightID, // flightstats flight id
			airline,	// airline code
			flightnum,	// flight number
			hours24=false, // 12 or 24 hour time
			metric=false, // metric or US
			mapType = 'sat', // name of map (sat or map)
			showLabels = false,	// show label layer on sat map
			showTerrain = false,	// show terrain layer on map
			showPath = true,	// actual path
			showPlan = true,	// flight plan
			showArc = false,	// great arc
			showMini = true,	// mini-tracker
			showWeather = false,	// US weather
			demo = false,	// demo mode for signage
			view = '2D',	// 3D mode not really working
			zoomControl = 'auto',	// show zoom control (auto = if !touch)
			autoHide = 'auto',	// auto hide controls (auto = if touch)
			edgeurl = 'http://edge.flightstats.com/flight/tracker/',	// production
			miniurl = 'http://edge.flightstats.com/flight/mini-tracker/',	// production
			trackingDist = 0.4,	// % plane can get away from center of screen in tracking mode
			debug = false,	// debug to console
			fslogo = false;	// mobile web

	function getParams(p) {
    var params = {}; // parameters
    p.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { params[key] = value; });

    if (params.id) { flightID = params.id; }
    if (params.airline) { airline = params.airline; }
    if (params.flight) { flightnum = params.flight; }
    if (params.hours24) { hours24 = params.hours24 === 'true'; }
    if (params.metric) { metric = params.metric === 'true'; }
    if (params.mapType) { mapType = params.mapType === 'map' ? 'map' : 'sat'; }
    if (params.showLabels) { showLabels = params.showLabels === 'true'; }
    if (params.showTerrain) { showTerrain = params.showTerrain === 'true'; }
    if (params.showPath) { showPath = params.showPath === 'true'; }
    if (params.showPlan) { showPlan = params.showPlan === 'true'; }
    if (params.showArc) { showArc = params.showArc === 'true'; }
    if (params.showMini) { showMini = params.showMini === 'true'; }
    if (params.showWeather) { showWeather = params.showWeather === 'true'; }
    if (params.demo) { demo = params.demo === 'true'; }
    if (params.view) { view = params.view.toUpperCase(); }	// 3D or 3d
    if (params.trackingDist) { trackingDist = +params.trackingDist / 100; }
    if (params.debug) { debug = params.debug === 'true'; }
    if (params.autoHide) { autoHide = params.autoHide === 'true'; }
    if (params.zoomControl) { zoomControl = params.zoomControl === 'true'; }
    if (params.edgeurl) { edgeurl = decodeURIComponent(params.edgeurl); }
    if (params.miniurl) { miniurl = decodeURIComponent(params.miniurl); }
    if (params.fslogo) { fslogo = params.fslogo === 'true'; }
	}

	function setCookie(name, value) {
    document.cookie = name+'='+value+'; expires='+setCookie.date+'; path='+window.location.pathname;
  }
  setCookie.date = new Date();
  setCookie.date.setFullYear(setCookie.date.getFullYear() + 1); // 1 year
  setCookie.date = setCookie.date.toUTCString();

	getParams('?'+document.cookie); // params from cookies
	getParams(window.location.href); // read parameters from URL
	if (autoHide === 'auto') { autoHide = L.Browser.touch; }
	if (zoomControl === 'auto') { zoomControl = !L.Browser.touch; }

	if (flightID === undefined) { // setup tool -- remove for production
		window.location = 'flight.html?debug='+debug+'&autoHide='+autoHide+'&zoomControl='+zoomControl;
	} 

	if (debug) {	// interactive debug mode

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

		$(document).keydown(function(e) {
			if (e.which === 83) {	// "s" stop data
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
			}
			e.stopPropagation();
		});

	}

	// document ready! ------------------------------------
	$(document).ready(function() {

		if (fslogo) {	// mobile web, display logo at top
			$('#tracker_div').css('top', 56);
			$('#top_logo_container').css('display', 'block');
		}

		var defaultlayers = [basemaps[mapType]];	// default map layers
		if (showLabels && mapType === 'sat') {
			defaultlayers.push(overlays.labels);
		}
		if (showTerrain && mapType === 'map') {
			defaultlayers.push(overlays.terrain);
		}
		if (showWeather) {
			defaultlayers.push(overlays.weather);
		}

		trackcontrol = new TrackControl();
		layers = $.extend(layers, basemaps, overlays);
		layercontrol = new LayerControl(layers);

		drawercontrol = new DrawerControl(flightinfo);

		// --------------------------------------------------
    // create map
		map = L.map('map_div', {	// create map
			attributionControl: false,
			doubleClickZoom: false,
			zoomControl: false,
			zoomAnimation: true,
			markerZoomAnimation: true,
			layers: defaultlayers,
			maxBounds: [[-80,-380],[85, 200]],
			worldCopyJump: false	// !!! only one copy of markers and polylines, for now
		});
		map.addLayer(layercontrol).addLayer(trackcontrol).addLayer(drawercontrol).
			on('layeradd', function(e) { // reset zoom on basemap change
				var layer = e.layer;
				var m = layer._map;
				if (!layer.options || !layer.options.maxZoom) { return; }
				$.each(basemaps, function(k, v) {
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
				if (trackcontrol.isTracking()) { map.panTo(curpos); }
				zooming = false;
				if (debug) { console.log('zoom: ', this.getZoom()); }
				if (dmarker !== undefined) { 
					var icon = scaleTowers(this);
					dmarker.setIcon(icon);
					amarker.setIcon(icon);
				}
			}).on('movestart', function(/* e */) {
				panning = true;
			}).on('moveend', function(/* e */) {
				panning = false;
			});

		hidecontrols = function() {	// go fullscreen
			if (autoHide && !drawercontrol.expanded() && !layercontrol.expanded()) {
				controlshidden = true;
				$('#control').fadeOut(1000);
				$('.leaflet-control-container').fadeOut(1000);
				drawercontrol.hide();
			}
		};

		unhidecontrols = function() {	// show buttons and drawers
			if (autoHide) {
				clearTimeout(fullscreentimer);
				if (controlshidden) {
					$('#control').finish().fadeIn(100);	// my controls
					$('.leaflet-control-container').finish().fadeIn(100);	// leaflet controls
					drawercontrol.unhide();
			}
				fullscreentimer = setTimeout(hidecontrols, 5000);
			}
		};

		if (autoHide) {
			if (demo) {
				hidecontrols();
			} else {
				fullscreentimer = setTimeout(hidecontrols, 10000);
				map.on('click', unhidecontrols);				
			}
		}

		if (zoomControl) {
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

		// -------------------------------------------------
		// get position data from edge API
		function mainloop() {

			var ajaxoptions = { guid: guid, airline: airline, flight: flightnum, flightPlan: layers.plan===null };
			if (apts !== undefined) {
				ajaxoptions.limit = apts;
			}
			$.ajax({  // Call Flight Track by flight ID API
					url: edgeurl + flightID,
					data: ajaxoptions,
					dataType: 'jsonp',
					success: getFlight
				});

			if (wrap === undefined) {	// loading message...
				var $loading_div = $('#loading_div');
				$loading_div.text($loading_div.text().length > 0 ? 'Retrying...' : 'Loading...');
				loadtimer = setTimeout(function() {
					$('#loading_div').text('Accessing flight tracking data');
				}, Math.round(updateRate/3));
			}

			// Ajax success handler
			function getFlight(data /*, status, xhr */) { // callback
				if (debug) { console.log('data:', data, data.positions.length, actualposs.length); }

				if (data.status || data.tracks) {	// error!
					showNote('Cannot access flight position data: '+
							(data.status ? data.status.message : data.tracks.message));
					map.fitWorld();
					return;
				}

				flightData = data;
				dport = data.airports.departure;	// departure airport data
				aport = data.airports.arrival;	// arrival airport data

				var newp = data.positions;
				if (newp.length > 0) {
					if (debug && apts !== undefined) {
						console.log('time diff: ', Date.parse(newp[newp.length - 1].date) - Date.parse(apts));
					}
					actualposs = newp.concat(actualposs);
					apts = newp[0].date;
				}
				numpos = actualposs.length;

				if (data_off !== 0) {	// simulate data loss for testing
					if (data_on === 0) {	// data is dead
						actualposs.splice(0, numpos-data_off);					
					} else {	// data is back on
						actualposs.splice(-data_on, data_on-data_off);
					}
				}

				if (data.statusCode !== curstatus) {	// change of status
					curstatus = data.statusCode;
					if (numpos === 0 && curstatus === 'A') {	// taxi to runway
						showNote('Flight has departed the gate; tracking should begin after take off',
								new Date(data.responseTime*1000).toUTCString());
						taxi = true;
					} else {
						var m = flightStatusMessages[curstatus];
						if (m) { showNote(m); }
					}
				}

				var newheading = +(data.heading || data.bearing);

				if (numpos > 0 && curstatus !== 'L') {	// have positions

					var newpos = actualposs[0];
					var newdate = Date.parse(newpos.date);
					if (newdate < 1000) { alert('bad date!',newpos.date); }
					var diff = data.responseTime - newdate/1000 + (newpos.source === 'ASDI'? -300 : 0);

					// !!! Want to use timestamp from API instead of from position data, but it might not be reliable enough
					if (timestamp === undefined) { timestamp = newdate; }	// if uninitialized
					timestamp += updateRate;	// 30 seconds
					if (curstatus === 'A') {	// in flight
						if (taxi && numpos > 0) {
							showNote('The flight is now tracking');
							taxi = false;
						}
															// no data for two minutes OR last data point is more than 10 minutes old
						if (!nodata && (timestamp - newdate > 120000 || diff > 600)) {	
							showNote('The flight is temporarily beyond the range of our tracking network');
							nodata = true;
							// if (layers.path) { setFlightPath(true); }	// draw entire flight history
							// drawercontrol.update();
						}
						if (estland && nodata && data.responseTime > data.operationalTimes.arrivalTime + 120) {
							showNote('The flight is estimated to have landed, but is beyond the range of our tracking network');
							estland = false;	// suppress future Notes
						}
					}

					if (pos && newpos.lat === pos.lat && newpos.lon === pos.lon &&
							newpos.date === pos.date && pos.altitudeFt === newpos.altitudeFt) {
						return; // data has not changed
					}

					if (debug) {
						console.log('Edge API data: ', data, newpos.source, diff);
						if (curstatus !== 'A') { console.log('status: ', curstatus, flightData.statusCode, flightData.flightStatus, flightData.statusName); }
					}

					pos = newpos;
					timestamp = newdate;

					if (nodata && diff < 600) {
						nodata = false;
						estland = true;	// may calculate a landing again
						showNote('Re-established position data');
						if (wrap !== undefined) {	// jump to new position
							phat(createLatLng(+pos.lat, +pos.lon, wrap), newheading, +pos.altitudeFt, timestamp);
						}
					}

				} else {	// no positions
					var ap = curstatus === 'L' ? data.airports.arrival : data.airports.departure;
					timestamp = data.responseTime;
					pos = {
						lat: ap.latitude,
						lon: ap.longitude,
						date: timestamp,
						altitudeFt: ap.elevationFt,
						speedMph: 0
					};
					if (curstatus === 'S' && estdep && data.responseTime > data.operationalTimes.departureTime + 120) {
						showNote('The flight is past its expected take-off time, but is not reporting tracking data yet');
						estdep = false;	// suppress future Notes
					}
				} // end have positions or not

				if (wrap === undefined) { // first time called

					clearTimeout(loadtimer);
					$('#loading_div').hide();	// remove loading message

					if (airline === undefined) {	// not supplied by URL parameter
						airline = flightData.carrierFs;
					}
					if (flightnum === undefined) {
						flightnum = flightData.carrierFlightId;						
					}

					// load mini-tracker
					if (showMini) {
						createMiniTracker(data.miniTracker);
						$('#mini-tracker-div').show();
					} else {
						$('#mini-tracker-div').hide();
					}

					wrap = Math.abs(dport.longitude - aport.longitude) > 180; // does route cross anti-meridian?

					dpos = createLatLng(+dport.latitude, +dport.longitude, wrap);
					apos = createLatLng(+aport.latitude, +aport.longitude, wrap);
					fpos = createLatLng(+pos.lat, +pos.lon, wrap);
					// currot = +(data.heading || data.bearing);

					// airline logo prefetch
					logourl = 'http://d3o54sf0907rz4.cloudfront.net/airline-logos/v2/centered/logos/png/300x100/'+
							airline.toLowerCase().replace('*', '@')+'-logo.png';
					// '<object class="labelimg" data="http://dskx8vepkd3ev.cloudfront.net/airline-logos/v2/logos/svg/'+
					// flightData.carrierFs.toLowerCase().replace('*', '@')+'-logo.svg" type="image/svg+xml"></object>'+
					logoimg = $('<img/>'); // logo image
					logoimg.error(function(e) {	// if image exists, use it
						logo = false;
						e.stopImmediatePropagation();
					});
					logoimg.attr('src', logourl);	// prefetch image

					map.on('load', mapReady);
					setfullview(map);	// fires mapReady

					if (demo) {
						setTimeout(function() {
							trackcontrol.settrack(map);	// go into tracking mode in 15 seconds
						}, 15000);
					}

				} else {	// update
					fpos = createLatLng(+pos.lat, +pos.lon, wrap);
					if (!fpos.equals(curpos)) {
						aniPhats(fpos, newheading, +pos.altitudeFt, timestamp, +pos.speedMph);
						setFlightPath();
						drawercontrol.update();
						if (showMini) {
							var mft = $('#mini-tracker-div iframe')[0];	// mini-tracker frame
							(mft.contentWindow ? mft.contentWindow : mft.documentWindow).postMessage(data.miniTracker, '*');
						}
					}
				}

				function showNote(message) {
					$('#message').html(message+'<div class="ntime">'+
							(flightData && flightData.responseTime ? new Date(flightData.responseTime*1000) : new Date().toUTCString())+
							'</div>');
					$('#messagepopup').show().on('click', function() { $(this).hide(); });
				}

				// ------------------------------------------------
				// map is ready, draw everything for the first time
				function mapReady(/* e */) {

					if (view === '3D') {
						$('#map_div').addClass('threed');
					}

					var ticon = scaleTowers(this);	// generate and scale tower icon

					// departing airport marker
					dmarker = L.marker(dpos, {
							icon: ticon
						}).addTo(map).on('click', function() {
							drawercontrol.content(function() { return airportinfo(true); });
						});								

					// arriving airport marker
					amarker = L.marker(apos, {
							icon: ticon
						}).addTo(map).on('click', function() {
							drawercontrol.content(function() { return airportinfo(false); });
						});

					// create flight plan polylines
					var p = flightData.flightPlan;	// do flight plan (waypoints) if available
					if (p) { // there is a flight plan
						var positions = new Array(p.length);
						for (var i = 0; i < p.length; i++) {
							positions[i] = createLatLng(+p[i].lat, +p[i].lon, wrap);
						}
						layers.planHalo = L.polyline(positions, { color: '#D1D1D2', weight: 12, opacity: 0.4, clickable: false });
						layers.plan = L.polyline(positions, { color: '#362F2D', weight: 8 , opacity: 0.6, clickable: false });
						if (showPlan) {	// show plan
							layers.planHalo.addTo(map);
							layers.plan.addTo(map);							
						}
					} else {	// no plan
						layercontrol.noPlan();	// disable flight plan button
					}

					// create great arc (geodesic) polylines
					layers.arcHalo = L.polyline([dpos, apos], { color: '#828483', weight: 7, opacity: 0.4, clickable: false }).greatArc();
					layers.arc = L.polyline([dpos, apos], { color: '#D1D1D2', weight: 4, opacity: 0.6, clickable: false }).greatArc();
					if (showArc) {	// show arc
						layers.arcHalo.addTo(map);
						layers.arc.addTo(map);
					}

					// flight marker (airplane)
					var alt = +(pos.altitudeFt || 0);
					var heading = +(flightData.heading || flightData.bearing);
					// !!! now that I get current time from API, fix this to go back 1 minute in time to start animation
					// and display warning if no new data

					if (actualposs.length > 2 && curstatus !== 'L' && curstatus !== 'D') {
						p = actualposs[2];
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
						phat(fpos, heading, alt, pos.date);	// set initial position
					}
					
					setFlightPath(); // draw actual flight position data

				} // end mapReady

				// set position of airplane icon
				function phat(p, h, a, t) {	// position, heading, altitude, time
					if (curstatus === 'L') { p = apos; }	// land plane
					curpos = p;
					currot = h;
					if (airplane) {
						airplane.rotate(h).setShadow(a).stamp(t).setLatLng(p);	// can't chain setLatLng because of bug
						if (trackcontrol.isTracking()) { map.panTo(p); }
					} else {
						airplane = flightMarker(p).addTo(map).rotate(h).setShadow(a).stamp(t);
						airplane.on('click', function() {
							drawercontrol.content(flightinfo);
						});
					}
				}	// end phat

				// update position of airplane, using animation
				function aniPhats(p, h, a, t, s) {	// position, heading, altitude, time, speed
					if (!isNaN(a)) { airplane.setShadow(a); }
					if (typeof curpos !== 'object') {
						phat(p, h, a, t);
						return;
					}
					if (curpos && !curpos.equals(p)) {	// calculate heading from positions
						h = calcHeading(curpos, p);
					}
					curheading = h;

					var dt = t - airplane.stamp();	// time delta between updates in milliseconds
					airplane.stamp(t);
					// if (dt > 120000 || map.getZoom() < 5) {	// don't animate jumps or low zoom levels
					if (dt > 240000) {	// don't animate jumps greater than 4 minutes
						phat(p, h, a, t);
						// if (tracking) { map.panTo(p); }
						return;
					}

					if (debug && curspeed && Math.abs(s - curspeed) > 100) { console.log('speed jump', s, curspeed); }
					if (s) { curspeed = s; }	// valid speed

					var fminute = 60000 / aniRate;	// a minute of frames

					currot = (currot + 360) % 360;
					var turn = smallAngle(currot, h);

					// number of frames to move that distance at current speed (s)
					if (debug) { console.log('curspeed: '+curspeed, 'speedMph: '+pos.speedMph, 'turn: '+turn.toFixed(2)); }
					frames = $.isNumeric(curspeed) ? Math.floor(curpos.distanceTo(p) * 2236.936292 / (curspeed * aniRate)) : 0;						
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
						if (curstatus === 'L') {	// land plane
							curpos = apos;
							frames = 0;
						} else {
							curpos = createLatLng(curpos.lat + vlat, curpos.lng + vlng, wrap);							
						}
						currot += vrot;
						if (!zooming && !panning) {	// don't update position while zooming or panning animation is in progress
							airplane.rotate(currot).setLatLng(curpos);	// can't chain setLatLng because of bug
							if (trackcontrol.isTracking()) {	// time to scroll?
								if (trackingDist === 0) { map.panTo(curpos); }	// continuous tracking
								else {	// jump tracking
									var mapcenter = map.getSize().multiplyBy(0.5);
									var curpixel = map.latLngToContainerPoint(curpos);
									// if (debug) { console.log(mapcenter.toString(), curpixel.toString()); }
									if (curpixel.x < mapcenter.x * (1-trackingDist) || curpixel.x > mapcenter.x * (1+trackingDist) ||
											curpixel.y < mapcenter.y * (1-trackingDist) || curpixel.y > mapcenter.y * (1+trackingDist)) {
										map.panBy([1.9 * (curpixel.x - mapcenter.x), 1.9 * (curpixel.y - mapcenter.y)]);
									}
								}
							}
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

		} // end mainloop

		mainloop();
		maintimer = setInterval(mainloop, updateRate); // update every 30 seconds

	});	// end document ready

	function createLatLng(lat, lon, wrap) {
		return L.latLng(lat, wrap && lon>0 ? lon-360 : lon, true);
	}

	// !!! will this work when the two points are on opposite sides of the antimeridian?
	// I think so, since if wrap then points west of antimeridian are < -180
	// function halfway(p1, p2) {	// return lat/lng halfway between two points
	//	return L.latLng(p1.lat + (p2.lat - p1.lat) * 0.5, p1.lng + (p2.lng - p1.lng) * 0.5, true);
	// }

	// -----------------------------------------------
	// airplane flight marker
	var FlightMarker = L.Marker.extend({
		defaultFlightMarkerOptions: {
			icon: L.divIcon({ // airplane icon (rotatable)
					html: '<img class="airplaneshadow" src="img/shadow-4@2x.png" /><img class="airplaneicon" src="img/plane@2x.png" />',
					iconSize: [48, 48],	// airplane-purple.png [62, 62],
					iconAnchor: [24, 24],	// [31, 31],
					className: ''
			}),
			zIndexOffset: 1000
		},
		initialize: function(latlng) {
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
			var offset = isNaN(alt) ? 0 : Math.round(alt * 0.00035); // shadow offset based on altitude
			var shimg = 'img/shadow-'+ (Math.max(0, Math.min(9, Math.floor(alt / 3000))))+'@2x.png'; // shadow image 0-9 (progressive blur)
			if ($shadow.attr('src') !== shimg) { $shadow.attr('src', shimg); }
			$shadow.css({opacity: 0.7, left: offset-19, top: offset-14});
			return this;
		}
	});

	var flightMarker = function(latlng) { // factory
		return new FlightMarker(latlng);
	};

	// -----------------------------------------------
	// add great circle arc to Polyline
	L.Polyline.include({	// draw a polyline using geodesics
		greatArc: function(npoints) {
			var points = [];
			var start = this._latlngs[0],
					end = this._latlngs[1];
			var startlng = (start.lng + 180) % 360 + ((start.lng < -180 || start.lng === 180) ? 180 : -180);
			var endlng = (end.lng + 180) % 360 + ((end.lng < -180 || end.lng === 180) ? 180 : -180);
			if (npoints === undefined) { npoints = 1 + Math.ceil(Math.abs(startlng - endlng)); }
			if (npoints <= 2) {
				points.push([start.lat, startlng]);
				points.push([end.lat, endlng]);
			} else {
				var D2R = L.LatLng.DEG_TO_RAD;
				var R2D = L.LatLng.RAD_TO_DEG;
				var startx = D2R * startlng,
						starty = D2R * start.lat,
						endx = D2R * endlng,
						endy = D2R * end.lat;
				var g = 2.0 * Math.asin(Math.sqrt(Math.pow(Math.sin((starty - endy) * 0.5), 2) +
                Math.cos(starty) * Math.cos(endy) * Math.pow(Math.sin((startx - endx) * 0.5), 2)));
				var isg = 1 / Math.sin(g);
				var delta = 1.0 / (npoints - 1);
				var wrap = Math.abs(startlng - endlng) > 180; // does route cross anti-meridian?
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
        }
			}
			this._latlngs = points;
			return this;
		}
	});

	// Drawer info content ---------------------------------------------
	function flightinfo() {	// info about flight for drawer
		var airlinename = flightData.carrierName;
		var s = (flightData.statusCode === 'A' && isNaN(pos.speedMph)) ? 'N/A' :
				(metric ? (pos.speedMph * 1.60934).toFixed()+' kph' : pos.speedMph+' mph');
		var heading = (+(flightData.heading || flightData.bearing)).toFixed();
		return (logo ? '<img class="labelimg" src="'+logourl+'" /><br />' :
				'<div class="labelhead fakelogo">'+airlinename+'&nbsp;</div>')+
				'<div id="drawer-status">('+airline+') '+airlinename+' '+flightData.carrierFlightId+
				'<br /><span'+(flightData.statusColor ? ' style="color:'+flightData.statusColor+'">' : '>')+
				flightData.statusName+(flightData.statusAppend ? ', '+flightData.statusAppend : '')+'</span>'+
				'</div><table id="drawerinfo"><tr><td class="tn">Route</td><td>'+dport.fsCode+' to '+aport.fsCode+
				'</td></tr><tr><td class="tn">Altitude</td><td>'+(isNaN(pos.altitudeFt) ? 'N/A' :
						(metric ? (pos.altitudeFt * 0.3048).toFixed()+' meters' : pos.altitudeFt+' feet'))+
				'</td></tr><tr><td class="tn">Speed</td><td>'+s+'</td></tr>'+
				'<tr><td class="tn">Heading</td><td>'+(isNaN(heading) ? 'N/A' : heading)+' degrees</td></tr>'+
				(flightData.operatedByFsCode ?
					'<tr><td class="tn">Operated&nbsp;by</td><td>'+flightData.operatedByFsCode+' '+
					(flightData.operatedByFlightNum ? flightData.operatedByFlightNum : flightData.carrierFlightId)+'</td></tr>' : '')+
				'<tr><td class="tn">Equipment</td><td>'+
						(flightData.flightEquipmentName ? (flightData.flightEquipmentName !== '??' ?
							formatEquip(flightData.flightEquipmentName) : flightData.flightEquipmentIata) : 'unknown')+
				'</td></tr></table>';
	}

	function airportinfo(wt) {	// true for departing, false for arriving
		var w = wt ? dport : aport;
		return '<div class="labelhead">'+(wt ? 'DEPARTING' : 'ARRIVING')+' - '+w.fsCode+
			'</div><div style="text-align:center;width:100%">'+
			formatAirport(w.name)+'<br />'+w.city+(w.stateCode ? ', '+w.stateCode : '')+', '+
			(w.countryCode === 'US' ? 'USA' : w.countryName)+'</div><br /><table id="drawerinfo" style="line-height:14px"><tr><td rowspan="5">'+
				(w.conditionIcon ? '<img src="http://d1bopfe20gjmus.cloudfront.net/global-static-assets/0.0.1/images/weather-100x100/'+w.conditionIcon+
					'" style="width:100px;height100px;padding-right:5px" />' : '<div style="width:40px"></div>')+
			'</td><td class="dark">LOCAL&nbsp;WEATHER</td></tr><tr><td style="font-size:1.15em">'+
			formatWeather(w.conditions)+'</td></tr><tr><td style="font-size:26px;height:30px">'+formatTemperature(w.temperatureCelsius)+
			'</td></tr><tr><td class="dark">LOCAL&nbsp;TIME</td></tr><tr><td>'+formatTime(w.localTime)+'</td></tr></table>';
	}

	// ---------------------------------------------------------
	// DrawerControl displays information about items on the map
	var DrawerControl = L.Class.extend({

		initialize: function(dfun) {
			this._fun = dfun;
			this._contents = '';
		},

		onAdd: function(map) {
			this._map = map;
			this._expanded = false;	// is drawer open?
			this._visible = true;	// is drawer and pull showing or hidden

			var drawer = L.DomUtil.get('drawer');

			L.DomEvent.on(drawer, 'mousedown', this._toggle, this).
						on(drawer, 'mousedown', L.DomEvent.stop).
						on(drawer, 'click', L.DomEvent.stop);
			if (L.Browser.touch) {
				L.DomEvent.on(drawer, 'touchstart', this._toggle, this).on(drawer, 'touchstart', L.DomEvent.stop);
			}
		},

		onRemove: function(/* map */) {

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
				this._contents = this._fun();
				$('#drawer-content').html(this._contents);
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
			$('#drawer').animate({bottom: -216}, 500);
		},

		unhide: function() {
			if (!this._expanded) {
				$('#drawer').finish();
				$('#drawer').animate({bottom: -200}, 200);
			}
		},

		content: function(fun) {
			this._fun = fun;
			this._contents = fun();
			$('#drawer-content').html(this._contents);
			if (!this._expanded) { this.expand(); }
		},

		update: function() {
			if (!this._expanded) { return; }
			var info = this._fun();
			if (info !== this._contents) {
				$('#drawer-content').html(info);
				this._contents = info;
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

			var toggle = this._toggle = L.DomUtil.get('control-layer-toggle');
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

			if (mapType === 'sat') {
				// $('#layer-sat').attr('checked', 'checked');
				document.getElementById('layer-sat').checked = true;
				$('#layer-overlay-name').text('LABELS');
				if (showLabels) {
					// $('#layer-overlay').prop('checked', 'checked');
					document.getElementById('layer-overlay').checked = true;
				}
			} else { // street map
				// $('#layer-map').attr('checked', 'checked');
				document.getElementById('layer-map').checked = true;
				$('#layer-overlay-name').text('TERRAIN');				
				if (showTerrain) {
					// $('#layer-overlay').prop('checked', 'checked');
					document.getElementById('layer-overlay').checked = true;
				}
			}

			if (showPath) {
				// $('#layer-path').prop('checked', 'checked');
				document.getElementById('layer-path').checked = true;
			}
			if (showPlan) {
				// $('#layer-plan').prop('checked', 'checked');
				document.getElementById('layer-plan').checked = true;
			}
			if (showArc) {
				// $('#layer-arc').prop('checked', 'checked');
				document.getElementById('layer-arc').checked = true;
			}
			if (showMini) {
				// $('#layer-mini').prop('checked', 'checked');
				document.getElementById('layer-mini').checked = true;
			}
			if (showWeather) {
				// $('#layer-weather').prop('checked', 'checked');
				document.getElementById('layer-weather').checked = true;
			}

			// click on satellite basemap
			L.DomEvent.on(L.DomUtil.get('layer-sat'), 'click', function() {
				if (mapType === 'map') {
					this._map.removeLayer(this._layers.map);
					// $('#layer-overlay').removeProp('checked');
					document.getElementById('layer-overlay').checked = false;
					if (showTerrain) {
						this._map.removeLayer(this._layers.terrain);
					}
					this._map.addLayer(this._layers.sat, true);
					$('#layer-overlay-name').text('LABELS');
					if (showLabels) {
						// $('#layer-overlay').prop('checked', 'checked');
						document.getElementById('layer-overlay').checked = true;
						this._map.addLayer(this._layers.labels);
					}
					mapType = 'sat';
					this._notify('mapType','sat');
				}
			}, this);

			// click on map basemap (street)
			L.DomEvent.on(L.DomUtil.get('layer-map'), 'click', function() {
				if (mapType === 'sat') {
					this._map.removeLayer(this._layers.sat);
					// $('#layer-overlay').removeProp('checked');
					document.getElementById('layer-overlay').checked = false;
					if (showLabels) { this._map.removeLayer(this._layers.labels); }
					this._map.addLayer(this._layers.map, true);
					$('#layer-overlay-name').text('TERRAIN');
					if (showTerrain) {
						// $('#layer-overlay').prop('checked', 'checked');
						document.getElementById('layer-overlay').checked = true;
						this._map.addLayer(this._layers.terrain);
					}
					mapType = 'map';
					this._notify('mapType','map');
				}
			}, this);

			// click on overlay (labels or terrain)
			L.DomEvent.on(L.DomUtil.get('layer-overlay'), 'click', function() {
				var overlay = document.getElementById('layer-overlay').checked; // $('#layer-overlay:checked');
				if ($('#layer-overlay-name').text() === 'LABELS') {
					if (overlay) {
						this._map.addLayer(this._layers.labels);
						showLabels = true;
						this._notify('showLabels','true');
					} else {
						this._map.removeLayer(this._layers.labels);
						showLabels = false;
						this._notify('showLabels','false');
					}
				} else {
					if (overlay) {
						this._map.addLayer(this._layers.terrain);
						showTerrain = true;
						this._notify('showTerrain','true');
					} else {
						this._map.removeLayer(this._layers.terrain);
						showTerrain = false;
						this._notify('showTerrain','false');
					}					
				}
			}, this);

			// click on actual path
			L.DomEvent.on(L.DomUtil.get('layer-path'), 'click', function() {
				showPath = document.getElementById('layer-path').checked; // $('#layer-path:checked').length > 0;
				this._notify('showPath', showPath.toString());
				if (this._layers.path === null) { return; }
				if (showPath) {
					this._map.addLayer(this._layers.pathHalo).addLayer(this._layers.path);
					this._layers.pathHalo.bringToFront();
					this._layers.path.bringToFront();						
				} else {
					this._map.removeLayer(this._layers.pathHalo);
					this._map.removeLayer(this._layers.path);
				}
			}, this);

			// click on flight plan
			L.DomEvent.on(L.DomUtil.get('layer-plan'), 'click', function() {
				showPlan = document.getElementById('layer-plan').checked; // $('#layer-plan:checked').length > 0;
				this._notify('showPlan', showPlan.toString());
				if (this._layers.plan === null) { return; }
				if (showPlan) {
					this._map.addLayer(this._layers.planHalo).addLayer(this._layers.plan);
					this._layers.plan.bringToBack();
					this._layers.planHalo.bringToBack();						
				} else {
					this._map.removeLayer(this._layers.planHalo);
					this._map.removeLayer(this._layers.plan);
				}
			}, this);

			// click on great arc (geodesic)
			L.DomEvent.on(L.DomUtil.get('layer-arc'), 'click', function() {
				if (document.getElementById('layer-arc').checked) {
					this._map.addLayer(this._layers.arcHalo).addLayer(this._layers.arc);
					this._layers.arc.bringToBack();
					this._layers.arcHalo.bringToBack();
					showArc = true;
					this._notify('showArc','true');
				} else {
					this._map.removeLayer(this._layers.arcHalo);
					this._map.removeLayer(this._layers.arc);
					showArc = false;
					this._notify('showArc','false');
				}
			}, this);

			// click on mini-tracker
			L.DomEvent.on(L.DomUtil.get('layer-mini'), 'click', function() {
				if (document.getElementById('layer-mini').checked) {
					createMiniTracker(flightData.miniTracker);
					$('#mini-tracker-div').show();
					showMini = true;
					this._notify('showMini','true');
				} else {
					$('#mini-tracker-div').hide();
					destroyMiniTracker();
					showMini = false;
					this._notify('showMini','false');
				}
			}, this);

			// click on weather
			L.DomEvent.on(L.DomUtil.get('layer-weather'), 'click', function() {
				if (document.getElementById('layer-weather').checked) {
					this._map.addLayer(this._layers.weather);
					showWeather = true;
					this._notify('showWeather','true');
				} else {
					this._map.removeLayer(this._layers.weather);
					showWeather = false;
					this._notify('showWeather','false');
				}
			}, this);

		},

		onRemove: function(/* map */) {

		},

		expanded: function() {
			return this._expanded;
		},

		expand: function() {
			var $md = $('#map_div');
			if (drawercontrol.expanded() && $md.height() < 650 && $md.width() < 750) {
				drawerwasopen = true;
				drawercontrol.collapse();
			}
			unhidecontrols();
			if (this._expanded) {
				this.collapse();
				fullscreentimer = setTimeout(hidecontrols, 5000);
			} else {
				$('#control-layer-list').show(100,'linear');
				this._toggle.style.backgroundImage = 'url(img/layers-white@2x.png)';
				this._expanded = true;
			}
		},

		collapse: function() {
			unhidecontrols();
			if (this._expanded) {
				$('#control-layer-list').hide(100,'linear');
				this._toggle.style.backgroundImage = 'url(img/layers@2x.png)';				
			}
			this._expanded = false;
			if (drawerwasopen) {
				drawercontrol.expand();
			}
		},

		noPlan: function() {	// no flight plan available
			// $('input#layer-plan').removeProp('checked').attr('disabled', 'disabled');
			document.getElementById('layer-plan').disabled = true;
			$('#layer-plan-name').css({color: '#aaa'});
			if (showPlan && !showArc) {
				// $('input#layer-arc').prop('checked','checked');
				document.getElementById('layer-arc').checked = true;
				showArc = true;
			}
		},

		isMini: function() {
			return this._mini;
		},

		_notify: function(k, v) {
			// if (debug) { console.log('notify', k, v); }
			setCookie(k, v);
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
					.on(link, 'click', this.settrack, this);
		},

		onRemove: function (/* map */) {
		},

		reset: function() {
			if (this._tracking === 2) {
				this._tracking = 1;
				this._link.style.backgroundColor = '';
				this._link.style.backgroundImage = 'url(img/tracking-icon@2x.png)';
			}			
		},

		isTracking: function() {
			return this._tracking === 2;
		},

		settrack: function(/* e */) {
			if (!demo) { unhidecontrols(); }
			if (this._tracking === 2) {
				this._tracking = 0;
				this._link.style.backgroundColor = '';
				this._link.style.backgroundImage = 'url(img/tracking-icon@2x.png)';
				setfullview(this._map);
			} else {
				this._tracking = 2;
				this._link.style.backgroundColor = 'rgba(48, 106, 219, 0.75)'; // '#306ADB';	// blue
				this._link.style.backgroundImage = 'url(img/tracking-icon-white@2x.png)';
				settrackingview(this._map);
				setFlightPath();
			}
		}

	});

	function setfullview(m) { // set map view including both airports and current position of flight
		var flightBounds;	// area of world to display

		// Workaround for EWR to SIN flight
		// if (Math.abs(180 - Math.abs(dpos.lng - apos.lng)) < 2) {
		//	m.fitWorld();
		//	return;
		// }

		// Workaround for Leaflet issue #1481
		var tempa = createLatLng(apos.lat, apos.lng, false);
		var tempd = createLatLng(dpos.lat, dpos.lng, false);
		var tempf = createLatLng(fpos.lat, fpos.lng, false);

		flightBounds = L.latLngBounds([ dpos, apos, fpos ]).pad(0.05);
		m.fitBounds(flightBounds);

		// Workaround for Leaflet issue #1481
		apos = tempa; amarker.setLatLng(apos);
		dpos = tempd; dmarker.setLatLng(dpos);
		fpos = tempf; airplane.setLatLng(fpos);
	}

	function settrackingview(m) {
		if (fpos) {
			m.setView(
					// curpos ? halfway(curpos, fpos) : fpos,
					curpos ? curpos : fpos,
					Math.max(Math.min(maxZoom, 9), m.getZoom())	// don't zoom out
			);
		}
	}

	function setFlightPath(all) { // draw flight positions
		var p = actualposs;
		if (p.length < 2) { return; }
		var positions = [];
		var last = null, ct, tail;
		var i = 1;
		if (all || !curpos || curspeed < 120 || flightData.statusCode === 'L' || flightData.statusCode === 'D') {	// draw all positions
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
			layers.pathHalo = L.multiPolyline(multi, { color: '#828483', weight: 6, opacity: 0.5, clickable: false });
			layers.path = L.multiPolyline(multi, { color: '#55f241', weight: 4, opacity: 0.8, clickable: false });
		}
		if (showPath) {
			layers.pathHalo.addTo(map).bringToFront();
			layers.path.addTo(map).bringToFront();
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

	// Mini-tracker ----------------------
	function createMiniTracker(d) {	// d is a set of key/value parameters for the tracker
		$('#mini-tracker-div div.loading').show();
		var mini = [ miniurl, '?skin=0&guid=', guid, '&metric=', metric, '&isoClock=', hours24 ];
		$.each(d, function(k, v) {
			mini.push('&'+k+'='+v);
		});
		$('<iframe />', { src: mini.join('') }).appendTo('#mini-tracker-div').on('load', function() {
			$('#mini-tracker-div div.loading').hide();
		});
	}

	function destroyMiniTracker() {
		$('#mini-tracker-div iframe').remove();
	}

	// string formatting routines --------------------------
	var months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];

	function formatTime(ts) {
		// var tv = new Date(ts);
		var hour = +ts.slice(11,13);
		var tw = hour >= 12 ? 'pm' : 'am';
		if (hour > 12) { hour -= 12; }
		if (hour === 0) { hour = 12; }
		return (hours24 ?  ts.slice(11,16) : hour+':'+ts.slice(14,16)+tw) +' '+ts.slice(8,10)+'-'+months[ts.slice(5,7)-1]+'-'+ts.slice(0,4);
	}

	function formatAirport(as) {
		as = as.replace(/\sInternational/, ' Intl.');
		return as.length < 30 ? as : as.replace(/\s*Airport\s*$/, '');
	}

	function formatWeather(ws) {
		return ws === undefined ? 'Unknown' : ws.toUpperCase();
	}

	function formatTemperature(ts) {
		return ts === undefined || ts === 'Unknown' || isNaN(ts) ? '&nbsp;' :
				(metric ? ts.toFixed(1)+'&deg; C' : (32 + (1.8 * ts)).toFixed()+'&deg; F');
	}

	function formatEquip(es) {
		es = es.replace('De Havilland (Bombardier) DHC-8-400 Dash 8/8Q', 'Bombardier Dash 8-Q400');
		return es.replace(/\s*(Passenger|Industrie|\([^\)]*\))/g, '');
	}

	var flightStatusMessages = {
		// A: Active
		C: 'The flight has been canceled',
		D: 'The flight has been diverted to another airport',
		DN: 'Tracking data is not available for this flight', // No Data Source
		I: 'The flight is not being tracked', // Incident
		L: 'The flight has landed',
		NO: 'Flight not operating',
		// R: 'The flight has possibly been redirected',
		S: 'Tracking will begin after departure', // Scheduled
		U: 'Tracking is not enabled for this flight' // Unknown
	};

	// control tower icon options
	var towerproto = {
			iconUrl: 'img/tower-large.png',
			iconRetinaUrl: 'img/tower-large@2x.png',
			iconSize: [78, 151],	// full size
			iconAnchor: [16, 94]
		};

	var towerscale = [ 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1 ];

	function scaleTowers(m) {	// scale tower icon based on zoom of map m
		var opts = $.extend({}, towerproto);	// copy
		var scale = towerscale[Math.min(m.getZoom(), towerscale.length-1)];
		opts.iconSize = [opts.iconSize[0] * scale, opts.iconSize[1] * scale];
		opts.iconAnchor = [opts.iconAnchor[0] * scale, opts.iconAnchor[1] * scale];
		return L.icon(opts);
	}

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

	// Map tile sets -----------------------------------------------------------
	var basemaps = { // map tiles
		sat: L.tileLayer(
			'http://maps{s}.flightstats.com/aerial/{z}/{x}/{y}.png',
			{ subdomains: '1234',
				zIndex: 2,
				minZoom: 0, maxZoom: 11
		}),
		map: L.tileLayer(
			// 'http://maps{s}.flightstats.com/streets/{z}/{x}/{y}.png',
			'http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.jpg',
			{ subdomains: '1234',
				zIndex: 2,
				minZoom: 0, maxZoom: 11
		})
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
			// 'http://maps{s}.flightstats.com/labels/{z}/{x}/{y}.png',
			'http://otile{s}.mqcdn.com/tiles/1.0.0/hyb/{z}/{x}/{y}.png',
			{ subdomains: '1234',
			zIndex: 5,
				minZoom: 0, maxZoom: 11
		}),
		terrain: L.tileLayer(
			// 'http://129.206.74.245:8004/tms_hs.ashx?x={x}&y={y}&z={z}',
			'http://maps{s}.flightstats.com/terrain/{z}/{x}/{y}.png',
			{ subdomains: '1234',
				opacity: 0.7,
				zIndex: 3,
				minZoom: 0, maxZoom: 11
		})
	};

}(jQuery));
