(function($){
  "use strict";

	var airport_appId='23d80adf', airport_appKey='ebc0894e85d4ef2435d40914a285f956';
	var flight_appId='368357de', flight_appKey='03072013'
	var airportSize = 2; // size of airports to display (1 is primary hub)
	var minDelay = 1.0;  // min airport delay (0 - 5)
  var minDelayTime = 15;  // min flight delay in minutes

  $(document).ready(function() {

    var airport, arrDep, airports;
    var bounds = [[24.3, -125], [49.5, -66.8]]; // Continental US
    var colors = [ 'lightgreen', 'yellow', 'orange', 'red', 'darkred' ];
  
  	if (window.location.search.length > 4) {	// delayed flights by airport
  		window.location.href.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
          function(m,key,value) {
          	arrDep = key;
          	airport = value;
          });
  		$('#header').text(airport + ' Delayed '+(arrDep==='arr' ? 'Arrivals' : 'Departures'));
  		$.ajax({
            url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/airport/tracks/' + airport + '/' + arrDep,
            data: { maxPositions: 1, appId: flight_appId, appKey: flight_appKey, includeFlightPlan: false },
            dataType: 'jsonp',
            success: getFlights,
            error: badajax
  				});
  	} else {	// airport delays
  		$('#header').text('US Airports with Significant Delays');
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
      console.log('flight data:', data);
      var el, ap, c;
      airports = getAppendix(data.appendix.airports);
      var t = data.flightTracks;
      t.sort(cpf);
      $('<tr><th>Flight</th><th>Delay</th><th>'+(arrDep === 'arr' ? 'Origin' : 'Destination')+'</th><th>City</th></tr>').
      		appendTo('#tab');
      for (var i = 0; i < t.length; i++) {
      	el = t[i];
      	if (el.delayMinutes === undefined || el.delayMinutes < minDelayTime) { break; }
      	ap = arrDep === 'arr' ? el.departureAirportFsCode : el.arrivalAirportFsCode;
      	c = airports[ap].countryCode;
      	$('<tr><td>'+el.carrierFsCode+' '+el.flightNumber+'</td><td>'+el.delayMinutes+'</td><td>'+
      			ap+'</td><td>'+airports[ap].city+' '+(c !== 'US' && c !== 'CA' ? c : airports[ap].stateCode)+'</td></tr>').
      			appendTo('#tab');
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
      console.log('airport data:', data);
    	var el, dfl, ap, score;
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
      	dfl = el.observations - el.onTime - el.canceled;
      	score = el.normalizedScore;
      	$('<tr><td>'+el.airportFsCode+'</td><td>'+ap.city+' '+ap.stateCode+
      			'</td><td class="score"><span style="background-color:'+colors[Math.round(score)-1]+';padding:0 '+(score * 9)+'px;"></span></td><td>'+
      			(dfl > 0 ? dfl+' ('+Math.ceil(100*dfl/el.observations)+'%)' : '')+'</td><td>'+
      			(el.canceled > 0 ? el.canceled+' ('+Math.ceil(100*el.canceled/el.observations)+'%)' : '')+'</td><td>'+
      			(el.delta !== 0.0 ? (el.delta > 0 ? '<font color="green">improving</font>' : '<font color="red">worsening</font>') : '')+
      			'</td></tr>').appendTo('#tab').find('span').attr('title', score);
      }
    }

    function cpa(a, b) {
    	if (a.normalizedScore === b.normalizedScore) {
    		return b.onTime - a.onTime;
    	}
    	return b.normalizedScore - a.normalizedScore
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