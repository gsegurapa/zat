(function($){
	"use strict";

	var airport_appId='23d80adf', airport_appKey='ebc0894e85d4ef2435d40914a285f956';
	var flight_appId='368357de', flight_appKey='03072013';
  var tracker_appId='368357de', tracker_appKey='26901bf7d1f3534aa1e7a5a3be111b39';
	var airportSize = 2; // size of airports to display (1 is primary hub)
	var minDelay = 1.0;  // min airport delay (0 - 5)
	var minDelayTime = 15;  // min flight delay in minutes

	$(document).ready(function() {

		var airport, arrDep, airports;
		var interactive = true;
		var bounds = [[24.3, -125], [49.5, -66.8]]; // Continental US
		var colors = [ 'lightgreen', 'yellow', 'darkorange', 'red', 'darkred' ];
	
		if (window.location.search.length > 4) {	// delayed flights by airport
			window.location.href.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
					function(m,key,value) {
						if (key === 'interactive') {
							interactive = value === 'true';
						} else {
							arrDep = key;
							airport = value;
						}
					});
		}
		if (!interactive) {
			$('body').css('overflow', 'hidden');
		}
		if (arrDep === 'arr' || arrDep == 'dep') {
			$('#header').text(airport + ' Delayed ' + (arrDep==='arr' ? 'Arrivals' : 'Departures'));
			$('#arrdep').show().attr({
				src: (arrDep==='arr'?'arrive.png':'depart.png'),
				onclick: 'window.location.href="'+(arrDep==='arr'?
					window.location.href.replace('arr', 'dep') : window.location.href.replace('dep', 'arr'))+'";'});
			$('#domap').show().attr('onclick', 'window.location.href = "../airtrack/index.html?arrDep='+arrDep+'&airportCode='+airport+
				'&interactive=true&zoomLevel=7&showLabels=delay&flightMarkerScale=55&weatherFrames=3&appId='+
				tracker_appId+'&appKey='+tracker_appKey+'";');

			// var t = new Date();

			$.ajax({
							// url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/airport/status/' + airport + '/' + arrDep +
							//	'/' + t.getFullYear() + '/' + (t.getMonth() + 1) + '/' + t.getDate() + '/' + t.getHours(),
							url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/airport/tracks/' + airport + '/' + arrDep,
							data: { maxPositions: 1, appId: flight_appId, appKey: flight_appKey, includeFlightPlan: false },
							dataType: 'jsonp',
							success: getFlights,
							error: badajax
						});
		} else {	// airport delays
			$('#header').text('US Airports with Significant Delays');
			if (interactive) {
				$('#domap').show().attr('onclick', 'window.location.href = "../delay/index.html?mapArea=conus&showWeather=true&mapType=acetate";');
			}
			$.ajax({
						url: 'https://api.flightstats.com/flex/delayindex/rest/v2/jsonp/within/'+
						bounds[0][0]+'/'+bounds[0][1]+'/'+bounds[1][0]+'/'+bounds[1][1],
						data: { appId: airport_appId, appKey: airport_appKey, classification: airportSize, score: minDelay  },
						dataType: 'jsonp',
						success: getDelays,
						error: badajax
					});
		}

		function badajax(jqXHR, textStatus, errorThrown) {
			if (console && console.log) {
				console.log('AJAX JSONP Timeout', jqXHR, textStatus, errorThrown);
			}
		}

		function getFlights(data, status, xhr) {
			if (!data || data.error) {
				if (console && console.log) {
					console.log('data request error:', data.error.errorMessage, data);
				} else {
					if (data.error) { alert(data.error.errorMessage); }
				}
				return;
			}
			// console.log('flight data:', data);
			var el, ap, c, d, flag = 0;
			airports = getAppendix(data.appendix.airports);
			var t = data.flightTracks;
			t.sort(cpf);
			$('<tr><th>Flight</th><th>Delay</th><th>'+(arrDep === 'arr' ? 'Origin' : 'Destination')+'</th><th>City</th></tr>').
					appendTo('#tab');
			for (var i = 0; i < t.length; i++) {
				el = t[i];
				d = +el.delayMinutes;
				if (el.delayMinutes === undefined || d < minDelayTime) { break; }
				flag++;
				ap = arrDep === 'arr' ? el.departureAirportFsCode : el.arrivalAirportFsCode;
				c = airports[ap].countryCode;
				$('<tr><td>' +
					(interactive ? '<a href="../flick/index.html?id='+el.flightId+'&airline='+
						el.carrierFsCode+'&flight='+el.flightNumber+'">' : '') +
					el.carrierFsCode+' '+el.flightNumber+ (interactive ? '</a>' : '') + '</td><td>'+
					'<span style="color:'+colors[Math.min(4, Math.floor(d/15)+1)]+'">'+
					(d >= 60 ? (d/60).toFixed(0)+':'+(d%60 < 10 ? '0' : '')+ d%60 : d+' min')+'</span></td><td>'+
					(interactive ?  '<a href="'+window.location.href.replace('='+airport, '='+ap)+'">'+ap+'</a>' : ap)+
					'</td><td>'+airports[ap].city+' '+(c !== 'US' && c !== 'CA' ? c : airports[ap].stateCode)+'</td></tr>').
					appendTo('#tab');
			}
			if (flag === 0) {
				$('<tr><td colspan="4"><i>No Delayed Flights Found</i></td></tr>').appendTo('#tab');
			}
		}

		function cpf(a, b) {
			return (b.delayMinutes === undefined ? 0 : b.delayMinutes) - (a.delayMinutes === undefined ? 0 : a.delayMinutes);
		}

		function getDelays(data, status, xhr) {
			if (!data || data.error) {
				if (console && console.log) {
					console.log('data request error:', data.error.errorMessage, data);
				} else {
					if (data.error) { alert(data.error.errorMessage); }
				}
				return;
			}
			// console.log('airport data:', data);
			var el, dfl, ap, score, flag=0;
			airports = getAppendix(data.appendix.airports);
			var di = data.delayIndexes;
			di.sort(cpa);
			$('<tr><th></th><th></th><th></th><th id="flcol" colspan="2" align="center">Flights</th><th></th><tr>'+
				'<tr><th>Airport</th><th>City</th><th>Severity</th><th>Delayed</th><th>Canceled</th><th>Trend</th></tr>').
					appendTo('#tab');
			for (var i = 0; i < di.length ; i++) {
				el = di[i];
				ap = airports[el.airportFsCode];
				if (ap.countryCode !== 'US' && ap.countryCode !== 'CA') { continue; }
				flag++;
				dfl = el.observations - el.onTime - el.canceled;
				score = el.normalizedScore;
				$('<tr><td>'+
						(interactive?'<a href="index.html?dep='+el.airportFsCode+'">'+el.airportFsCode+'</a>':el.airportFsCode)+
						'</td><td>'+ap.city+' '+ap.stateCode+
						'</td><td class="score"><span style="background-color:'+colors[Math.round(score)-1]+';padding:0 '+(score * 9)+'px;"></span></td><td>'+
						(dfl > 0 ? dfl+' ('+Math.ceil(100*dfl/el.observations)+'%)' : '')+'</td><td>'+
						(el.canceled > 0 ? el.canceled+' ('+Math.ceil(100*el.canceled/el.observations)+'%)' : '')+'</td><td>'+
						(el.delta !== 0.0 ? (el.delta > 0 ? '<font color="green">improving</font>' : '<font color="red">worsening</font>') : '')+
						'</td></tr>').appendTo('#tab').find('span').attr('title', score);
			}
			if (flag === 0) {
				$('<tr><td colspan="6"><i>No Significant Airport Delays Found</i></td></tr>').appendTo('#tab');
			}
		}

		function cpa(a, b) {
			if (a.normalizedScore === b.normalizedScore) {
				var delayed = (b.observations - b.onTime) - (a.observations - a.onTime);
				return delayed === 0 ?  b.canceled - a.canceled : delayed;
			}
			return b.normalizedScore - a.normalizedScore;
		}

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
	});

}(jQuery));