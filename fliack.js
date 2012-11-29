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

	$(document).ready(function() {

		var airports, airlines, departureAirport, arrivalAirport, flightBounds, airplane, plan, path, positions, wrap;

		var map = L.map('map_div', {
			attributionControl: false,
			layers: defaultlayers,
			worldCopyJump: false,
			inertia: false
		}).addControl(layercontrol).addControl(attributioncontrol);

		var airportIcon = L.icon({
				iconUrl: 'http://dem5xqcn61lj8.cloudfront.net/Signage/AirportTracker/tower/classic.png',
				iconSize: [78, 145],
				iconAnchor: [17, 97],
				popupAnchor: [2, -93],
				labelAnchor: [7, -60]
		});
		var flightIcon = L.divIcon({ // airplane icon (orange)
				html: '<img class="airplaneicon" src="http://dem5xqcn61lj8.cloudfront.net/Signage/AirportTracker/airplane/shadow-orange.png" />',
				iconSize: [50, 50],
				iconAnchor: [25, 25],
				labelAnchor: [10, -5],
				className: ''
		});
		var pathlabel = airline+flightnum+' flight path'

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

			$.ajax({  // Flight track by flight ID
	        url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/track/' + flightID,
	        data: { appId: appId, appKey: appKey, includeFlightPlan: true },
	        dataType: 'jsonp',
	        success: getFlight
	      });

			// var url = 'http://www.flightstats.com/go/InternalAPI/singleFlightTracker.do?id='+flightID+'&airlineCode='+airline+'&flightNumber='+
			// 		flightnum+'&version=1.0&key=49e3481552e7c4c9%253A-5b147615%253A12ee3ed13b5%253A-5f90&responseType=jsonp';
			// var script = document.createElement('script');
			// script.setAttribute('src', url);
			// document.getElementsByTagName('head')[0].appendChild(script); // load the script

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

			function getFlight(data, status, xhr) {
				var lon, dpos, apos, fpos;
				if (!data || data.error) {
					alert('AJAX error: '+data.error.errorMessage);
					return;
				}

				if (console && console.log) console.log('Flex API data: ',data);

				var flight = data.flightTrack;
				var pos = flight.positions[0];

				if (flightBounds === undefined) { // first time called
					airports = getAppendix(data.appendix.airports);
					airlines = getAppendix(data.appendix.airlines);
					departureAirport = flight.departureAirportFsCode;
					var depa = airports[departureAirport];
					arrivalAirport = flight.arrivalAirportFsCode;
					var arra = airports[arrivalAirport];

					wrap = Math.abs(depa.longitude - arra.longitude) > 180; // does route cross anti-meridian

					lon = +depa.longitude;
					dpos = L.latLng(+depa.latitude, wrap && lon>0 ? lon-360 : lon, true);
					var label = '<span class="labelhead">From '+departureAirport+'</span><br />'+depa.name+
								'<br />'+depa.city+(depa.stateCode ? ', '+depa.stateCode : '')+', '+depa.countryCode; // +
								// '<br />Local time: '+(new Date(depa.localTime).toLocaleTimeString());
					L.marker(dpos, { icon: airportIcon }).addTo(map).bindLabel(label); // departing airport icon

					lon = +arra.longitude;
					apos = L.latLng(+arra.latitude, wrap && lon>0 ? lon-360 : lon, true);
					label = '<span class="labelhead">To '+arrivalAirport+'</span><br />'+arra.name+
								'<br />'+arra.city+(arra.stateCode ? ', '+arra.stateCode : '')+', '+arra.countryCode; // +
								// '<br />Local time: '+(new Date(arra.localTime).toLocaleTimeString());	
					L.marker(apos, { icon: airportIcon }).addTo(map).bindLabel(label); // arriving airport icon

					lon = +pos.lon;
					fpos = L.latLng(+pos.lat, wrap && lon>0 ? lon-360 : lon, true);
					label = '<span class="labelhead">'+airlines[flight.carrierFsCode].name+'</span>'+
								'<br />Flight #: '+flight.flightNumber+
								'<br />Route: '+departureAirport+' to '+arrivalAirport+
								'<br />Lat/Long: '+fpos.lat.toFixed(2)+'/'+fpos.lng.toFixed(2)+
								'<br />Altitude: '+pos.altitudeFt+' ft'+
								'<br />Speed: '+pos.speedMph+' mph'+
								'<br />Bearing: '+(+flight.bearing).toFixed()+' deg'+
								'<br />Equipment: '+flight.equipment;
					airplane = L.marker(fpos, { icon: flightIcon, zIndexOffset: 1000 }).	// airplane icon
							addTo(map).rotate(+flight.heading).bindLabel(label);
					
					if (wrap) { // set map view including both airports and current position of flight
						flightBounds = L.latLngBounds([
								[dpos.lat, dpos.lng+180],
								[apos.lat, apos.lng+180],
								[fpos.lat, fpos.lng+180]
							]).pad(0.05);
						var c = flightBounds.getCenter();
						map.setView(L.latLng(c.lat, c.lng - 180, true) , map.getBoundsZoom(flightBounds));
					} else {
						flightBounds = L.latLngBounds([ dpos, apos, fpos ]).pad(0.05);
						map.fitBounds(flightBounds);
					}					
					
					// do waypoints (flight plan)
					var p = flight.waypoints;
					if (p) { // there is a flight plan
						positions = new Array(p.length);
						for (var i = 0; i < p.length; i++) {
							lat = +p[i].lat; lon = +p[i].lon;
							// positions[i] = L.latLng(lat, wrap && lon<0 ? lon : lon-360, true);
							positions[i] = L.latLng(lat, wrap && lon>0 ? lon-360 : lon, true);
						}
						plan = L.polyline(positions, { color: '#3dd', weight: 7, dashArray: '5, 8'}).bindLabel(airline+flightnum+' flight plan').addTo(map);
						layercontrol.addOverlay(plan, 'flight plan');
					} // end if there is a flight plan

					// do positions (Flex)
					p = flight.positions;
					positions = [];
					var last = null, ct;
					var multi = [];
					for (i = 0; i < p.length; i++) {
						ct = Date.parse(p[i].date);
						if (last) {
							if (Math.abs(ct - last) > 600000) {	// no data for 10 minutes
								// console.log('gap: ',(ct - last)/60000);
								multi.push(positions);
								positions = [];
							}
						}
						lat = +p[i].lat; lon = +p[i].lon;
						positions.push(L.latLng(lat, wrap && lon>0 ? lon-360 : lon, true));
						last = ct;
					}
					multi.push(positions);
					path = L.multiPolyline(multi, { color: '#088', opacity: 0.8, weight: 3 }).bindLabel(pathlabel).addTo(map);
					layercontrol.addOverlay(path, 'flight path');
				} else {
					// path.addLatLng
				}
			} // end getFlight
		} // end mainloop

		mainloop();

	});

	L.Marker.include({  // add rotate function to Marker class
		rotate: function(deg) {
			var $icon = $(this._icon).find('img').css('transform', 'rotate('+deg+'deg)');
			return this;
		}
	});

}(jQuery));