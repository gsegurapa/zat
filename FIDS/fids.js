// FIDS widget in javascript

(function($){
  
  var aircode = "PDX"; // default
  // var elapsed = 6*60; // in minutes
  var backup = 30; // time in past to display
  var numHours = 6; // elapsed time to display
  var showcodeshares = true;
  
  var linepos = 140;
  var lines = [];
  var dtime;  // timeout for detail
  var $popped; // which detail is showing
  var $sorted; // header element of current sort order
  var order = 1; // 1 ascending, -1 descending
  // var inout = 'dep';  // departing, use 'arr' for arrivals
  var inout = 'arr';  // arriving, use 'dep' for departures

  var appId = '9543a3e8';
  var appKey = '91d511451d9dbf38ede3efafefac5f09';

  var params = window.location.href.match(/\?.*$/);
  if (params && params[0] && params[0].length === 4) {
    aircode = params[0].substr(1);
  } else if (window.location.search.length > 4) { // arr=PDX or dep=SEA
      window.location.href.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) {
          inout = key;
          aircode = value;
        });
    }

  
  function strcmp( str1, str2 ) {
    return ( ( str1 == str2 ) ? 0 : ( ( str1 > str2 ) ? 1 : -1 ) );
  }
  
  function flightcmp(a, b) {
    var r = order * (a.flight() - b.flight());
    return (r !== 0) ? r : order * (a.index() - b.index());
  }
  
  function timecmp(a, b) {
    if (a.time() !== b.time()) { return order * (a.time() - b.time()); }
    return order * (a.index() - b.index());
  }
  
  function carriercmp(a, b) {
    var r = order * strcmp(a.carrier(), b.carrier());
    return (r !== 0) ? r : order * timecmp(a, b);
  }
  
  function destcmp(a, b) {
    var r = order * strcmp(a.city(), b.city());
    if (r !== 0) { return r; }
    r = order * strcmp(a.airport(), b.airport());
    return (r !== 0) ? r : order * timecmp(a, b);
  }
  
  var fields = [
    { title: 'Carrier', left: 0, width: '15%', sort: carriercmp },
    { title: 'Flight', left: '16%', width: '12%', sort: flightcmp },
    { title: inout==='dep' ? 'Destination' : 'Origin', left: '37%', width: '21%', sort: destcmp },
    { title: inout==='dep' ? 'Departure' : 'Arrival', left: '58%', width: '18%', sort: timecmp },
    { title: 'Status', left: '75%', width: '16%', sort: function(a, b) { return order * (a.delay() - b.delay()); } }];
    
    
  // returns the specified time suitable for passing as a parameter to Flightstats web service
  function dateParam(d) { // d is a Date object
    return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()+'T'+d.getHours()+':'+d.getMinutes();
  } // example: 2011-09-15T12:00
  
  // parse Flightstats web service date into Date Object
  // example: 2011-09-19T13:45:00.000
  function parseDate(d) {
    if (d === undefined) { alert('undefined date '+d); return undefined; }
    var m = d.match(/(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d).(\d\d\d)/);
    return new Date(m[1], m[2], m[3], m[4], m[5], m[6], m[7]);
  }
  
  var daynames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  function prevented(e) { // prevent default event behavior
    if (e.preventDefault) e.preventDefault();
  }
  
  function showDetails(e) {
    if ($popped) { hideDetails(); }
    $popped = $(e.currentTarget); // .FlightHistory
    dtime = setTimeout(function() { // delay
      // $l.stop(true, true);
      $popped.addClass('pop').css({'z-index': 10}).animate({height: 80}, 'fast');
      var offset = $(window).height()+$(document).scrollTop()-$popped.offset().top;
      if (offset < 90) {
        $('body').animate({scrollTop: '+='+(95-offset)}, {duration: 700, queue: false});
      }
    }, 400);
  }
  
  function hideDetails(e) {
    if ($popped) { $popped.stop().removeClass('pop').css({height: 29, 'z-index': 2}); }
    $popped = undefined;
    clearTimeout(dtime);
  }
    
  // a line of information about a flight
  function Fline(args) { // a displayable output line for a flight
    args = args || {};
    var carrierCode = args.carrierCode,
      flightNum = args.flightNum,
      carrierName = args.carrierName,
      otherAirportCode = args.otherAirportCode,
      otherAirport = args.otherAirport,
      flightTime = args.flightTime,
      status = args.status,
      delay = args.delay,
      departDateStr = args.departDateStr,
      vpos = args.vpos || 0,
      fid = args.fid,
      csid = args.csid,
      csdsg = args.csdsg,
      origCarrier = args.origCarrier,
      origName = args.origName,
      origFlight = args.origFlight,
      index = args.index;
      // ap = aobj[otherAirportCode].a;
    // console.log(departTime.toLocaleTimeString());
    var $l = $('<div class="FlightHistory">'+
        // Carrier (image)
        '<div class="tcell" style="width:95px;left:0"><img class="linelogo" src="http://dem5xqcn61lj8.cloudfront.net/logos/'+carrierCode+'.gif" /></div>'+
        // Flight (name)
        '<div class="tcell" style="width:16%;left:16%"><span class="incell">'+(codeshare()?'<em>':'')+
        flightNum+(codeshare()?'</em>':'')+'</span></div>'+
        // Destination (airport, city)
        '<div class="tcell" style="width:21%;left:35%"><span class="incell" style="font-size:0.8em">'+
        otherAirport.city+' ('+otherAirportCode+')</span></div>'+
        // Departure (time)
        '<div class="tcell" style="width:18%;left:58%"><span class="incell" style="font-size:0.8em;">'+
        flightTime.toLocaleTimeString()+'</span></div>'+  // .match(/[^ ]+ [^ ]+/)
        // Status and delay
        '<div class="tcell" style="width:16%;left:80%"><span style="font-size:0.8em;line-height:0">'+
        status+'<br />'+(delay>=5?'<span class="delay">Delayed '+(delay)+'m</span>' : 'On-time')+'</span></div>'+
        // Flight info line
        '<div class="tcell" style="width:97%;left:1%;top:29px;font-size:0.8em;text-align:left;overflow:hidden;white-space:nowrap;">'+
        '<span class="carrierName">'+carrierName+'</span> '+carrierCode+' '+flightNum+
        ' to '+otherAirport.name+', '+otherAirport.city+' '+(otherAirport.stateCode ? otherAirport.stateCode+' ' : '')+
        (otherAirport.countryCode!=='US'?otherAirport.countryCode:'')+
        '</div>'+
        // Codeshare line
        (codeshare()?'<div class="tcell" style="width:97%;left:1%;top:44px;font-size:0.8em;text-align:left"><em>Operated by '+
        origName+' ('+origCarrier+' '+origFlight+')</em></div>':'')+
        // Links line
        '<div class="tcell links" style="width:97%;left:1%;top:60px"><a href="http://zat.com/apps/flick?id='+
        fid+'&airline='+carrierCode+'&flight='+flightNum+'" target="_blank">Live Flight Tracker</a>'+
        '&nbsp;&nbsp;<a href="http://zat.com/apps/delaylist?dep='+otherAirportCode+'" target="_blank">'+otherAirportCode+
        ' Delay Info</a>&nbsp;&nbsp;<a href="http://www.flightstats.com/go/FlightStatus/flightStatusByFlight.do?id='+fid+
        '&airlineCode='+carrierCode+'&flightNumber='+flightNum+
        '&utm_source=34b64945a69b9cac:-220bf53d:1326e2c0feb:4a89&utm_medium=cpc&utm_campaign=weblet" target="_blank">Detail Flight Status</a></div>');
    
    $l.appendTo('#out');
    $l.mouseenter(showDetails).mouseleave(hideDetails);
    
    $l.find('.linelogo').bind('error', function(e) {
      prevented(e);
      var $e = $(e.target);
      $e.attr('src', 'blank.gif');
      var name = $.trim($e.parent().parent().find('.carrierName').text());
      $e.after('<span class="linename">'+name+'</span>');
      return false;
    });
    
    function codeshare() { return csdsg==='L'; } // is flight a codeshare?

    var pub = { // public methods
      move: function(pos) { // uses CSS transition
        vpos = pos;
        $l.css('top', vpos);
      },
      codeshare: codeshare,
      // show: function() { $l.css({display: 'block'}); },
      // hide: function() { $l.css({display: 'none'}); },
      retreat: function() { $l.css('z-index', 0); },
      flight: function() { return +flightNum; },
      carrier: function() { return carrierName; },
      airport: function() { return otherAirportCode; },
      city: function() { return otherAirport.city; },
      time: function() { return flightTime.getTime(); },
      delay: function() { return delay; },
      id: function() { return +fid; },
      index: function() { return index; },
    };
    return pub;
  }
  
  function dolines() {
    var len = lines.length;
    linepos = 140;
    for (var i = 0; i<len; i++) {
      if (showcodeshares || !lines[i].codeshare()) {
        lines[i].move(linepos);
        linepos += 29;
      } else { // hide codeshare
        lines[i].retreat(); // hide in back
        lines[i].move(linepos); // behind last visible
      }
    }
  }

  var tstatus = {
    A: 'Active', C: 'Canceled', D: 'Delayed', DN: 'Data Source Needed', L: 'Landed',
    NO: 'Not Operational', R: 'Redirected', S: 'Scheduled', U: 'Unknown'
  };

  $(document).ready(function() {
  
    var startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - backup);
    var year = startTime.getFullYear();
    var month = startTime.getMonth() + 1;
    var day = startTime.getDate();  // day in month
    var hour = startTime.getHours();
    // endTime.setMinutes(startTime.getMinutes() + elapsed);
    
    // top information
    $('#head').html('<div id="titleline">'+aircode+' '+(inout === 'dep' ? 'Departures' : 'Arrivals')+
        '</div><div id="airportname"></div>'+
        startTime.toLocaleString()+' (+<span id="numHours">'+numHours+
        '</span> hours)<br /><a class="button" href="http://zat.com/apps/airtrack/?airportCode='+
        aircode+'&appId='+appId+'&appKey='+appKey+'" target="_blank">Live Airport Tracker</a>&nbsp;&nbsp;<a class="button" href="http://zat.com/apps/delaylist/?dep='+
        aircode+'" target="_blank">'+aircode+' Delay Info</a>&nbsp;&nbsp;<span class="button csdisp">Hide Codeshares</span>'+
        '<br /><span style="font-family: Arial, sans-serif; font-size: 7pt">Click header to sort. Flight information is provided by '+
        '<a target="_blank" href="http://www.flightstats.com">FlightStats</a>.</span>'+
        '<br /><table class="tblhead"><tr class="tblrow"><td></td><td></td><td></td><td></td><td></td></tr></table>');
    // build URL in array
    var url = ['https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/airport/status/',
      aircode, '/', // airport code
      inout, '/', // dep or arr
      year, '/', month, '/', day, '/', hour  // start time
    ].join('');
    $.ajax({
      url: url,
      data: { appId: appId, appKey: appKey, numHours: numHours },
      dataType: 'jsonp',
      success: sg,
      error: badajax
    });

    // var url = ['http://www.pathfinder-xml.com/development/xml?Service=FlightHistoryGetRecordsService',
    //     'login.guid=34b64945a69b9cac:-220bf53d:1326e8030d5:e5',
    //     'info.specificationDepartures[0].airport.airportCode='+aircode,
    //     'info.specificationDateRange.departureDateTimeMin='+dateParam(startTime), // 2011-09-15T12:00
    //     'info.specificationDateRange.departureDateTimeMax='+dateParam(endTime), // 2011-09-15T16:00
    //     'info.flightHistoryGetRecordsRequestedData.codeshares=true&info.flightHistoryGetRecordsRequestedData.aggregatedAirports=true'
    //   ].join('&');
    // $.ajax({ url: url, success: sg});
    
    $('.csdisp').click(function(e) {
      $(e.target).text((showcodeshares?'Show':'Hide')+' Codeshares');
      showcodeshares = !showcodeshares;
      dolines();
    });

    function badajax(jqXHR, textStatus, errorThrown) {
      if (console && console.log) {
        console.log('AJAX JSONP Timeout', jqXHR, textStatus, errorThrown);
      }
    }

    function sg(data, status, xhr) {
      // console.log('response: ', data);
      if (!data || data.error) { return; }

      var airports = getAppendix(data.appendix.airports);
      var homeairport = airports[aircode];  // home airport
      $('#airportname').text(homeairport.name+' ('+homeairport.city+', '+
          (homeairport.stateCode !== undefined ? homeairport.stateCode+', ' : '')+homeairport.countryCode+')');

      var index = 0;
      var airlines = getAppendix(data.appendix.airlines);
      hour = data.request.hourOfDay.interpreted;

      $.each(data.flightStatuses, function(i, v) {
        var ft = parseDate(inout === 'dep' ?
          (v.operationalTimes && v.operationalTimes.estimatedRunwayDeparture && v.operationalTimes.estimatedRunwayDeparture.dateLocal ?
          v.operationalTimes.estimatedRunwayDeparture.dateLocal : v.departureDate.dateLocal) :
          (v.operationalTimes && v.operationalTimes.estimatedRunwayArrival && v.operationalTimes.estimatedRunwayArrival.dateLocal ?
          v.operationalTimes.estimatedRunwayArrival.dateLocal : v.arrivalDate.dateLocal));
        // console.log(dt, dt.valueOf());
        var other = inout === 'dep' ? v.arrivalAirportFsCode : v.departureAirportFsCode;
        var line = {
          index: index,
          fid: v.flightId,
          flightNum: v.flightNumber,
          carrierCode: v.carrierFsCode,
          carrierName: airlines[v.carrierFsCode].name,
          otherAirportCode: other,
          otherAirport: airports[other],
          flightTime: ft,
          departDateStr: (inout === 'dep' ? v.departureDate : v.arrivalDate).dateLocal.substr(0,10),
          delay: v.delays ? ( inout === 'dep' ?
              (v.delays.departureRunwayDelayMinutes || v.delays.departureGateDelayMinutes || 0) :
              (v.delays.arrivalRunwayDelayMinutes || v.delays.arrivalGateDelayMinutes || 0)
            ) : 0,
          status: tstatus[v.status],
          vpos: linepos+29
        };
        lines.push(Fline(line));
        index++;

        var cs = v.codeshares;
        if (cs) {
          line.origCarrier = line.carrierCode;
          line.origName = line.carrierName;
          line.origFlight = line.flightNum;
          var len = cs.length;
          for (var idx = 0; idx < len; idx++) {
            share(line, cs[idx]);
          }
        }
      });

      lines.sort(timecmp);
      dolines();

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

      function share(line, cs) {
        line.index = index++;
        line.csdsg = cs.relationship;
        line.flightNum = cs.flightNumber;
        line.carrierCode = cs.fsCode;
        line.carrierName = airlines[cs.fsCode].name;
        lines.push(Fline(line));
      }

    }
    
    var $tr = $('tr.tblrow td').each(function(i, el) {
      $(el).width(fields[i].width).text(fields[i].title);
      if (fields[i].title === 'Departure' || fields[i].title === 'Arrival') { $sorted = $(el).addClass('sortup'); } // initial value
      var sf = fields[i].sort;
      if (sf) { $(el).click(function(e) {
        if ($sorted) {
          $sorted.removeClass('sortup sortdown');
        }
        var $clk = $(e.currentTarget);
        order = ($clk.text() === $sorted.text() && order === 1) ? -1 : 1;
        $clk.addClass(order === 1 ? 'sortup' : 'sortdown');
        $sorted = $clk;
        lines.sort(sf);
        dolines();
      });}

    });

  });
}(jQuery));

  // parse XML tree into a JavaScript object
  // obj.a is a map of attributes
  // obj.c is a map of children nodes
  // a child node can be an array of nodes with the same name
  // function XML2obj($x) {
  //   var n = {},
  //       xa = $x[0].attributes;
  //   if (xa) { // has attributes
  //     n.a = {};
  //     var l = xa.length;
  //     for (var i = 0; i < l; i++) {
  //       n.a[xa[i].nodeName] = xa[i].nodeValue; // set attribute name:value
  //     }
  //   }
  //   var $c = $x.children();
  //   if ($c.length > 0) { // has children nodes
  //     n.c = {};
  //     $c.each(function() {
  //       var name = this.tagName;
  //       var child = n.c;
  //       if (child[name] === undefined) { // one child
  //         child[name] = XML2obj($(this));
  //       } else { // multiple children
  //         if (!$.isArray(child[name])) {
  //           child[name] = [child[name]];
  //         }
  //         child[name].push(XML2obj($(this)));
  //       }
  //     });
  //   }
  //   return n;
  // }
