// Find flight and display status
/*global jQuery:false */

(function($){
	"use strict";

	var appId;
  var appKey;
	var airport = 'ATL';	// default airport
	var airline;

  var airlines, airports;	// appendices
	var flightStatuses;	// array of flight statuses

	// read parameters
	function getParams(p) {
    var params = {}; // parameters
    p.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { params[key] = value; });

    if (params.airport) { airport = params.airport.toUpperCase(); }
    if (params.airline) { airline = params.airline.toUpperCase(); }
    if (params.appId) { appId = params.appId; }
    if (params.appKey) { appKey = params.appKey; }
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

		$.ajax({	// make API call to FlightStats -- see developer.flightstats.com
			url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/airport/status/'+airport+
					'/dep/'+year+'/'+month+'/'+day+'/'+hour,  // start time
			data: data,
			dataType: 'jsonp',
			success: response
		});

  }	// end mainloop

  function response(data) {
		// console.log('response: ', data);
		if (data.error) {
			alert('error: ' + data.error.errorCode + ' - ' + data.error.errorMessage);
			return;
		}

		// read appendices and convert to objects
		airports = getAppendix(data.appendix.airports);
		airlines = getAppendix(data.appendix.airlines);

		var fairlines = {}, fairports = {};	// associated with flights

		var i, j,
				flstatus,	// flight status record
				codeshare,	// codeshare record
				mkt;	// display marketing airline instead of operating airline
		flightStatuses = data.flightStatuses;	// array of flight status records
		for (i = 0; i < flightStatuses.length; i++) {
			flstatus = flightStatuses[i];	// flight status record
			if (flstatus.status === 'A' || flstatus.status === 'L') { continue; }	// ignore active or landed flights
			mkt = true;
			if (flstatus.codeshares && flstatus.codeshares.length > 0) {
				for (j = 0; j < flstatus.codeshares.length; j++) {
					codeshare = flstatus.codeshares[j];
					if (codeshare.relationship === 'S' || codeshare.relationship === 'X') {
						mkt = false;
						flstatus.zat_marketing = codeshare.fsCode;	// save marketing airline
						fairlines[codeshare.fsCode] = fairlines[codeshare.fsCode] ? fairlines[codeshare.fsCode] + 1 : 1;
					}
				}
				if (mkt) {
					fairlines[flstatus.carrierFsCode] = fairlines[flstatus.carrierFsCode] ? fairlines[flstatus.carrierFsCode] + 1 : 1;
				} else {
					fairlines[flstatus.zat_marketing] = fairlines[flstatus.zat_marketing] ? fairlines[flstatus.zat_marketing] + 1 : 1;
				}

				fairports[flstatus.arrivalAirportFsCode] = fairports[flstatus.arrivalAirportFsCode] ? fairlines[flstatus.arrivalAirportFsCode] + 1 : 1;
			}
		}

		// sort airlines and airports to display
		var sairlines = Object.keys(fairlines).sort(function(a, b) { return fairlines[b] - fairlines[a]; });
		var sairports = Object.keys(fairports).sort(function(a, b) { return airports[a].city.localeCompare(airports[b].city); });

		// display airlines
		$('#carrier').html('<div style="font-weight:bold">Select your Airline:</div>').show();
		for (i = 0; i < sairlines.length; i++) {
			$('<div class="button">'+airlines[sairlines[i]].name+'&nbsp;('+sairlines[i]+')</div>').data('acode', sairlines[i]).appendTo('#carrier');
		}
		// display destination airports
		$('#dest').html('<div style="font-weight:bold">Or select your Destination:</div>').show();
		for (i = 0; i < sairports.length; i++) {
			var ap = airports[sairports[i]];
			$('<div class="button">'+ap.city+'&nbsp;'+
					(ap.countryCode === 'US' || ap.countryCode == 'CA' ? ap.stateCode : ap.countryCode) +
					'&nbsp;('+ap.fs+')</div>').data('dcode', ap.fs).appendTo('#dest');
		}

  }	// end response

	function click1(e) {	// first click (airline or destination)
		var i, f, c, $d;
		var aline, sched, est;
		var b = $(e.target);
		$('#carrier, #dest').hide();
		$('#flights, #back').show();
		$('#flights').html('<div style="font-weight:bold">Select your Flight:</div>');

		// list of flights for a carrier
		if (e.delegateTarget.id === 'carrier') {
			flightStatuses.sort(function(a,b) {
				return Date.parse(a.departureDate.dateLocal) - Date.parse(b.departureDate.dateLocal);
			});
			f = b.data('acode');
			$('#head').text('Flight Status for Flights on '+airlines[f].name+' ('+f+')');
			for (i = 0; i < flightStatuses.length; i++) {
				c = flightStatuses[i];
				aline = c.zat_marketing ? c.zat_marketing : c.carrierFsCode;
				if (c.status !== 'A' && c.status !== 'L' && aline === f) {
					sched = dltime(c.departureDate);
					est = dltime(departure(c.operationalTimes));
					$d = $('<div class="button">'+aline+' '+c.flightNumber+' to '+airports[c.arrivalAirportFsCode].city+
							' ('+c.arrivalAirportFsCode+'), sched: '+
							dltime(c.departureDate)+(est !== sched ? ', est: '+est : '')+'</div>').
							data({"fid": c.flightId, "aline": aline, "fno": c.flightNumber }).appendTo('#flights');
				}
			}
		}

		// list of flights for a destination
		if (e.delegateTarget.id === 'dest') {
			f = b.data('dcode');
			$('#head').text('Flight Status for Flights to '+f);
			for (i = 0; i < flightStatuses.length; i++) {
				c = flightStatuses[i];
				if (f.status != 'A' && f.status !== 'L' && c.arrivalAirportFsCode === f) {
					aline = c.zat_marketing ? c.zat_marketing : c.carrierFsCode;
					sched = dltime(c.departureDate);
					est = dltime(departure(c.operationalTimes));
					$('<div class="button">'+airlines[aline].name+ ' ('+aline+') '+c.flightNumber+', sched: '+
							dltime(c.departureDate)+(est !== sched ? ', est: '+est : '')+'</div>').
							data({"fid": c.flightId, "aline": aline, "fno": c.flightNumber }).appendTo('#flights');
				}
			}
		}

	} // end click1

	function click2(e) {	// second click (status of flight)
		var b = $(e.target);
		var d = b.data();
		var f, dom;
		for (var i = 0; i < flightStatuses.length; i++) {
			if (flightStatuses[i].flightId === d.fid) {
				f = flightStatuses[i];
				var dest = airports[f.arrivalAirportFsCode];
				$('#head').text('Flight Status for '+airlines[f.zat_marketing ? f.zat_marketing : f.carrierFsCode].name+' '+d.aline+' '+d.fno);
				dom = $('#flights');
				dom.empty();	// empty out the status

				// DISPLAY FLIGHT STATUS STARTING HERE
				// departure information
				$('<br />').appendTo(dom);
				if (f.airportResources && f.airportResources.departureTerminal) {
					$('<div>Departure Terminal: '+f.airportResources.departureTerminal+
						(f.airportResources && f.airportResources.departureGate ? ', Gate: '+f.airportResources.departureGate : '')+
						'</div>').appendTo(dom);
				}
				$('<div>Scheduled Departure Time: '+dltime(f.departureDate)+'</div>').appendTo(dom);
				if (f.operationalTimes) {
					$('<div>Estimated Departure Time: '+dltime(departure(f.operationalTimes))+'</div>').appendTo(dom);
				}
				if (f.delays) {
					if (f.delays.departureGateDelayMinutes && f.delays.departureGateDelayMinutes > 4) {
						$('<div>Gate Departure Delay: '+f.delays.departureGateDelayMinutes+' minutes</div>').appendTo(dom);
					}
				}
				if (f.flightDurations && f.flightDurations.scheduledTaxiOutMinutes) {
					$('<div>Estimated Taxi Out Time: '+timehours(f.flightDurations.scheduledTaxiOutMinutes)+'</div>').appendTo(dom);
				}

				// arrival information
				$('<br />').appendTo(dom);
				$('<div>Arrival Airport: '+f.arrivalAirportFsCode+', '+dest.name+', '+
						dest.city+(dest.stateCode ? ' '+dest.stateCode : dest.countryCode)+'</div>').appendTo(dom);
				if (f.airportResources && f.airportResources.arrivalTerminal) {
					$('<div>Arrival Terminal: '+f.airportResources.arrivalTerminal+
						(f.airportResources && f.airportResources.arrivalGate ? ', Gate: '+f.airportResources.arrivalGate : '')+
						'</div>').appendTo(dom);
				}
				$('<div>Scheduled Arrival Time: '+dltime(f.arrivalDate)+'</div>').appendTo(dom);
				if (f.operationalTimes && f.operationalTimes.estimatedGateArrival) {
					$('<div>Estimated Gate Arrival Time: '+dltime(f.operationalTimes.estimatedGateArrival)+'</div>').appendTo(dom);
				} else if (f.operationalTimes && f.operationalTimes.estimatedRunwayArrival) {
					$('<div>Estimated Runway Arrival Time: '+dltime(f.operationalTimes.estimatedRunwayArrival)+'</div>').appendTo(dom);
				}
				if (f.flightDurations && f.flightDurations.scheduledTaxiInMinutes) {
					$('<div>Estimated Taxi In Time: '+timehours(f.flightDurations.scheduledTaxiInMinutes)+'</div>').appendTo(dom);
				}

				// other information
				$('<br />').appendTo(dom);
				if (f.flightEquipment) {
					if (f.flightEquipment.actualEquipmentIataCode) {
						$('<div>Equipment: '+f.flightEquipment.actualEquipmentIataCode+'</div>').appendTo(dom);
					} else if (f.flightEquipment.scheduledEquipmentIataCode) {
						$('<div>Equipment: '+f.flightEquipment.scheduledEquipmentIataCode+'</div>').appendTo(dom);
					}
				}
				if (f.flightDurations) {
					if (f.flightDurations.scheduledBlockMinutes) {
						$('<div>Gate-to-Gate Flight Duration: '+timehours(f.flightDurations.scheduledBlockMinutes)+'</div>').appendTo(dom);
					}
					if (f.flightDurations.scheduledAirMinutes) {
						$('<div>In-air Flight Duration: '+timehours(f.flightDurations.scheduledAirMinutes)+'</div>').appendTo(dom);
					}
				}
				if (f.codeshares && f.codeshares.length > 0) {
					$('<div>Codeshares: '+(f.codeshares.map(mapcs).join(', ')) + '</div>').appendTo(dom);
				}

				// this is for development purposes only and should be removed
				$('<button>Raw Data</button>').appendTo(dom).click(dumpobj);
				break;
			}
		}

		function mapcs(cs) {
			if (cs.relationship === 'L' || cs.relationship === 'Z' || cs.relationship === 'C') {
				return airlines[cs.fsCode].name + ' ' + cs.fsCode + ' ' + cs.flightNumber;
			} else if (cs.relationship === 'S' || cs.relationship === 'X') {
				return airlines[f.carrierFsCode].name + ' ' + f.carrierFsCode + ' ' + f.flightNumber;
			}
		}

		function dumpobj() {
			$('<pre>', { text: JSON.stringify(f, null, 3) }).appendTo(dom);	// dump object
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
		if (t.estimatedGateDeparture) { return t.estimatedGateDeparture; }
		if (t.scheduledGateDeparture) { return t.scheduledGateDeparture; }
		if (t.actualGateDeparture) { return t.actualGateDeparture; }
		if (t.estimatedRunwayDeparture) { return t.estimatedRunwayDeparture; }
		if (t.actualRunwayDeparture) { return t.actualRunwayDeparture; }
		if (t.flightPlanPlannedDeparture) { return t.flightPlanPlannedDeparture; }
		if (t.publishedDeparture) { return t.publishedDeparture; }
  }

  function dltime(t) {	// return local time
		return t.dateLocal.slice(11,16);
  }

  function timehours(t) {	// split into hours and minutes and format
		var h, m;
		t = +t;
		if (t >=60) {
			h = Math.floor(t / 60);
			m = (t % 60);
			return h+' hour'+(h === 1 ? '' : 's')+', '+ m +' minute' + (m === 1 ? '' : 's');
		} else {
			return t+' minutes';
		}
  }

}(jQuery));
