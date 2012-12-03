// FlightStats flight tracker

(function($){

	// process URL parameters
	var flightID, // flightstats flight id
			airline,
			flightnum,
			timeFormat=12, // 12 or 24
			units='metric', // metric or US
			mapType = 'street', // name of map
			showWeather = false; // true or false

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

	getParams(window.location.href);

	if (flightID === undefined) { window.location = "flight.html"; }

	var appId = 'defc5e51',
			appKey = '49c2d9cae10585f227dec686b3d22cb7';

	var tiles = {
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
      return (de && xy.x >= de.x.min & xy.x <= de.x.max && xy.y >= de.y.min && xy.y <= de.y.max) ?
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

	// layers and controls
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

		var airports, airlines, departureAirport, dpos, arrivalAirport, apos, flightBounds, airplane, fpos, plan, path, positions, wrap;
		var tracking = false;

		var map = L.map('map_div', {
			attributionControl: false,
			zoomControl: false,
			layers: defaultlayers,
			worldCopyJump: false,
			inertia: false
		}).addControl(layercontrol).addControl(attributioncontrol).addControl(zoomcontrol);

		var airportDepIcon = L.icon({
				iconUrl: 'img/tower-blue.png',
				iconSize: [78, 145],
				iconAnchor: [17, 97],
				popupAnchor: [2, -93],
				labelAnchor: [7, -60]
		});
		var airportArrIcon = L.icon({
				iconUrl: 'img/tower-orange.png',
				iconSize: [78, 145],
				iconAnchor: [17, 97],
				popupAnchor: [2, -93],
				labelAnchor: [7, -60]
		});
		var flightIcon = L.divIcon({ // airplane icon (orange)
				html: '<img class="airplaneicon" src="img/airplane-purple.png" />',
				iconSize: [50, 50],
				iconAnchor: [25, 25],
				labelAnchor: [10, -5],
				className: ''
		});
		var pathlabel = airline+flightnum+' flight path';

		function mainloop() {
			// window.handleResponse = function(data) { // results from Chris' API
			// 	if (console && console.log) console.log('mobile API: ',data);
			// 	p = data.PositionalUpdate;
			// 	if (console && console.log) console.log('mobile API length: '+p.length,
			// 				'actual start: ('+(+p[0].latitude).toFixed(4)+','+(+p[0].longitude).toFixed(4)+')');
			// 	positions = new Array(p.length);
			// 	for (i = 0; i < p.length; i++) {
			// 			lon = p[i].longitude;
			// 			positions[i] = L.latLng(p[i].latitude, lon>90 ? lon-360:lon, true);
			// 		}
			// 		var path = L.polyline(positions, { color: '#f22', opacity: 0.3, weight: 6 }).bindLabel(pathlabel).addTo(map);
			// 		layercontrol.addOverlay(path, 'mobile API path');
			// } // end handleResponse
			// Call the mobile API
			// var url = 'http://www.flightstats.com/go/InternalAPI/singleFlightTracker.do?id='+flightID+'&airlineCode='+airline+'&flightNumber='+
			// 		flightnum+'&version=1.0&key=49e3481552e7c4c9%253A-5b147615%253A12ee3ed13b5%253A-5f90&responseType=jsonp';
			// var script = document.createElement('script');
			// script.setAttribute('src', url);
			// document.getElementsByTagName('head')[0].appendChild(script); // load the script

			$.ajax({  // Flight track by flight ID
	        url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/track/' + flightID,
	        data: { appId: appId, appKey: appKey, includeFlightPlan: true },
	        dataType: 'jsonp',
	        success: getFlight
	      });

			function getAppendix(data) { // read in data from appendix and convert to dictionary
	      ret = {};
	      if (data) {
	        for (var i = 0; i<data.length; i++) {
	          var v = data[i];
	          ret[v.fs] = v;
	        }
	      }
	      return ret;
	    }

	    function setfullview() {
				if (wrap) { // set map view including both airports and current position of flight
					flightBounds = L.latLngBounds([
							[dpos.lat, dpos.lng+180],
							[apos.lat, apos.lng+180],
							[fpos.lat, fpos.lng+180]
						]).pad(0.05);
					var c = flightBounds.getCenter();
					map.setView(L.latLng(c.lat, c.lng - 180, true), map.getBoundsZoom(flightBounds));
				} else {
					flightBounds = L.latLngBounds([ dpos, apos, fpos ]).pad(0.05);
					map.fitBounds(flightBounds);
				}
	    }

	    function settrackingview() {
	    	if (fpos) { map.setView(fpos, 11); }
	    }

			function getFlight(data, status, xhr) {
				var lat, lon;
				if (!data || data.error) {
					alert('AJAX error: '+data.error.errorMessage);
					return;
				}

				if (console && console.log) console.log('Flex API data: ',data);

				var flight = data.flightTrack;
				var pos = flight.positions[0];

				if (airports === undefined) { // first time called
					airports = getAppendix(data.appendix.airports);
					airlines = getAppendix(data.appendix.airlines);
					departureAirport = flight.departureAirportFsCode;
					var depa = airports[departureAirport];
					arrivalAirport = flight.arrivalAirportFsCode;
					var arra = airports[arrivalAirport];

					wrap = Math.abs(depa.longitude - arra.longitude) > 180; // does route cross anti-meridian

					lon = +depa.longitude;
					dpos = L.latLng(+depa.latitude, wrap && lon>0 ? lon-360 : lon, true);
					lon = +arra.longitude;
					apos = L.latLng(+arra.latitude, wrap && lon>0 ? lon-360 : lon, true);
					lon = +pos.lon;
					fpos = L.latLng(+pos.lat, wrap && lon>0 ? lon-360 : lon, true);

					map.on('load', mapReady);
					setfullview();

				} else {
					lon = +pos.lon;
					fpos = L.latLng(+pos.lat, wrap && lon>0 ? lon-360 : lon, true);
					airplane.setLatLng(fpos);
					airplane.rotate(+flight.heading);
					if (tracking) { map.panTo(fpos); }
					setPositions();					
				}

				function mapReady(e) {
					// add additional zoom control buttons
					$zoomdiv = $('.leaflet-control-zoom');
					$(zoomcontrol._createButton('Track', 'leaflet-control-zoom-track', $zoomdiv[0], trackfun, map)).css({
						'background-image': 'url(img/icon-eye.png)', margin: '5px 0' });
					$(zoomcontrol._createButton('Whole Flight', 'leaflet-control-zoom-flight', $zoomdiv[0], fullfun, map)).css({
						'background-image': 'url(img/icon-full.png)' });
					map.on('dragstart', function(e) {
						tracking = false;
					});

					var label = '<span class="labelhead">From '+departureAirport+'</span><br />'+depa.name+
								'<br />'+depa.city+(depa.stateCode ? ', '+depa.stateCode : '')+', '+depa.countryCode; // +
								// '<br />Local time: '+(new Date(depa.localTime).toLocaleTimeString());
					L.marker(dpos, { icon: airportDepIcon }).addTo(map).bindLabel(label); // departing airport icon

					label = '<span class="labelhead">To '+arrivalAirport+'</span><br />'+arra.name+
								'<br />'+arra.city+(arra.stateCode ? ', '+arra.stateCode : '')+', '+arra.countryCode; // +
								// '<br />Local time: '+(new Date(arra.localTime).toLocaleTimeString());	
					L.marker(apos, { icon: airportArrIcon }).addTo(map).bindLabel(label); // arriving airport icon

					label = '<span class="labelhead">'+airlines[flight.carrierFsCode].name+'</span>'+
								'<br />Flight #: '+flight.flightNumber+
								'<br />Route: '+departureAirport+' to '+arrivalAirport+
								'<br />Lat/Long: '+fpos.lat.toFixed(2)+'/'+fpos.lng.toFixed(2)+
								'<br />Altitude: '+pos.altitudeFt+' ft'+
								'<br />Speed: '+pos.speedMph+' mph'+
								'<br />Bearing: '+(+flight.bearing).toFixed()+' deg'+
								'<br />Heading: '+(+flight.heading).toFixed()+' deg'+
								'<br />Equipment: '+flight.equipment;
					airplane = L.marker(fpos, { icon: flightIcon, zIndexOffset: 1000 }).	// airplane icon
							addTo(map).rotate(+flight.heading).bindLabel(label);
					
					// do waypoints (flight plan)
					var p = flight.waypoints;
					if (p) { // there is a flight plan
						positions = new Array(p.length);
						for (var i = 0; i < p.length; i++) {
							lat = +p[i].lat; lon = +p[i].lon;
							// positions[i] = L.latLng(lat, wrap && lon<0 ? lon : lon-360, true);
							positions[i] = L.latLng(lat, wrap && lon>0 ? lon-360 : lon, true);
						}
						plan = L.polyline(positions, { color: '#939', weight: 5, dashArray: '18, 12'}).bindLabel(airline+flightnum+' flight plan').addTo(map);
						layercontrol.addOverlay(plan, 'flight plan');
					} else { // if there is NO flight plan
						var npoints = Math.max(128 - 16 * map.getZoom(), 4);
						plan = L.polyline([dpos, apos], { color: '#939', weight: 6, dashArray: '1, 12'}).
								greatCircle(npoints).addTo(map).bindLabel(airline+flightnum+' route');
						layercontrol.addOverlay(plan, 'route');
					}

					setPositions(); // draw actual flight position data
				} // end mapReady

				function setPositions() { // do positions (Flex)
					p = flight.positions;
					positions = [];
					var last = null, ct;
					var multi = [];
					for (i = 0; i < p.length; i++) {
						ct = Date.parse(p[i].date);
						if (last) {
							if (Math.abs(ct - last) > 600000) {	// no data for 10 minutes
								multi.push(positions);
								positions = [];
							}
						}
						lat = +p[i].lat; lon = +p[i].lon;
						positions.push(L.latLng(lat, wrap && lon>0 ? lon-360 : lon, true));
						last = ct;
					}
					multi.push(positions);
					if (path) {	// layer already exists
						path.setLatLngs(multi);
					} else {	// create layer
						path = L.multiPolyline(multi, { color: '#606', opacity: 0.8, weight: 2 }).addTo(map).bindLabel(pathlabel);
						layercontrol.addOverlay(path, 'flight path');
					}
				}

			} // end getFlight

			function trackfun(e) {
				tracking = true;
				settrackingview();
			}
			function fullfun(e) {
				tracking = false;
				setfullview();
			}


		} // end mainloop

		mainloop();
		setInterval(mainloop, 10000);

	});

	L.Marker.include({  // add rotate function to Marker class
		rotate: function(deg) {
			var $icon = $(this._icon).find('img').css('transform', 'rotate('+deg+'deg)');			
			return this;
		}
	});

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