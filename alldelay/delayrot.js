(function($){
  "use strict";

	var airport_appId='23d80adf', airport_appKey='ebc0894e85d4ef2435d40914a285f956';
  var flight_appId='368357de', flight_appKey='03072013';
  var tracker_appId='368357de', tracker_appKey='26901bf7d1f3534aa1e7a5a3be111b39';
	var airportSize = 2; // size of airports to display (1 is primary hub)
	var minDelay = 1.0;  // min airport delay (0 - 5)
  var minDelayTime = 15;  // min flight delay in minutes
  var flipTime = 15000; // one minute per screen

  $(document).ready(function() {

    var airport, airportDict;
    var bounds = [[24.3, -125], [49.5, -66.8]]; // Continental US
    var colors = [ 'lightgreen', 'yellow', 'darkorange', 'red', 'darkred' ];
    var $frame;
    var state = 0;
    var dair, arr;
  
    setInterval(mainloop, flipTime);
    mainloop();

    function mainloop() {
      switch(state) {
        case 0: // delay map
          $frame = $('<iframe />', {
            src: '../delay/index.html?mapArea=conus'
          }).appendTo('#top');
          state++;
        break;
        case 1: // list of delayed airports
          airportDelays();
          state++;
        break;
        case 2: // airport tracker departures
          $frame = $('<iframe />', {
            src: '../airtrack/index.html?zoomLevel=7&arrDep=dep&airportCode='+dair+
                '&appId='+tracker_appId+'&appKey='+tracker_appKey
          }).appendTo('#top');
          state++;
        break;
        case 3: // list of delayed departures
          arr = false;
          flightDelays(dair);
          state++;
        break;
        case 4: // airport tracker arrivals
          $frame = $('<iframe />', {
            src: '../airtrack/index.html?zoomLevel=7&arrDep=arr&airportCode='+dair+
                '&appId='+tracker_appId+'&appKey='+tracker_appKey
          }).appendTo('#top');
          state++;
        break;
        case 5: // list of delayed arrivals
          arr = true;
          flightDelays(dair);
          state = 0;
        break;
      }
    }

    function airportDelays() {  // airport delays
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
      airportDict = getAppendix(data.appendix.airports);
      var di = data.delayIndexes;
      di.sort(cpa);
      $('#tab').empty();
      $('<tr><th></th><th></th><th></th><th id="flcol" colspan="2" align="center">Flights</th><th></th><tr>'+
        '<tr><th>Airport</th><th>City</th><th>Severity</th><th>Delayed</th><th>Canceled</th><th>Trend</th></tr>').
          appendTo('#tab');    
      for (var i = 0; i < di.length ; i++) {
        el = di[i];
        ap = airportDict[el.airportFsCode];
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
      if ($frame) { // frame exists, delete
        $frame.remove();
      }
      if (di.length > 0) {
        di.sort(cpd);
        dair = di[0].airportFsCode;
      }
    }

    function cpa(a, b) {
      var delayed;
      if (a.normalizedScore === b.normalizedScore) {
        delayed = (b.observations - b.onTime) - (a.observations - a.onTime);
        return delayed === 0 ?  b.canceled - a.canceled : delayed;
      }
      return b.normalizedScore - a.normalizedScore;
    }

    function cpd(a, b) {
      var delayed = (b.observations - b.onTime - b.canceled) - (a.observations - a.onTime - a.canceled);
      return delayed === 0 ? b.normalizedScore - a.normalizedScore : delayed;
    }

    function flightDelays(airport) {
      $('#header').text(airport + ' Delayed '+(arr ? 'Arrivals' : 'Departures'));
      $.ajax({
            url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/airport/tracks/' + airport + '/' +
              (arr ? 'arr' : 'dep'),
            data: { maxPositions: 1, appId: flight_appId, appKey: flight_appKey, includeFlightPlan: false },
            dataType: 'jsonp',
            success: getFlights,
            error: badajax
          });      
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
      var el, ap, c, d;
      airportDict = getAppendix(data.appendix.airports);
      var t = data.flightTracks;
      t.sort(cpf);
      $('#tab').empty();
      $('<tr><th>Flight</th><th>Delay</th><th>'+(arr ? 'Origin' : 'Destination')+'</th><th>City</th></tr>').
      		appendTo('#tab');
      for (var i = 0; i < t.length; i++) {
      	el = t[i];
        d = +el.delayMinutes;
        if (el.delayMinutes === undefined || d < minDelayTime) { break; }
      	ap = arr ? el.departureAirportFsCode : el.arrivalAirportFsCode;
      	c = airportDict[ap].countryCode;
        $('<tr><td>'+el.carrierFsCode+' '+el.flightNumber+'</td><td>'+
            '<span style="color:'+colors[Math.min(4, Math.floor(d/15)+1)]+'">'+
            (d >= 60 ? (d/60).toFixed(0)+':'+(d%60 < 10 ? '0' : '')+ d%60 : d+' min')+'</span></td><td>'+
      			ap+'</td><td>'+airportDict[ap].city+' '+(c !== 'US' && c !== 'CA' ? c : airportDict[ap].stateCode)+'</td></tr>').
      			appendTo('#tab');
      }
      if ($frame) { // frame exists, delete
        $frame.remove();
      }
    }

    function cpf(a, b) {
    	return (b.delayMinutes === undefined ? 0 : b.delayMinutes) - (a.delayMinutes === undefined ? 0 : a.delayMinutes);
    }

    function badajax(jqXHR, textStatus, errorThrown) {
      if (console && console.log) {
        console.log('AJAX JSONP Timeout', jqXHR, textStatus, errorThrown);
      }
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