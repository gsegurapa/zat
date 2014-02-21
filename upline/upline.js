// determine upline flight, if possible
/*global jQuery:false */

(function($){
	"use strict";

	var fid, airline, flight;
	var appId = '9543a3e8';
  var appKey = '91d511451d9dbf38ede3efafefac5f09';


	function getParams(p) {
    var params = {}; // parameters
    p.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { params[key] = value; });

    if (params.id) { fid = params.id; }
    if (params.airline) { airline = params.airline; }
    if (params.flight) { flight = params.flight; }
  }

	getParams(window.location.href); // read parameters from URL

	console.log('downline', airline, flight);


  $(document).ready(function() {

		$.ajax({
			url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/status/'+fid,
			data: { appId: appId, appKey: appKey },
			dataType: 'jsonp',
			success: response
		});

  });

  function response(data, status, xhr) {
		console.log('response: ', data);
  }

}(jQuery));