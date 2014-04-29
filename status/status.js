// determine upline flight, if possible
/*global jQuery:false */

(function($){
	"use strict";

	var appId = '9543a3e8';
  var appKey = '91d511451d9dbf38ede3efafefac5f09';
	var airport = 'ATL';	// default airport

	var airline;
  var airlines, airports;
  var fairlines = {}, fairports = {};	// associated with flights
	var sairlines, sairports;	// sorted
	var flights = [];	// selected flights
	var fs;

	function getParams(p) {
    var params = {}; // parameters
    p.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { params[key] = value; });

    if (params.airport) { airport = params.airport.toUpperCase(); }
    if (params.airline) { airline = params.airline.toUpperCase(); }
  }

	getParams(window.location.href); // read parameters from URL

  $(document).ready(function() {

		$('#back').click(function() {
			$('#flights, #back').hide();
			mainloop();
		});

		$('#carrier, #dest').on('click', '.button', click1);
		$('#flights').on('click', '.button', click2);

		mainloop();
  });

  function mainloop() {

		var startTime = new Date();
		var year = startTime.getFullYear();
    var month = startTime.getMonth() + 1;
    var day = startTime.getDate();  // day in month
    var hour = startTime.getHours();
    var data = { appId: appId, appKey: appKey, numHours: 6 };
    if (airline) {
			data.carrier = airline;
    }
    $('#head').text('Flight Status for Flights Departing from '+airport);

		$.ajax({
			url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/airport/status/'+airport+
					'/dep/'+year+'/'+month+'/'+day+'/'+hour,  // start time
			data: data,
			dataType: 'jsonp',
			success: response
		});

  }

  function response(data, status, xhr) {
  	if (data.error) {
  		alert('error: ' + data.error.errorCode + ' - ' + data.error.errorMessage);
  		return;
  	}
		console.log('response: ', data);

		airports = getAppendix(data.appendix.airports);
		airlines = getAppendix(data.appendix.airlines);

		var i, j, fl,
				mkt;	// display marketing airline instead of operating airline
		fs = data.flightStatuses;
		for (i = 0; i < fs.length; i++) {
			fl = fs[i];
			if (fl.status === 'A' || fl.status === 'L') { continue; }
			mkt = true;
			if (fl.codeshares && fl.codeshares.length > 0) {
				for (j = 0; j < fl.codeshares.length; j++) {
					var cs = fl.codeshares[j];
					if (cs.relationship === 'S' || cs.relationship === 'X') {
						mkt = false;
						fl.zat_marketing = cs.fsCode;
						fairlines[cs.fsCode] = fairlines[cs.fsCode] ? fairlines[cs.fsCode] + 1 : 1;
					}
					// fairlines[cs.fsCode] = fairlines[cs.fsCode] ? fairlines[cs.fsCode] + 1 : 1; // moved up
				}
			if (mkt) { fairlines[fl.carrierFsCode] = fairlines[fl.carrierFsCode] ? fairlines[fl.carrierFsCode] + 1 : 1; }
			fairports[fl.arrivalAirportFsCode] = fairports[fl.arrivalAirportFsCode] ? fairlines[fl.arrivalAirportFsCode] + 1 : 1;
			}
		}

		sairlines = Object.keys(fairlines).sort(function(a, b) { return fairlines[b] - fairlines[a]; });
		sairports = Object.keys(fairports).sort(function(a, b) { return airports[a].city.localeCompare(airports[b].city); });

		$('#carrier').html('<div style="font-weight:bold">Select your Airline:</div>').show();
		for (i = 0; i < sairlines.length; i++) {
			$('<div class="button">'+airlines[sairlines[i]].name+'&nbsp;('+sairlines[i]+')</div>').data('acode', sairlines[i]).appendTo('#carrier');
		}
		$('#dest').html('<div style="font-weight:bold">Or select your Destination:</div>').show();
		for (i = 0; i < sairports.length; i++) {
			var ap = airports[sairports[i]];
			$('<div class="button">'+ap.city+'&nbsp;'+
					(ap.countryCode === 'US' || ap.countryCode == 'CA' ? ap.stateCode : ap.countryCode) +
					'&nbsp;('+ap.fs+')</div>').data('dcode', ap.fs).appendTo('#dest');
		}

  }

	function click1(e) {	// first click (airline or destination)
		var i, f, c, $d;
		var aline, sched, est;
		var b = $(e.target);
		$('#carrier, #dest').hide();
		$('#flights, #back').show();
		$('#flights').html('<div style="font-weight:bold">Select your Flight:</div>');

		// list of flights for a carrier
		if (e.delegateTarget.id === 'carrier') {
			fs.sort(function(a,b) {
				return Date.parse(a.departureDate.dateLocal) - Date.parse(b.departureDate.dateLocal);
			});
			f = b.data('acode');
			$('#head').text('Flight Status for Flights on '+airlines[f].name+' ('+f+')');
			for (i = 0; i < fs.length; i++) {
				c = fs[i];
				if (f.status != 'A' && f.status !== 'L' && (c.carrierFsCode === f /* || c.codeshares && c.codeshares.some(sharematch) */)) {
					aline = c.zat_marketing ? c.zat_marketing : c.carrierFsCode;
					sched = c.departureDate.dateLocal.slice(11,16);
					est = departure(c.operationalTimes).slice(11,16);
					$d = $('<div class="button">'+aline+' '+c.flightNumber+' to '+airports[c.arrivalAirportFsCode].city+
							' ('+c.arrivalAirportFsCode+'), sched: '+
							c.departureDate.dateLocal.slice(11,16)+(est !== sched ? ', est: '+est : '')+'</div>').
							data({"fid": c.flightId, "aline": aline, "fno": c.flightNumber }).appendTo('#flights');
					checkup($d, c.flightId);
				}
			}
		}

		// list of flights for a destination
		if (e.delegateTarget.id === 'dest') {
			f = b.data('dcode');
			$('#head').text('Flight Status for Flights to '+f);
			for (i = 0; i < fs.length; i++) {
				c = fs[i];
				if (f.status != 'A' && f.status !== 'L' && c.arrivalAirportFsCode === f) {
					aline = c.zat_marketing ? c.zat_marketing : c.carrierFsCode;
					sched = c.departureDate.dateLocal.slice(11,16);
					est = departure(c.operationalTimes).slice(11,16);
					$('<div class="button">'+airlines[aline].name+ ' ('+aline+') '+c.flightNumber+', sched: '+
							c.departureDate.dateLocal.slice(11,16)+(est !== sched ? ', est: '+est : '')+'</div>').
							data({"fid": c.flightId, "aline": aline, "fno": c.flightNumber }).appendTo('#flights');

				}
			}
		}	// end click1

		function checkup($d, c) {
			$.ajax({
				url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/status/'+c,
					data: { appId: appId, appKey: appKey, extendedOptions: 'includeNewFields' },
					// sourceType: 'derived', includeFlightPlan: true },
				dataType: 'jsonp',
				success: checkupResponse
			});
			function checkupResponse(data) {
				if (data.flightStatus && data.flightStatus.schedule && data.flightStatus.schedule.uplines) {
					console.log('schedule:', data.flightStatus.schedule, 'flightId:', data.flightStatus.flightId);
					var $u = $('<span>', { text: ' (upline '+data.flightStatus.schedule.uplines[0].fsCode+')',
							data: { id: data.flightStatus.schedule.uplines[0].flightId } }).appendTo($d);
					$u.click(function(e) {
						var fl = $(e.target).data().id;
						$.ajax({
							url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/status/'+fl,
								data: { appId: appId, appKey: appKey, extendedOptions: 'includeNewFields' },
								// sourceType: 'derived', includeFlightPlan: true },
							dataType: 'jsonp',
							success: uplineResponse
						});
					});
				}
			}
			function uplineResponse(data) {
				console.log(data, data.flightStatus.status);
			}
		}

		function sharematch(el) {
			return el.fsCode === f;
		}

	}

	function click2(e) {	// second click (status of flight)
		var b = $(e.target);
		var d = b.data();
		var f, dom;
		for (var i = 0; i < fs.length; i++) {
			if (fs[i].flightId === d.fid) {
				f = fs[i];
				var dest = airports[f.arrivalAirportFsCode];
				$('#head').text('Flight Status for '+airlines[f.carrierFsCode].name+' '+d.aline+' '+d.fno);
				dom = $('#flights');
				dom.empty();
				if (f.flightEquipment && f.flightEquipment.actualEquipmentIataCode) {
					$('<div>Equipment: '+f.flightEquipment.actualEquipmentIataCode+'</div>').appendTo(dom);
				}
				if (f.airportResources && f.airportResources.departureTerminal) {
					$('<div>Departure Terminal: '+f.airportResources.departureTerminal+
						(f.airportResources && f.airportResources.departureGate ? ' Gate: '+f.airportResources.departureGate : '')+
						'</div>').appendTo(dom);
				}
				$('<div>Scheduled Departure Time: '+f.departureDate.dateLocal.slice(11,16)+'</div>').appendTo(dom);
				if (f.operationalTimes) {
					$('<div>Estimated Departure Time: '+departure(f.operationalTimes).slice(11,16)+'</div>').appendTo(dom);
				}
				if (f.delays) {
					if (f.delays.departureGateDelayMinutes && f.delays.departureGateDelayMinutes > 4) {
						$('<div>Gate Departure Delay: '+f.delays.departureGateDelayMinutes+' minutes</div>').appendTo(dom);
					}
				}
				if (f.flightDurations) {
					if (f.flightDurations.scheduledBlockMinutes) {
						$('<div>Gate-to-Gate Flight Duration: '+timehours(f.flightDurations.scheduledBlockMinutes)+'</div>').appendTo(dom);
					}
				}

				$('<div>Arrival Airport: '+f.arrivalAirportFsCode+', '+dest.name+', '+
						dest.city+(dest.stateCode ? ' '+dest.stateCode : '')+' '+dest.countryCode+'</div>').appendTo(dom);
				$('<div>Scheduled Arrival Time: '+f.arrivalDate.dateLocal.slice(11,16)+'</div>').appendTo(dom);

				$('<button>Full Data</button>').appendTo(dom).click(fdata);
				$('<button>Full Status</button>').appendTo(dom).click(fstatus);
				break;
			}
		}

		function fdata(e) {
			$('<pre>', { text: JSON.stringify(f, null, 3) }).appendTo(dom);
		}

		function fstatus(e) {
			$.ajax({
				url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/flight/status/'+f.flightId,
					data: { appId: appId, appKey: appKey, extendedOptions: 'includeNewFields' },
					// sourceType: 'derived', includeFlightPlan: true },
				dataType: 'jsonp',
				success: flightResponse
			});
		}
		function flightResponse(data) {
			if (data.flightStatus && data.flightStatus.schedule && data.flightStatus.schedule.uplines) {
				$('<div>', { text: 'Uplines: '+data.flightStatus.schedule.uplines.length+' from '+
					data.flightStatus.schedule.uplines[0].fsCode }).appendTo(dom);
			}
			$('<pre>', { text: JSON.stringify(data, null, 3) }).appendTo(dom);
		}

	}	// end click2

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

  function departure(t) {
		if (t === undefined) { return ''; }
		if (t.estimatedGateDeparture) { return t.estimatedGateDeparture.dateLocal; }
		if (t.scheduledGateDeparture) { return t.scheduledGateDeparture.dateLocal; }
		if (t.actualGateDeparture) { return t.actualGateDeparture.dateLocal; }
		if (t.estimatedRunwayDeparture) { return t.estimatedRunwayDeparture.dateLocal; }
		if (t.actualRunwayDeparture) { return t.actualRunwayDeparture.dateLocal; }
		if (t.flightPlanPlannedDeparture) { return t.flightPlanPlannedDeparture.dateLocal; }
		if (t.publishedDeparture) { return t.publishedDeparture.dateLocal; }
  }

  function timehours(t) {
		t = +t;
		if (t >=60) {
			return Math.floor(t / 60)+' hours, '+(t % 60) +' minutes';
		} else {
			return t+' minutes';
		}
  }

}(jQuery));