// FlightStats flight tracker

(function($){

	// process URL parameters
	var flightID, // flightstats flight id
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
	}

	getParams(window.location.href);

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

		var airports, airlines, departureAirport, arrivalAirport, flightBounds, airplane, plan, path;

		var map = L.map('map_div', {
			attributionControl: false,
			layers: defaultlayers
		});
		map.addControl(layercontrol).addControl(attributioncontrol);

		var airportIcon = L.icon({
				iconUrl: 'http://dem5xqcn61lj8.cloudfront.net/Signage/AirportTracker/tower/classic.png',
				iconSize: [78, 145],
				iconAnchor: [17, 97],
				popupAnchor: [2, -93]
		});
		var flightIcon = L.divIcon({ // airplane icon (orange)
				html: '<img class="airplaneicon" src="http://dem5xqcn61lj8.cloudfront.net/Signage/AirportTracker/airplane/shadow-orange.png" />',
				iconSize: [50, 50],
				iconAnchor: [25, 25],
				className: ''
		});

		function mainloop() {

			$.ajax({  // Flight track by flight ID
	        url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/track/' + flightID,
	        data: { appId: appId, appKey: appKey, maxPositions: 100, includeFlightPlan: true },
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

			function getFlight(data, status, xhr) {
				if (!data || data.error) {
					alert('AJAX error: '+data.error.errorMessage);
					return;
				}

				console.log(data);

				var flight = data.flightTrack;
				var pos = flight.positions[0];

				if (flightBounds === undefined) {
					airports = getAppendix(data.appendix.airports);
					airlines = getAppendix(data.appendix.airlines);
					departureAirport = flight.departureAirportFsCode;
					var depa = airports[departureAirport];
					L.marker([depa.latitude, depa.longitude], { icon: airportIcon }).addTo(map).
							bindPopup('<strong>'+departureAirport+'</strong><br />'+depa.name+
								'<br />'+depa.city+(depa.stateCode ? ', '+depa.stateCode : '')+', '+depa.countryCode); // +
								// '<br />Local time: '+(new Date(depa.localTime).toLocaleTimeString()));
					arrivalAirport = flight.arrivalAirportFsCode;
					var arra = airports[arrivalAirport];
					L.marker([arra.latitude, arra.longitude], { icon: airportIcon }).addTo(map).
							bindPopup('<strong>'+arrivalAirport+'</strong><br />'+arra.name+
								'<br />'+arra.city+(arra.stateCode ? ', '+arra.stateCode : '')+', '+arra.countryCode); // +
								// '<br />Local time: '+(new Date(arra.localTime).toLocaleTimeString()));							

					flightBounds = L.latLngBounds([ // includes both airports and current position of flight
							L.latLng(depa.latitude, depa.longitude),
							L.latLng(arra.latitude, arra.longitude),
							L.latLng(pos.lat,pos.lon)]).pad(0.05);
					map.fitBounds(flightBounds);
					airplane = L.marker([+pos.lat, +pos.lon], { icon: flightIcon, zIndexOffset: 1000 }).addTo(map).rotate(+flight.heading).
							bindPopup('<strong>'+airlines[flight.carrierFsCode].name+' #'+flight.flightNumber+
								'</strong><br />Route: '+departureAirport+' to '+arrivalAirport+
								'<br />Lat/Lng: '+(+pos.lat).toFixed(2)+'/'+(+pos.lon).toFixed(2)+
								'<br />Altitude: '+pos.altitudeFt+' ft'+
								'<br />Speed: '+pos.speedMph+' mph'+
								'<br />Bearing: '+(+flight.bearing).toFixed()+' deg'+
								'<br />Equipment: '+flight.equipment);
					var ll = [];
					var p = flight.waypoints;
					for (var i = 0; i < p.length; i++) {
						ll.push([p[i].lat, p[i].lon]);
					}
					plan = L.polyline(ll, { color: '#3dd', dashArray: '5, 6'}).addTo(map);
					ll = [];
					p = flight.positions;
					for (i = 0; i < p.length; i++) {
						ll.push([p[i].lat, p[i].lon]);
					}
					path = L.polyline(ll, { color: '#088'}).addTo(map);
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