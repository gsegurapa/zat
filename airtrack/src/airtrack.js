// Track airplanes for a specified airport, for signage
// Also has animated weather
// See help.html for documentation
/* jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, unused:true, curly:true, indent:false */
/* global alert:false, console:false, jQuery:false, L:false, city:false, bBox:false, Raphael:false, BigScreen:false, document:false */

(function($){
  "use strict";

  if (window.location.search === '?help') {
    window.location.href = 'help.html';
  }

  var default_appId = '368357de'; // default app ID (rate limited)
  var default_appKey = '03072013'; // default app key

  var tilesinfo = {
    usterrain: {
      name: 'Flightstats Terrain US',
      url: 'http://maptiles-{s}.flightstats-ops.com/terrain/{z}/{x}/{y}.jpg',
      subdomains: 'abcd',
      attribution: 'Map data <a href="http://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a> <a href="http://stamen.com/">Stamen Design</a>, <a href="http://www.openstreetmap.org/">OpenStreetMap</a>',
      minZoom: 4, maxZoom: 12
    },
    usterrainbg: {
      name: 'Flightstats Terrain US Background',
      url: 'http://maptiles-{s}.flightstats-ops.com/terrainbg/{z}/{x}/{y}.jpg',
      subdomains: 'abcd',
      attribution: 'Map data <a href="http://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a> <a href="http://stamen.com/">Stamen Design</a>, <a href="http://www.openstreetmap.org/">OpenStreetMap</a>',
      minZoom: 4, maxZoom: 11
    },
    satellite: {
      name: 'Flightstats Satellite',
      url: 'http://maptiles-{s}.flightstats-ops.com/satellite/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      attribution: 'Map Data NASA/JPL-Caltech, U.S. Depart. of Agriculture Farm Service Agency',
      minZoom: 0, maxZoom: 11
    },
    road: {
      name: 'Flightstats Road',
      url: 'http://maptiles-{s}.flightstats-ops.com/surfer/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      attribution: 'Map data <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a> <a href="http://giscience.uni-hd.de/">University of Heidelberg</a>, <a href="http://www.openstreetmap.org/">OpenStreetMap</a>',
      minZoom: 0, maxZoom: 11
    },
    acetate: {
      name: 'Flightstats Acetate',
      url: 'http://maptiles-{s}.flightstats-ops.com/acetate/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      attribution: 'Map data <a href="http://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a> GeoIQ, <a href="http://stamen.com/">Stamen Design</a>, <a href="http://www.openstreetmap.org/">OpenStreetMap</a>, and Natural Earth',
      minZoom: 0, maxZoom: 10
    },
    blue: {
      name: 'Flightstats Blue',
      url: 'http://maptiles-{s}.flightstats-ops.com/blue/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      attribution: '&copy; Flightstats Inc.',
      minZoom: 0, maxZoom: 8
    },
    dark: {
      name: 'Flightstats Dark',
      url: 'http://maptiles-{s}.flightstats-ops.com/dark/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      attribution: '&copy; Flightstats Inc.',
      minZoom: 0, maxZoom: 8
    },
    mapquestopen: {
      name: 'MapQuest Open',
      url: 'http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.jpg',
      subdomains: '1234',
      attribution: '&copy; MapQuest, OSM contributors',
      minZoom: 0, maxZoom: 11
    },
    terrain: {
      name: 'Mapbox Terrain',
      url: 'http://maptiles-{s}.flightstats-ops.com/mapboxterrain/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      attribution: '&copy; Mapbox, ISM contributors',
      minZoom: 0, maxZoom: 11
    }
    // mapboxterrain: {  // http://mapbox.com/tour/#maps
    //   group: 'MapBox',
    //   name: 'Mapbox Terrain',
    //   url: 'http://{s}.tiles.mapbox.com/v3/examples.map-4l7djmvo/{z}/{x}/{y}.png',
    //   subdomains: 'abcd',
    //   attribution: 'Mapbox',
    //   minZoom: 0, maxZoom: 17
    // },
    // justinterrain: {  // http://mapbox.com/tour/#maps
    //   group: 'MapBox',
    //   name: 'Justin Terrain',
    //   url: 'http://{s}.tiles.mapbox.com/v3/justin.map-iw8x00lm/{z}/{x}/{y}.png',
    //   subdomains: 'abcd',
    //   attribution: 'Mapbox',
    //   minZoom: 0, maxZoom: 17
    // }


  };

  var flipairports = [
    { ac: 'HNL', lng: -157.92166, loc: 'Honolulu' },
    { ac: 'ANC', lng: -149.99638, loc: 'Anchorage' },
    // { ac: 'JNU', lng: -134.58339, loc: 'Juneau' },
    { ac: 'YVR', lng: -123.17919, loc: 'Vancouver' },
    { ac: 'PDX', lng: -122.5929, loc: 'Portland' },
    { ac: 'SFO', lng: -122.38988, loc: 'San Francisco' },
    { ac: 'SEA', lng: -122.301735, loc: 'Seattle' },
    { ac: 'LAX', lng: -118.40828, loc: 'Los Angeles' },
    { ac: 'LAS', lng: -115.1486, loc: 'Las Vegas' },
    { ac: 'PHX', lng: -112.00016, loc: 'Phoenix' },
    { ac: 'SLC', lng: -111.980675, loc: 'Salt Lake City' },
    { ac: 'DEN', lng: -104.672844, loc: 'Denver' },
    // { ac: 'MEX', lng: -99.07278, loc: 'Mexico City' },
    { ac: 'DFW', lng: -97.036125, loc: 'Dallas' },
    { ac: 'IAH', lng: -95.34, loc: 'Houston' },
    { ac: 'MSP', lng: -93.21092, loc: 'Minneapolis' },
    { ac: 'ORD', lng: -87.90488, loc: 'Chicago' },
    // { ac: 'CUN', lng: -86.874435, loc: 'Cancun' },
    { ac: 'ATL', lng: -84.44403, loc: 'Atlanta' },
    { ac: 'DTW', lng: -83.35605, loc: 'Detroit' },
    { ac: 'CLT', lng: -80.93584, loc: 'Charlotte' },
    { ac: 'MIA', lng: -80.27824, loc: 'Miami' },
    { ac: 'YYZ', lng: -79.61146, loc: 'Toronto' },
    { ac: 'IAD', lng: -77.44774, loc: 'Washington' },
    { ac: 'PHL', lng: -75.2433, loc: 'Philadelphia' },
    { ac: 'JFK', lng: -73.78817, loc: 'New York' },
    { ac: 'BOS', lng: -71.02018, loc: 'Boston' },

    { ac: 'BOG', lng: -74.143135, loc: 'Bogotá' },
    { ac: 'AEP', lng: -58.41667, loc: 'Buenos Aires' },
    { ac: 'GRU', lng: -46.481926, loc: 'São Paulo' },

    { ac: 'KEF', lng: -22.624283, loc: 'Reykjavik' },

    { ac: 'MAD', lng: -3.570209, loc: 'Madrid' },
    { ac: 'LHR', lng: -0.453566, loc: 'London' },
    { ac: 'LGW', lng: -0.161863, loc: 'London' },
    { ac: 'CDG', lng: 2.567023, loc: 'Paris' },
    { ac: 'AMS', lng: 4.763385, loc: 'Amsterdam' },
    { ac: 'FRA', lng: 8.570773, loc: 'Frankfurt' },
    { ac: 'MUC', lng: 11.790143, loc: 'Munich' },
    { ac: 'FCO', lng: 12.250346, loc: 'Rome' },

    { ac: 'JNB', lng: 28.231314, loc: 'Johannesburg' },
    { ac: 'IST', lng: 28.815277, loc: 'Istanbul' },
    { ac: 'CAI', lng: 31.40647, loc: 'Cairo' },
    { ac: 'NBO', lng: 36.92578, loc: 'Nairobi' },
    { ac: 'DXB', lng: 55.352917, loc: 'Dubai' },
    { ac: 'DEL', lng: 77.10079, loc: 'Delhi' },

    { ac: 'BKK', lng: 100.752045, loc: 'Bangkok' },
    { ac: 'KUL', lng: 101.70539, loc: 'Kuala Lumpur' },
    { ac: 'SIN', lng: 103.990204, loc: 'Singapore' },
    { ac: 'CGK', lng: 106.655525, loc: 'Jakarta' },
    { ac: 'HKG', lng: 113.93649, loc: 'Hong Kong' },
    { ac: 'PEK', lng: 116.5871, loc: 'Beijing' },
    { ac: 'ICN', lng: 126.45123, loc: 'Seoul' },
    { ac: 'NRT', lng: 140.38744, loc: 'Tokyo' },
    { ac: 'SYD', lng: 151.1799, loc: 'Sydney' },
    { ac: 'AKL', lng: 174.78352, loc: 'Auckland' }
  ];
  
  // animation settings
  var frameMin = 120; // frames per minute for plane movement
  var physicsFrame = 0.125; // 8 updates per second for physics engine
  var fm = 0.3 * physicsFrame; // force multiplier
  var updateRate = 15000; // 15 seconds (in milliseconds) for AJAX call
  var maintimer, physicstimer; // setInterval result

  var labelmargin = {12: '2px', 16: '3px', 24: '5px', 32: '7px'}; // valid label margins

  // process URL parameters --------------------------------------------------------------

  var airportCode, mapType, zoomLevel,
    showLabels, labelSize, showAirlineLogos, showOtherAirport, showDelays, // showOperatorAirlines,
    flightMarker, flightMarkerScale, airportMarker, airportMarkerScale, arrDep,
    showLegend, weatherFrames, weatherStation, weatherRadar, weatherOpacity, logo, fslogo, airlines,
    appId, appKey;

  function getParams(st) {
    
    var p = {}; // parameters
    st.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { p[key] = value; });

    if (p.airportCode) { airportCode = p.airportCode.toUpperCase(); }
    if (p.mapType) { mapType = p.mapType; }
    if ($.isNumeric(p.zoomLevel)) { zoomLevel = +p.zoomLevel; }
    if (p.showLabels) { showLabels = p.showLabels === 'delay' ? 'delay' : p.showLabels==='true'; }
    if ($.isNumeric(p.labelSize) && labelmargin[+p.labelSize]) { labelSize = +p.labelSize; }
    if (p.showAirlineLogos) { showAirlineLogos = p.showAirlineLogos==='true'; }
    if (p.showOtherAirport) { showOtherAirport = p.showOtherAirport==='true'; }
    if (p.showDelays) { showDelays = p.showDelays==='true'; }
    // if (p.showOperatorAirlines) { showOperatorAirlines = p.showOperatorAirlines==='true'; }
    if (p.flightMarker) { flightMarker = p.flightMarker; }
    if ($.isNumeric(p.flightMarkerScale)) { flightMarkerScale = +p.flightMarkerScale; }
    if (p.airportMarker) { airportMarker = p.airportMarker; }
    if ($.isNumeric(p.airportMarkerScale)) { airportMarkerScale = +p.airportMarkerScale; }
    if (p.arrDep) { arrDep = p.arrDep; }
    if (p.showLegend) { showLegend = p.showLegend==='true'; }
    if ($.isNumeric(p.weatherFrames)) { weatherFrames = +p.weatherFrames; }
    if (p.weatherStation) { weatherStation = (p.weatherStation&&p.weatherStation !== 'automatic')?p.weatherStation.toUpperCase():'automatic'; }
    if (p.weatherRadar) { weatherRadar = p.weatherRadar.toUpperCase(); }
    if ($.isNumeric(p.weatherOpacity)) { weatherOpacity = +p.weatherOpacity; }
    if (p.logo) { logo = decodeURI(p.logo); }
    if (p.airlines !== undefined) { airlines = p.airlines; }
    // not saved yet
    if (p.fslogo) { fslogo = p.fslogo==='true'; }
    if ($.isNumeric(p.updateRate)) { updateRate = 1000 * +p.updateRate; }
    // not savable
    if (p.interactive) { interactive = p.interactive==='true'; }
    if (p.view) { view = p.view.toUpperCase(); }
    if (p.flip) { flip = p.flip; }
    if ($.isNumeric(p.flipTime)) { flipTime = +p.flipTime; }
    if (p.jump) { jump = p.jump==='true'; }
    if (p.appId) { appId = p.appId; }
    if (p.appKey) { appKey = p.appKey; }
  }

  function setDefaults() {
    airportCode = 'PDX'; // default is Portland
    mapType = 'automatic'; // keys from tilesinfo
    zoomLevel = 9;
    showLabels = true;
    labelSize = 24;
    showAirlineLogos = true;
    showOtherAirport = true;
    showDelays = true;
    // showOperatorAirlines = 'false';
    flightMarker = 'smooth';
    flightMarkerScale = 70;
    airportMarker = 'classic';
    airportMarkerScale = 55;
    arrDep = 'both';
    showLegend = true;
    weatherFrames = 0; // number of frames
    weatherStation = 'automatic';
    weatherRadar = 'NCR'; // N0R, N1P, NTP, N0V, N0S, NCR, (N0Z)
    weatherOpacity = 30;
    logo = 'Zat';
    fslogo = false;
    airlines = '-';
    appId = ''; // app ID
    appKey = ''; // app key
  }

  function setCookie(name, value) {
    var date = new Date();
    date.setTime(date.getTime() + 730*86400000); // 2 years
    document.cookie = name+'='+value+'; expires='+date.toGMTString()+'; path='+window.location.pathname;
  }

  function saveCookies() {
    setCookie('airportCode', airportCode);
    setCookie('mapType', mapType);
    setCookie('zoomLevel', zoomLevel);
    setCookie('showLabels', showLabels.toString());
    setCookie('labelSize', labelSize);
    setCookie('showAirlineLogos', showAirlineLogos.toString());
    setCookie('showOtherAirport', showOtherAirport.toString());
    setCookie('showDelays', showDelays.toString());
    // setCookie('showOperatorAirlines', showOperatorAirlines.toString());
    setCookie('flightMarker', flightMarker);
    setCookie('flightMarkerScale', flightMarkerScale);
    setCookie('airportMarker', airportMarker);
    setCookie('airportMarkerScale', airportMarkerScale);
    setCookie('arrDep', arrDep);
    setCookie('showLegend', showLegend.toString());
    setCookie('weatherFrames', weatherFrames);
    setCookie('weatherStation', weatherStation);
    setCookie('weatherRadar', weatherRadar);
    setCookie('weatherOpacity', weatherOpacity);
    setCookie('logo', encodeURI(logo));
    setCookie('airlines', airlines);
    // setCookie('interactive', interactive.toString());
    // setCookie('view', view);

    $('#configurl').width($('#config table').width()).
      text(window.location.href.replace(/\?.*$/, '')+'?'+
        document.cookie.replace(/(?:;|^)\s*(?:_|helpSession)[^;]+/g, ''). // google analytics
        replace(/^;\s*/, '').replace(/;\s*/g, '&'));
  }

  var allAirlines, exceptions;  // processed airline list

  function parseAirlineList() {
    allAirlines = true; // show all airlines
    exceptions = {};  // exception airlines
    var al = airlines;
    if (al.length > 0) {
      if (al.charAt(0) !== '-') {
        allAirlines = false;
      } else {
        al = airlines.slice(1);
      }
      if (al.length > 0) {
        $.each(al.split(','), function(k, v) {
          if (v.match(/^\w{2,3}(-\w{2,3})?/) !== null) {
            var el = v.split('-');
            exceptions[el[0]] = el.length === 1 ? null : el[1];
          } else {
            alert('invalid airlines parameter: '+airlines);
            return false;
          }
        });
      }
    } else {
      allAirlines = false;  // show nothing
    }
  }

  var view = null; // 2D or 3D
  var interactive = false; // set true to allow map scrolling
  // var thumb = false; // show as thumbnail
  var jump = false; // no animation of planes or labels
  var flip = false; // flip through different cities
  var flipTime = 60; // seconds between flips
  var flipLength = flipairports.length;

  setDefaults(); // create variables
  getParams('?'+document.cookie); // params from cookies
  getParams(window.location.href); // params from URL override

  if (appId.length === 0 || appKey.length === 0) {
    appId = default_appId;
    appKey = default_appKey;
    setTimeout(function() {
      appId = '';
      appKey = '';
      alert('app timeout, valid appId and appKey required');
    }, 900000);
  } else if (appId === default_appId && appKey === default_appKey) {
      appId = '';
      appKey = '';
      alert('invalid appId and appKey');
  }

  parseAirlineList();

  if (flightMarker.match(/[^\w-]/)) { flightMarker = 'smooth'; }
  if (airportMarker.match(/[^\w-]/)) { airportMarker = 'classic'; }
  if (view === '3D') { interactive = true; }
  if (jump) { showLabels = false; }

  
  var map; // Leaflet map object
  var bounds;  // only draw planes inside this boundary
  var airportLoc; // lat/lng position of airport
  var airport; // the airport object
  var resetAirport = false; // airport location needs to be moved
  var wlayer; // weather layer
  var actualStation = false;
  var originalZoom = zoomLevel;
  var actualMapType = null;
  var USbounds = L.latLngBounds([24,-127], [49,-66.5]); // continental US
  // new L.LatLngBounds(new L.LatLng(24, -127), new L.LatLng(49, -66.5)); // US

  var planes = []; // all planes
  var astamp = 0; // time stamp for arrivals
  var dstamp = 0; // time stamp for departures
  var showplanes = 0; // number of planes showing
  var transform_prop;
  // var debug = {};
  var avgerr = 0, avgcnt = 0, maxerr = 0;  // DEBUG
  var currentflip = 0;

  function moveLabels() {
    for (var i = 0; i < planes.length; i++) {
      planes[i].physics(planes, i);
    }
  }

  function displayActualStation() {
    $('#actualStation').text(weatherFrames <= 0 ? '' :
      (weatherStation === 'automatic' ? actualStation+' - ' : '')+city(actualStation));
  }


  $(document).ready(function() {

    if (appId === default_appId && appKey === default_appKey) {
      $('#demo').delay(2000).fadeOut(3000).hide(1);
    } else {
      $('#demo').hide();
    }
    
    transform_prop = testStyleProperty('transform'); // test for transform CSS property
    if (view === '3D') {
      // $('#map_div, #overlay_div').addClass('three');
      $('#map_div').addClass('three');
    }
    $('#map_div').height($(window).height() - (showLegend ? $('#brand').height() : 0));
    $(window).resize(recenter);
    $('#brand').click(configurator);
    if (!showLegend) { $('#brand').hide(); }
    if (fslogo) {
      $('#fsimg').css('visibility', 'visible');
      $('#legend').css('left', '215px');
    } else if (logo) {
      $('#logotxt').text(logo);
      $('#legend').css('left', (30 + $('#logotxt').width())+'px');
    }
    if (!showDelays) {
      $('#delayed').hide();
      $('#legend').css('right', '10px');

    }

    map = L.map('map_div', { // create map
      dragging: interactive,
      touchZoom: false,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: interactive,
      zoomAnimation: false,
      keyboard: false
    }).on('load', mapReady);
        
    var basemaps = {};
    $.each(tilesinfo, function(k, v) {
      var layer = L.tileLayer(v.url,
        { maxZoom: v.maxZoom ? v.maxZoom : 18, minZoom: v.minZoom ? v.minZoom : 0,
          attribution: v.attribution, subdomains: v.subdomains ? v.subdomains : ''});
      basemaps[v.name] = layer;
    });
        
    if (!transform_prop) {
      var mapsize = map.getSize();
      var $overlay = $('.leaflet-overlay-pane'); // $('#overlay_div');
      /* jshint newcap:false */
      Plane.paper = Raphael($overlay[0], mapsize.x, mapsize.y);
      /* jshint newcap:true */
      $overlay.find('svg, div').css({position: 'absolute', 'z-index': 30, clip: '', left: 0, top: 0});
      // Plane.paper.path('M0,0L'+line.width()+','+line.height());
    }

    if (flip || showLabels==='delay') {
      $('#legend').empty().css({'font-size': '36px', 'text-align': 'center'});
      if (flip==='US') { flipLength = 24; }
      if (flip) {
        setInterval(doflip, flipTime * 1000);
        airportCode = flipairports[0].ac;
      }
      $('#legend').text(airportCode + (flip ? ' - ' + flipairports[0].loc :
          ' Delayed ' + (arrDep==='arr' ? 'Arrivals' : 'Departures')));
    }

    function doflip() {
      if (++currentflip >= flipLength) { currentflip = 0; }
      map.removeLayer(basemaps[tilesinfo[actualMapType].name]);
      airportCode = flipairports[currentflip].ac;
      $('#airportCode').val(airportCode);
      $('#legend').text(airportCode + ' - ' + flipairports[currentflip].loc);
      airportLoc = null; // reset location
      resetAirport = true;
      for (var i = 0; i < planes.length; i++) {
        planes[i].remove();
      }
      planes = [];
      mainloop();
    }

    
    mainloop();

    function mainloop() { // get position info for airplanes
      if (appId.length === 0 || appKey.length === 0) { return; }
      if (arrDep !== 'arr') { // dep or both
        $.ajax({
          url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/airport/tracks/' + airportCode + '/dep',
          data: { maxPositions: 2, appId: appId, appKey: appKey, includeFlightPlan: false },
          dataType: 'jsonp',
          success: getDepartures,
          // timeout: 20000, // catch timeout after 20 seconds
          error: badajax
        });
      }
      if (arrDep !== 'dep') { // arr or both
        $.ajax({
          url: 'https://api.flightstats.com/flex/flightstatus/rest/v2/jsonp/airport/tracks/' + airportCode + '/arr',
          data: { maxPositions: 2, appId: appId, appKey: appKey, includeFlightPlan: false },
          dataType: 'jsonp',
          success: getArrivals,
          // timeout: 20000, // catch timeout after 20 seconds
          error: badajax
        });
      }
    } // end mainloop()

    function badajax(jqXHR, textStatus, errorThrown) {
      clearInterval(maintimer);
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

    function getDepartures(data /* , status, xhr */) {
      if (!data || data.error) {
        if (data && data.error && data.error.errorCode === 'AUTH_FAILURE') {
          alert('Invalid or Expired AppId and AppKey');
          clearInterval(maintimer);
        }
        if (console && console.log) {
          console.log('departures error', data ? data : ' - no response');
        } else {
          if (data.error) { alert(data.error.errorMessage); }
        }
        return;
      }
      if (arrDep === 'arr') { return; }
      var airports = getAppendix(data.appendix.airports);
      var carriers = getAppendix(data.appendix.airlines);
      var ap = airports[data.request.airport.fsCode]; // home airport
      if (!airportLoc || resetAirport) {
        setAirportLoc(ap); // set location of airport
      }

      var tracks = data.flightTracks;
      if (showLegend && !flip && showLabels !== 'delay') { $('#takeoff').html(''); }
      if (bounds) {
        // avgerr = 0; avgcnt = 0, maxerr = 0; // DEBUG
        $.each(tracks, function(key, v) {
          var alex = exceptions[v.carrierFsCode];
          // if (alex === null ? allAirlines : !allAirlines) { // XOR
          if (allAirlines ? alex === null : alex === undefined) {
            return; // do not display flight
          }
          if (alex === null || alex === undefined) { alex = v.carrierFsCode; }
          var alname = carriers[carriers[alex] ? alex : v.carrierFsCode].name;

          var positions = v.positions;
          var curpos = positions[0];
          var pos = L.latLng(+curpos.lat, +curpos.lon);
          // console.log(curpos.date, (new Date(curpos.date)).valueOf(), Date.parse(curpos.date));
          var lastpos, p, a, t;
          if (positions.length >= 2) {
            lastpos = positions[1];
            p = L.latLng(+lastpos.lat, +lastpos.lon);
            a = +lastpos.altitudeFt;
            t = Date.parse(lastpos.date); // timestamp
          }
          var fx = findf(+v.flightId); // index of this flight in planes
          if (bounds.contains(pos) && (!p || bounds.contains(p))) {
            // if (!curpos.altitudeFt && console.log) {
            //   console.log('missing flight altitude for '+v.carrierFsCode+' '+v.flightNumber+
            //     ', using airport altitude: '+ap.elevationFeet+', speed: '+curpos.speedMph);
            // }
            var airportalt = +ap.elevationFeet;
            var alt = curpos.altitudeFt ? curpos.altitudeFt : airportalt;
            var ts = Date.parse(curpos.date); // timestamp
            var delay = +(v.delayMinutes || 0);
            var flight = alex + ' ' + v.flightNumber;
            if (fx !== null) { // plane found, update position
              // if (p && (Math.abs(pos.lat - p.lat) > 0.5 || Math.abs(pos.lng - p.lng) > 0.5)) {
              //   if (!debug[flight] || (debug[flight] && positions[0].date !== debug[flight])) {
              //     console.log('JUMP: ', flight, v.departureAirportFsCode+'->'+v.arrivalAirportFsCode,
              //       lastpos.date, '('+p.lat.toFixed(3)+','+p.lng.toFixed(3)+')', lastpos.altitudeFt+'ft', lastpos.speedMph+'mph');                  
              //   }
              //   debug[flight] = positions[0].date;
              // }
              // if (debug[flight]) {
              //   console.log(curpos.date === debug[flight] ? '-' : '+', flight, curpos.date,
              //     '('+pos.lat.toFixed(3)+','+pos.lng.toFixed(3)+')', 
              //     curpos.source, curpos.altitudeFt+'ft', curpos.speedMph+'mph', v.heading.toFixed(3)+'deg');
              // }
              planes[fx].update({ position: pos, altitude: alt, stamp: dstamp, delay: delay, fno: flight, time: ts });
            } else { // add flight
              var oairport = v.arrivalAirportFsCode;
              var ocity = airports[oairport].city;
              showplanes++;
              if (dstamp>0) { // new departing flight (taking off)
                var takeoff = airportLoc.distanceTo(pos);
                // if (takeoff > 1000) { // DEBUG
                //   console.log('takeoff: '+flight, takeoff.toFixed(0)+'m', pos.toString());
                // }
                if (showLegend && !flip && takeoff < 3000 && showLabels !== 'delay') {
                  var th = $('#takeoff').html();
                  if (th !== null) {
                    $('#takeoff').html(th+(th.length>0?', ':' ')+'<span style="white-space:nowrap">'+flight+'&raquo;'+ocity+'</span>');
                  }
                }
                if (p && (Math.abs(pos.lat - p.lat) > 0.5 || Math.abs(pos.lng - p.lng) > 0.5)) {
                  // console.log(flight+' distance in meters: '+pos.distanceTo(p));
                  p = undefined; a = undefined; t = undefined;
                }
                if (alt > 5000) { alt = airportalt; } // fix data error
                if (a && a > 5000) { a = airportalt; }
              }
              var np = new Plane({ id: +v.flightId, fno: flight, airline: alname,
                  airport: oairport, city: ocity, position: (p ? p : pos), altitude: (a ? a : alt),
                  heading: (v.heading ? +v.heading : +v.bearing),
                  delay: delay, scale: flightMarkerScale * 0.01, depart: true, stamp: dstamp, time: (t ? t : ts) });
              planes.push(np);
              map.addLayer(np);
              if (p) { np.update({ position: pos, altitude: alt, stamp: dstamp, delay: delay, fno: flight, time: ts }); }
            }
          } else { // not in bounds
            if (fx !== null) { // remove offscreen flight
              showplanes--;
              planes[fx].remove();
              planes.splice(fx, 1); // remove from planes
            }
          }
        });
      }
              
      // remove airplanes in planes array that are not in data.flightTracks
      for (var i = 0; i < planes.length; i++) {
        var h = planes[i];
        if (h.isDep() && h.stamp() !== dstamp) {
          showplanes--;
          h.remove();
          planes.splice(i, 1); // remove from planes
        }
      }
      dstamp = (dstamp % 1000000) + 1; // update index
      // if (avgcnt > 0) console.log('departures error: '+(avgerr / avgcnt)+' max: '+maxerr);

    } // end getDepartures

    function getArrivals(data /* , status, xhr */) {
      if (!data || data.error) {
        if (data && data.error && data.error.errorCode === 'AUTH_FAILURE') {
          alert('Invalid or Expired AppId and AppKey');
          clearInterval(maintimer);
        }
        if (console && console.log) {
          console.log('arrivals error', data ? data : ' - no response');
        } else {
          if (data.error) { alert(data.error.errorMessage); }
        }
        return;
      }
      if (arrDep === 'dep') { return; }
      var airports = getAppendix(data.appendix.airports);
      var carriers = getAppendix(data.appendix.airlines);
      var ap = airports[data.request.airport.fsCode]; // home airport
      if (!airportLoc || resetAirport) {
        setAirportLoc(ap); // set location of airport
      }
      var tracks = data.flightTracks;
      if (showLegend && !flip && showLabels !== 'delay') { $('#landing').html(''); }
      if (bounds) {
        // avgerr = 0; avgcnt = 0, maxerr = 0; // DEBUG
        $.each(tracks, function(key, v) {
          var alex = exceptions[v.carrierFsCode];
          if (allAirlines ? alex === null : alex === undefined) {
            return; // do not display flight
          }
          if (alex === null || alex === undefined) { alex = v.carrierFsCode; }
          var alname = carriers[carriers[alex] ? alex : v.carrierFsCode].name;

          var positions = v.positions;
          var curpos = positions[0];
          var pos = L.latLng(+curpos.lat, +curpos.lon);
          var lastpos, p, a, t;
          if (positions.length >= 2) {
            lastpos = positions[1];
            p = L.latLng(+lastpos.lat, +lastpos.lon);
            a = +lastpos.altitudeFt;
            t = Date.parse(lastpos.date); // timestamp
          }
          var fx = findf(+v.flightId); // index of this flight in planes
          if (bounds.contains(pos) && (!p || bounds.contains(p))) {
            // if (!curpos.altitudeFt && console.log) {
            //   console.log('missing flight altitude for '+v.carrierFsCode+' '+v.flightNumber+
            //     ', using airport altitude: '+ap.elevationFeet+', speed: '+curpos.speedMph);
            // }
            var alt = curpos.altitudeFt ? curpos.altitudeFt : +ap.elevationFeet;
            var ts = Date.parse(curpos.date); // timestamp
            var delay = +(v.delayMinutes || 0);
            var flight = alex + ' ' + v.flightNumber;
            if (fx !== null) { // plane found, update position
              // if (p && (Math.abs(pos.lat - p.lat) > 0.5 || Math.abs(pos.lng - p.lng) > 0.5)) {
              //   if (!debug[flight] || (debug[flight] && positions[0].date !== debug[flight])) {
              //     console.log('JUMP: ', flight, v.departureAirportFsCode+'->'+v.arrivalAirportFsCode,
              //       lastpos.date, '('+p.lat.toFixed(3)+','+p.lng.toFixed(3)+')', lastpos.altitudeFt+'ft', lastpos.speedMph+'mph');                  
              //     // console.log('JUMP: ', flight, p.lat, p.lng, planes[fx].stamp(), dstamp);                  
              //   }
              //   debug[flight] = positions[0].date;
              // }
              // if (debug[flight]) {
              //   console.log(curpos.date === debug[flight] ? '-' : '+', flight, curpos.date,
              //     '('+pos.lat.toFixed(3)+','+pos.lng.toFixed(3)+')', 
              //     curpos.source, curpos.altitudeFt+'ft', curpos.speedMph+'mph', v.heading.toFixed(3)+'deg');
              //   // console.log(curpos.date === debug[flight] ? '-' : '+', flight, curpos.date, curpos.lat, curpos.lon, curpos.source, curpos.altitudeFt, curpos.speedMph, v.heading);
              // }
              planes[fx].update({ position: pos, altitude: alt, stamp: astamp, delay: delay, fno: flight, time: ts });
            } else { // add flight
              var oairport = v.departureAirportFsCode;
              var ocity = airports[oairport].city;
              showplanes++;
              if (positions.length >= 2) {
                lastpos = positions[1];
                p = L.latLng(+lastpos.lat, +lastpos.lon);
                a = +lastpos.altitudeFt;
              }
              if (p && (Math.abs(pos.lat - p.lat) > 0.5 || Math.abs(pos.lng - p.lng) > 0.5)) {
                // console.log(flight+' distance in meters: '+pos.distanceTo(p));
                p = undefined; a = undefined; t = undefined;
              }
              var np = new Plane({ id: +v.flightId, fno: flight, airline: alname,
                  airport: oairport, city: ocity, position: (p ? p : pos), altitude: (a ? a : alt),
                  heading: (v.heading ? +v.heading : +v.bearing),
                  delay: delay, scale: flightMarkerScale * 0.01, depart: false, stamp: astamp, time: (t ? t : ts) });
              planes.push(np);
              map.addLayer(np);
              if (p) { np.update({ position: pos, altitude: alt, stamp: astamp, delay: delay, fno: flight, time: ts }); }
            }
          } else { // not in bounds
            if (fx !== null) { // remove offscreen flight
              showplanes--;
              planes[fx].remove();
              planes.splice(fx, 1); // remove from planes
            }
          }
        });
      }
              
      // remove airplanes in planes array that are not in data.flightTracks
      for (var i = 0; i < planes.length; i++) {
        var h = planes[i];
        if (!h.isDep() && h.stamp() !== astamp) {
          var touchdown = airportLoc.distanceTo(map.layerPointToLatLng(h.getXY()));
          // if (touchdown > 1000) { // DEBUG
          //   console.log('landing: '+h.flight(), touchdown.toFixed(0)+'m', map.layerPointToLatLng(h.getXY()).toString());
          // }
          showplanes--;
          if (showLegend && !flip && touchdown < 5000 && showLabels !== 'delay') {
            var t = $('#landing').html();
            // console.log('landing', t, typeof t);
            if (t !== null) {
              $('#landing').html(t+(t.length>0?', ':' ')+'<span style="white-space:nowrap">'+h.flight()+'&laquo;'+h.city()+'</span>');
            }
          }
          h.remove();
          planes.splice(i, 1); // remove from planes
        }
      }
      astamp = (astamp % 1000000) + 1; // update index
      // if (avgcnt > 0) console.log('arrivals error: '+(avgerr / avgcnt)+' max: '+maxerr);

    } // end getArrivals
      

    function setAirportLoc(dairport) {
      if (dairport === undefined) {
        alert('Unknown airport code: '+airportCode);
        return;
      }
      airportLoc = L.latLng(+dairport.latitude, +dairport.longitude);
      if (resetAirport && airport) {
        airport.setPosition(airportLoc);
        resetAirport = false;
      }

      map.setView(airportLoc, zoomLevel);
      recenter();

      WeatherImage.setlayer();

      if (mapType !== 'automatic' && !tilesinfo[mapType]) {
        alert('invalid mapType: '+mapType);
        mapType = 'automatic';
      }
      actualMapType =  mapType === 'automatic' ? // terrain is US only, use mapboxterrain map outside US
        (USbounds.contains(airportLoc) ? 'usterrain' : 'terrain') : mapType;
      if (zoomLevel > tilesinfo[actualMapType].maxZoom) {
        var maxz = tilesinfo[actualMapType].maxZoom;
        alert('maximum zoom for '+actualMapType+' mapType is '+maxz);
        zoomLevel = maxz;
      } else if (zoomLevel < tilesinfo[actualMapType].minZoom) {
        var minz = tilesinfo[actualMapType].minZoom;
        alert('minimum zoom for '+actualMapType+' mapType is '+minz);
        zoomLevel = minz;
      }
      
      map.addLayer(basemaps[tilesinfo[actualMapType].name], true);
      $('#dattribution').html(tilesinfo[actualMapType].attribution);

    }
    
    function mapReady() {
      setbounds();
      airport = new Airport(airportLoc, airportMarker, airportMarkerScale/100);
      map.addLayer(airport);

      WeatherImage.setlayer(); // add weather layer
     
      maintimer = setInterval(mainloop, updateRate);
    
      function moveplane() {
        for (var i = 0; i < planes.length; i++) {
          planes[i].move();
        }
      }
      if (!jump) { setInterval(moveplane, 60000 / frameMin); }
      
      if (showLabels) { physicstimer = setInterval(moveLabels, 1000 * physicsFrame); }

      if (interactive) {
        $(document).keydown(function(e) {
          switch(e.which) {
          case 37: // left arrow
            map.panBy([100, 0]);
            break;
          case 38: // up arrow   
            map.panBy([0, 100]);
            break;
          case 39: // right arrow
            map.panBy([-100, 0]);
            break;
          case 40: // down arrow
            map.panBy([0, -100]);
            break;
          case 13: // return
            map.setZoom(originalZoom);
            /* falls through */
          case 32: // space
            map.panTo(airportLoc);
            break;
          case 187: // + or =
            map.setZoom(++zoomLevel);
            break;
          case 189: // - or _
            map.setZoom(--zoomLevel);
            break;
          case 67: // C (configurator)
            configurator(e);
            break;
          case 70: // F (fullscreen)
            if (BigScreen.enabled) {
              BigScreen.toggle();
            }
            break;
          case 78: // N (next airport)
            if (flip) { doflip(); }
          }
        });
      } else { // not interactive, hide cursor on map when full screen
        BigScreen.onenter = function() { $('#map_div').css('cursor', 'none'); };
        BigScreen.onexit = function() { $('#map_div').css('cursor', ''); };
      }

      if (!map.hasEventListeners('zoomend')) { map.on({zoomend: recenter, moveend: recenter}); }

    } // end mapready()
    
    function recenter() {
      $('#map_div').height($(window).height() - (showLegend ? $('#brand').height() : 0));
      setbounds();
      mainloop();
      var newz = map.getZoom();
      if (newz !== zoomLevel) {
        zoomLevel = newz;
        for (var i = 0; i < planes.length; i++) {
          planes[i].mapchanged();
        }
      }
      // $('#overlay_div').css('-webkit-transform', $('.leaflet-map-pane').css('-webkit-transform'));
      // console.log($('#overlay_div').css('-webkit-transform'));
    } // end recenter()
    
    function setbounds() {
      bounds = map.getBounds().pad(0.2); // enlarge bounds by 20% in each direction
    }
    
    function findf(id) { // find flight id in planes array
      for (var i = 0; i < planes.length; i++) {
        if (planes[i].id() === id) { return i; }
      }
      return null;
    }

    // configuration dialog ----------------------------------------------
    $('#flightMarkerScale, #airportMarkerScale, #weatherOpacity').rangeinput({
      speed: 100, keyboard: false
    }).bind('onSlide', function(e) {
      $('#configurl').text('');
      var $el = $(e.delegateTarget);
      switch($el.attr('id')) {
       case 'flightMarkerScale':
        flightMarkerScale = +$el.val();
        for (var i = 0; i < planes.length; i++) {
          planes[i].setFlightMarkerScale(flightMarkerScale/100);
        }
        break;
       case 'airportMarkerScale':
        airportMarkerScale = +$el.val();
        airport.setAirportMarkerScale(airportMarkerScale/100);
        break;
       case 'weatherOpacity':
        weatherOpacity = +$el.val();
        if (wlayer) { wlayer.setOpacity(weatherOpacity/100); }
        break;
      }
    });

    function fillDialog() {
      if (!BigScreen.enabled) { $('#cbutton input[value="Full"]').hide(); }
      $('#airportCode').val(airportCode);
      $('#mapType').val(mapType);
      $('#zoomLevel').val(zoomLevel);
      $('#showLabels').val(showLabels.toString());
      $('#labelSize').val(labelSize);
      $('#showAirlineLogos').val(showAirlineLogos.toString());
      $('#showOtherAirport').val(showOtherAirport.toString());
      $('#showDelays').val(showDelays.toString());
      $('#flightMarker').val(flightMarker);
      $('#flightMarkerScale').val(flightMarkerScale);
      $('#airportMarker').val(airportMarker);
      $('#airportMarkerScale').val(airportMarkerScale);
      $('#arrDep').val(arrDep);
      $('#showLegend').val(showLegend.toString());
      // $('#showOperatorAirlines').val(showOperatorAirlines.toString());
      $('#weatherStation').val(weatherStation);
      displayActualStation();
      $('#weatherRadar').val(weatherRadar);
      $('#weatherFrames').val(weatherFrames);
      $('#weatherOpacity').val(weatherOpacity);
      $('#logo').val(logo ? logo : '');
      $('#airlines').val(airlines);
    }

    function configurator() {
      if ($('#config:visible').length === 0) {
        if (+($config.css('left').slice(0,-2)) > $(document).width()-100 || +($config.css('bottom').slice(0,-2)) < -300) {
          $config.animate({left: 12, bottom: 46}, {queue: false});
        }
        $config.slideDown(); // reveal
        fillDialog();
      } else {
        $config.slideUp(); // hide
      }
    }

    var $body = $(document);
    var $config = $('#config');

    // drag configurator
    $('#ctitle', $config).mousedown(function(e) {
      var pageX = e.pageX, pageY = e.pageY;
      var posl = +($config.css('left').slice(0,-2));
      var posb = +($config.css('bottom').slice(0,-2));
      var movefun = function(e) {
        $config.css({
          left: posl + (e.pageX - pageX),
          bottom:  posb - (e.pageY - pageY)
        });
        return false;
      };
      $body.mousemove(movefun);
      var upfun = function() {
        $body.unbind('mousemove', movefun).unbind('mouseup', upfun);
      };
      $body.mouseup(upfun);
      return false;
    });

    $('#config td :button.bool').click(function(e) {
      var $el = $(e.target);
      $el.val(function(i, v) {
        return (v==='true') ? 'false' : 'true';
      });
      $el.change();
    });

    $('#cbutton input').click(function(e) { // buttons
      var $el = $(e.target);
      switch($el.val()) {
       case 'Hide':
        $('#config').slideUp();
        break;
       case 'Save':
        saveCookies();
        // $('#config').slideUp();
        break;
       case 'Reset':
        setDefaults();
        saveCookies();
        window.location.reload(); // reload page
        break;
       case 'Help':
        window.open('help.html', '_blank');
        break;
       case 'Full':
        BigScreen.toggle();
        $('#config').hide();
      }
    });

    $('#inczoom, #deczoom').click(function(e) {
      $('#configurl').text('');
      var tinfo = tilesinfo[actualMapType];
      var newz = zoomLevel;
      if ($(e.target).attr('id') === 'inczoom') {
        newz++;
        if (tinfo.maxZoom < newz) {
          newz = tinfo.maxZoom;
        }
      } else { // deczoom
        newz--;
        if (tinfo.minZoom > newz) {
          newz = tinfo.minZoom;
        }
      }
      map.setZoom(+newz);
      $('#zoomLevel').val(newz);
      zoomLevel = newz;
    });

    // input change
    $('#config :input').change(function(e) {
      var tinfo, v, i, newz, $el = $(e.delegateTarget);
      $('#configurl').text('');
      switch($el.attr('id')) {
       case 'airportCode':
        v = $el.val().toUpperCase();
        if ($.trim(v).length > 0 && v !== airportCode) {
          map.removeLayer(basemaps[tilesinfo[actualMapType].name]);
          airportCode = v;
          $('#airportCode').val(airportCode);
          airportLoc = null; // reset location
          resetAirport = true;
          for (i = 0; i < planes.length; i++) {
            planes[i].remove();
          }
          planes = [];
          mainloop();
        }
        break;
       case 'mapType':
        map.removeLayer(basemaps[tilesinfo[actualMapType].name]);
        mapType = $el.val();
        actualMapType = mapType === 'automatic' ? (USbounds.contains(airportLoc) ? 'usterrain' : 'terrain') : mapType;
        tinfo = tilesinfo[actualMapType];
        $('#dattribution').html(tinfo.attribution);
        newz = zoomLevel;
        if (tinfo.minZoom > newz) {
          newz = tinfo.minZoom;
          map.setZoom(+newz);
          $('#zoomLevel').val(newz);
          zoomLevel = newz;
        } else if (tinfo.maxZoom < newz) {
          newz = tinfo.maxZoom;
          map.setZoom(+newz);
          $('#zoomLevel').val(newz);
          zoomLevel = newz;
        }
        map.addLayer(basemaps[tinfo.name]);
        break;
       case 'zoomLevel':
        v = $('#zoomLevel').val();
        if ($.isNumeric(v)) {
          newz = +v;
          tinfo = tilesinfo[actualMapType];
          if (tinfo.minZoom > newz) {
            newz = tinfo.minZoom;
          } else if (tinfo.maxZoom < newz) {
            newz = tinfo.maxZoom;
          }
          map.setZoom(+newz);
          $('#zoomLevel').val(newz);
          zoomLevel = newz;
        } else {
          alert('bad value: '+v);
          $('#zoomLevel').val(zoomLevel);
        }
        break;
       case 'showLabels':
        v = $el.val() === 'true';
        for (i = 0; i < planes.length; i++) {
          planes[i].showLabel(v);
        }
        showLabels = v;
        if (showLabels) {
          physicstimer = setInterval(moveLabels, 1000 * physicsFrame);
        } else {
          clearInterval(physicstimer);
        }
        break;
       case 'labelSize':
        v = +$el.val();
        if (labelmargin[v]) {
          labelSize = v;
          for (i = 0; i < planes.length; i++) {
            planes[i].showLabel(false); // remove label
            planes[i].showLabel(true); // add label
          }
        }
        break;
       case 'showAirlineLogos':
        v = $el.val() === 'true';
        for (i = 0; i < planes.length; i++) {
          planes[i].setAirlineLogo(v);
        }
        showAirlineLogos = v;
        break;
       // case 'showOperatorAirlines':
       //  showOperatorAirlines = $el.val();
       //  mainloop();
       //  break;
       case 'showOtherAirport':
        v = $el.val() === 'true';
        for (i = 0; i < planes.length; i++) {
          planes[i].setOtherAirport(v);
        }
        showOtherAirport = v;
        break;
       case 'showDelays':
        v = $el.val() === 'true';
        if (v) {
          $('#delayed').show();
          $('#legend').css('right', '150px');
        } else {
          $('#delayed').hide();
          $('#legend').css('right', '10px');
        }
        for (i = 0; i < planes.length; i++) {
          planes[i].setDelay(v);
        }
        showDelays = v;
        break;
       case 'flightMarker':
        v = $el.val();
        for (i = 0; i < planes.length; i++) {
          planes[i].setFlightMarker(v);
        }
        flightMarker = v;
        break;
       case 'flightMarkerScale':
        v = $el.val();
        if ($.isNumeric(v)) {
          flightMarkerScale = +v;
          for (i = 0; i < planes.length; i++) {
            planes[i].setFlightMarkerScale(flightMarkerScale * 0.01);
          }
        } else {
          alert('bad value: '+v);
          $('#flightMarkerScale').val(flightMarkerScale);
        }
        break;
       case 'airportMarker':
        v = $el.val();
        airport.setAirportMarker(v);
        airportMarker = v;
        break;
       case 'airportMarkerScale':
        v = $el.val();
        if ($.isNumeric(v)) {
          airportMarkerScale = +v;
          airport.setAirportMarkerScale(airportMarkerScale * 0.01);
        } else {
          alert('bad value: '+v);
          $('#airportMarkerScale').val(airportMarkerScale);
        }
        break;
       case 'arrDep':
        arrDep = $el.val();
        for (i = 0; i < planes.length; i++) {
          planes[i].remove();
        }
        planes = [];
        mainloop();
        break;
       case 'showLegend':
        v = $el.val() === 'true';
        if (v) {
          $('#brand').show();
        } else {
          $('#brand').hide();
        }
        showLegend = v;
        recenter();
        break;
       case 'weatherFrames':
        v = $el.val();
        if ($.isNumeric(v) && +v >= 0 && +v <= 25) {
          weatherFrames = +v;
        } else {
          if ($.trim(v).length === 0) {
            weatherFrames = 0;
          } else {
            alert('bad value: '+v);
          }
          $('#weatherFrames').val(weatherFrames);
        }
        WeatherImage.setlayer();
        displayActualStation();
        break;
       case 'weatherStation':
        v = $el.val();
        if ($.trim(v).length === 0 || v === 'automatic') {
          weatherStation = 'automatic';
        } else {
          weatherStation = v.toUpperCase();
        }
        $('#weatherStation').val(weatherStation);
        WeatherImage.setlayer();
        displayActualStation();
        break;
       case 'weatherRadar':
        weatherRadar = $el.val();
        WeatherImage.setlayer();
        break;
       case 'weatherOpacity':
        v = $el.val();
        if ($.isNumeric(v) && +v >= 0 && +v <= 100) {
          weatherOpacity = +v;
          if (wlayer) { wlayer.setOpacity(weatherOpacity/100); }
        } else {
          alert('bad value: '+v);
          $('#weatherOpacity').val(weatherOpacity);
        }
        break;
       case 'logo':
        v = $el.val();
        logo = $.trim(v);
        $('#logotxt').text(logo);
        $('#legend').css('left', (30 + $('#logotxt').width())+'px');
        break;
       case 'airlines':
        airlines = $el.val();
        parseAirlineList();
        for (i = 0; i < planes.length; i++) {
          planes[i].remove();
        }
        planes = [];
        mainloop();
        break;
      }
    });  // end configurator input change

  });  // end document ready
  
  // image of airport (control tower) ----------------------------------------------------
  var Airport = L.Class.extend({
    initialize: function(pos, name, scale) {
      this.pos_ = pos; // lat/lng position
      // this.url_ = 'http://dem5xqcn61lj8.cloudfront.net/Signage/AirportTracker/tower/'+name+'.png'; // image url
      this.url_ = 'img/tower/'+name+'.png'; // image url
      this.scale_ = scale; // 0->1.0
    },
    onAdd: function(map) {
      if (this.image_) { return; }
      this.map_ = map;
      this.image_ = $('<img>', { src: this.url_, css: { border: 'none', position: 'absolute' }});
      map.getPanes().overlayPane.appendChild(this.image_[0]);
      // $('#overlay_div').append(this.image_);
      map.on('viewreset', this.draw_, this);
      this.draw_();
    },
    draw_: function() {
      var pixpos = this.map_.latLngToLayerPoint(this.pos_); // convert position to pixels
      var sx = Math.round(this.scale_ * 156); // 156 is width of airport image
      var sy = Math.round(this.scale_ * 290); // 290 is height of airport image
      this.image_.css({
        left: Math.round(pixpos.x - (this.scale_*25))+'px', // 25 is x offset of anchor point
        top: Math.round(pixpos.y - (this.scale_*180))+'px', // 180 is y offset of anchor point
        width: sx+'px', height: sy+'px'
        });
    },
    onRemove: function(map) {
      map.getPanes().overlayPane.removeChild(this.image_[0]);
      // this.image_.remove();
      this.image_ = null;
      map.off('viewreset', this.draw_, this);
    },
    setAirportMarkerScale: function(n) {
      this.scale_ = n;
      this.draw_();
    },
    setAirportMarker: function(name) {
      // this.url_ = 'http://dem5xqcn61lj8.cloudfront.net/Signage/AirportTracker/tower/'+name+'.png';
      this.url_ = 'img/tower/'+name+'.png'; // image url
      this.image_.attr('src', this.url_);
    },
    setPosition: function(p) {
      this.pos_ = p;
      this.draw_();
    },
    getPosition: function() {
      return this.pos_;
    }
  });

  // weather radar overlay ---------------------------------------------------------------
  var WeatherImage = L.Class.extend({
    initialize: function(weatherStation, weatherRadar, weatherFrames, opacity) {
      this.station_ = weatherStation;
      this.radar_ = weatherRadar || 'NCR'; // N0R, N1P, NTP, N0V, N0S, NCR, (N0Z)
      this.nframes_ = weatherFrames;
      this.opacity_ = opacity===undefined ? 0.3 : opacity;
      var bb = bBox(this.station_, this.radar_);
      this.bounds_ = L.latLngBounds([bb.y1, bb.x1], [bb.y0, bb.x0]);
          // new L.LatLng(bb.y1, bb.x1), // sw
          // new L.LatLng(bb.y0, bb.x0)); // ne
      this.url_ = 'http://radar.weather.gov/ridge/RadarImg/'+weatherRadar+'/'+weatherStation+'_'+weatherRadar+'_0.gif';
    },
  
    onAdd: function(map) {
      this.map_ = map;
      var that = this;
      var nf = this.nframes_;
      if (!this.div_) {
        this.div_ = $('<div>', { css: { position: 'absolute' } });
      }
      if (nf === 1) { // single image
        var $img = $('<img>', { src: this.url_,
          css: { position: 'absolute', width: '100%', height: '100%', opacity: this.opacity_ }
          }).appendTo(this.div_);
        this.timer_ = setInterval(function() {
          $img.attr('src', that.url_+'?nocache='+(new Date()).getTime());
        }, 120000); // update image every 2 minutes
      } else { // animate multiple images
        var $images = [];
        for (var i = 0; i<nf; i++) {
          $images.push($('<img>', { src: this.url_,
              css: { position: 'absolute', width: '100%', height: '100%', opacity: 0, display: 'none' }
              }).appendTo(this.div_));
        }
        this.updateImages_();
        this.timer_ = setInterval(function() { // update images
          that.updateImages_();
        }, 120000); // every 2 minutes

        var curimg = nf;
        this.anitimer = setInterval(function() { // animation
          if (curimg < nf-1) { // fade out previous image
            $images[curimg].fadeTo(200, 0, function() { $(this).css('display', 'none'); });
          }
          if (curimg++ > nf+3) { // hold current image for 3 extra frames
            curimg = 0;
            $images[nf-1].fadeTo(200, 0, function() { $(this).css('display', 'none'); });
          }
          if (curimg < nf) { // fade in new image
            $images[curimg].css('display', 'block').fadeTo(200, that.opacity_);
          }
        }, 500);
        
      }
      map.getPanes().overlayPane.appendChild(this.div_[0]);
      // $('#overlay_div').append(this.div_);
      map.on('viewreset', this.draw_, this);
      this.draw_();
    },
    
    draw_: function() {
      var c1 = this.map_.latLngToLayerPoint(this.bounds_.getSouthWest());
      var c2 = this.map_.latLngToLayerPoint(this.bounds_.getNorthEast());
      this.div_.css({ width: Math.abs(c2.x - c1.x), height: Math.abs(c2.y - c1.y),
          left: Math.min(c2.x, c1.x), top: Math.min(c2.y, c1.y) });
    },
    
    onRemove: function() {
      clearInterval(this.timer_);
      if (this.anitimer) { clearInterval(this.anitimer); }
      map.getPanes().overlayPane.removeChild(this.div_[0]);
      // this.div_.remove();
      this.div_ = null;
      map.off('viewreset', this.draw_, this);
    },
      
    updateImages_: function() {
      var $div = this.div_;
      $.getJSON('http://zat.com/flightstats/NWS/JSON_generator.py?callback=?',
      // $.getJSON('http://www.srh.noaa.gov/ridge2/JSON_generator.php?callback=?',
      // $.getJSON('http://demo.flightstats-ops.com/NWS/JSON_generator.py?callback=?',
          { rid: this.station_, product: this.radar_, frames: this.nframes_, responseType: 'jsonp' },
          function(data) {
            var img = data.directory;
            var maximg = img.length-1;
            $div.find('img').each(function(i, el) {
              // $(el).attr('src', 'http://www.srh.noaa.gov/'+img[i]);
              $(el).attr('src', 'http://radar.weather.gov/'+img[Math.min(i,maximg)]);
          });
      });
    },

    setOpacity: function(opc) {
      this.opacity_ = opc;
      this.div_.find('img').css('opacity', opc);
    }
  });

  WeatherImage.setlayer = function() {
    if (wlayer) {
      map.removeLayer(wlayer);
      wlayer = undefined;
    }
    if (weatherFrames <= 0) { return; } // no weather image
    actualStation = weatherStation === 'automatic' ? bBox(null, weatherRadar, airportLoc.lat, airportLoc.lng) : weatherStation;
    if (actualStation && city(actualStation) !== undefined) { // http://www.srh.noaa.gov/jetstream/doppler/ridge_download.htm
      wlayer = new WeatherImage(actualStation, weatherRadar, weatherFrames, weatherOpacity/100);
      map.addLayer(wlayer);
      displayActualStation();
    }
  };

  // an airplane and its shadow, label, maybe tail --------------------------------------- 
  var Plane = L.Class.extend({
    initialize: function(args) {
      args = args || {};
      this.id_ = args.id; // flight id
      this.fno_ = args.fno; // e.g., 'DL 123'
      this.airline_ = args.airline; // e.g., 'Delta'
      this.llpos_ = args.position;  // desired position (LatLng)
      this.rot_ = +(args.heading || 0);  // heading (from server)
      this.alt_ = +(args.altitude || 0);  // altitude
      this.time_ = args.time || 0; // integer time stamp of position
      this.depart_ = args.depart; // Boolean, is this a departing flight
      this.scale_ = +args.scale; // scale factor of plane: 1.0 is full size
      this.stamp_ = args.stamp; // used to tell when to delete plane from map
      this.delay_ = args.delay; // flight delay in minutes
      this.airport_ = args.airport; // code of other airport
      this.city_ = args.city;  // name of other city
      
      this.move_ = 0; // number of times plane has moved (between updates)
      this.curpos_ = null; // current pixel position (Point)
      this.curalt_ = null; // current altitude
      this.currot_ = null; // current rotation (deg)
      this.turn_ = 0; // amount to turn
      this.vx_ = 0; // x velocity in pixels per frame
      this.vy_ = 0; // y
      this.vz_ = 0; // z (altitude) in feet per frame
      this.vr_ = 0; // rotational velocity in degrees per frame
      this.icon_ = null; this.sicon_ = null; // icon, shadow
      this.fidiv_ = null; this.line_ = null; // flight info, connecting line
      this.info_ = { x: 0, y: 0, vx: 0, vy: 0 }; // plane info label position and velocity
    },
    
    onAdd: function(map) {
      this.map_ = map;
      this.div_ = $('<div>', { 'class': 'airplane', position: 'absolute' });
      this.curpos_ = this.map_.latLngToLayerPoint(this.llpos_); // convert position to pixels
      this.currot_ = this.rot_;
      this.curalt_ = this.alt_;
      this.title_ = this.airline_ + ' ' + this.fno_ + (this.depart_?' to ':' from ')+this.city_ + '/' + this.airport_;
      // airplane icon and shadow
      var planeicon = 'http://dem5xqcn61lj8.cloudfront.net/Signage/AirportTracker/airplane/' + flightMarker +
          (this.depart_ ? '-blue.png' : '-orange.png');
      var shadowicon = 'http://dem5xqcn61lj8.cloudfront.net/Signage/AirportTracker/shadow/shadow0.png';
      if (transform_prop) { // CSS transforms
        this.icon_ = $('<img>', { src: planeicon, title: this.title_,
            css: { position: 'absolute' }}).appendTo(this.div_);
        this.sicon_ = $('<img>', { src: shadowicon,
            css: { opacity: 0.6, position: 'absolute' }}).appendTo(this.div_);
      } else { // use VML for IE
        this.pdiv_ = $('<div>', { 'class': 'plane', title: this.title_ }).appendTo(this.div_); // plane icon
        /* jshint newcap:false */
        this.icon_ = Raphael(this.pdiv_[0], 120, 120).image(planeicon, 0, 0, 120, 120);
        /* jshint newcap:true */
        this.sdiv_ = $('<div>', { 'class': 'shadow' }).appendTo(this.div_); // shadow of plane
        /* jshint newcap:false */
        this.sicon_ = Raphael(this.sdiv_[0], 150, 150).image(shadowicon, 0, 0, 150, 150);
        /* jshint newcap:true */
      }
      if (showLabels === true || (showLabels==='delay' && this.delay_ >= 15)) { this.addLabel_(); }  // airplane info label
      map.getPanes().overlayPane.appendChild(this.div_[0]);
      if (interactive) {
        var title = this.title_;
        this.div_.click(function() {
          $('#popup').clearQueue().text(title).fadeIn(100).delay(5000).fadeOut(1000);
        });
      }
      // $('#overlay_div').append(this.div_);
      this.draw_();
    },

    draw_: function() { // position the overlays
      var shim = 'http://dem5xqcn61lj8.cloudfront.net/Signage/AirportTracker/shadow/shadow'+
          (Math.max(0, Math.min(9, Math.floor(this.curalt_ / 3000))))+'.png'; // shadow image 0-9
      if (this.sicon_.attr('src') !== shim) { this.sicon_.attr('src', shim); }
      var curalt = Math.round(Math.min(50000, this.curalt_) * 0.01); // 0->500 in hundreds of feet
      var p = 0.5 + 0.0012 * curalt;  // scale due to altitude
      var off = Math.round(curalt * 0.14 * this.scale_); // shadow offset
      if (transform_prop) {
        var iscale = Math.round(this.scale_ * 120 * p); // icon scale
        var sscale = Math.round(this.scale_ * 150 * p); // shadow scale
        this.icon_.css({ left: (this.curpos_.x - iscale/2)+'px', top: (this.curpos_.y - iscale/2)+'px',
            width: iscale+'px', height: iscale+'px', 'z-index': 100+curalt }).
            css(transform_prop, 'rotate('+this.currot_+'deg)'+
            (view === '3D' ? ' translateZ('+curalt+'px)' : ''));
        this.sicon_.css({ left: (Math.round(this.curpos_.x - sscale/2)+off)+'px',
            top: (Math.round(this.curpos_.y - sscale/2)+off)+'px',
            width: sscale+'px', height: sscale+'px' }).css(transform_prop, 'rotate('+this.currot_+'deg)');
      } else {
        this.pdiv_.css({ left: (this.curpos_.x - 60)+'px', top: (this.curpos_.y - 60)+'px' });
        this.pdiv_.find('svg, div').css('z-index', 100+curalt);
        this.icon_.transform('').scale(this.scale_ * p).rotate(this.currot_);
        this.sdiv_.css({ left: ((this.curpos_.x - 75)+off)+'px', top: ((this.curpos_.y - 75)+off)+'px' });
        this.sicon_.transform('').scale(this.scale_ * p).rotate(this.currot_);
      }
      if (showLabels === true || (showLabels==='delay' && this.delay_ >= 15)) {
        // var $delaytext = this.fidiv_.find('.delay');
        this.fidiv_.css({ 'z-index': 700+curalt,
            left: Math.round(this.info_.x - this.fidiv_.outerWidth() * 0.5),
            top: Math.round(this.info_.y - this.fidiv_.outerHeight() * 0.5) });
        this.setDelay(showDelays);
        // draw line from info to plane icon
        if (transform_prop) {
          this.line_.draw(this.info_, this.curpos_);
        } else {
          var ls = 'M'+Math.round(this.info_.x)+','+Math.round(this.info_.y)+
              'L'+Math.round(this.curpos_.x)+','+Math.round(this.curpos_.y);
          if (this.line_ === null) {
            this.line_ = Plane.paper.path(ls).attr({'stroke-width': 3,
                stroke: (this.depart_ ? '#94C1E7' : '#FAA71A')}); // '#f96' : '#66f'
          } else {
            this.line_.attr('path', ls);
          }
        }
      }
    },

    addLabel_: function() {
      this.info_.x = this.curpos_.x;
      this.info_.y = this.curpos_.y;
      var color = this.depart_ ? '#44e' : '#d62';
      this.fidiv_ = $('<div>', { 'class': 'flabel flabel'+labelSize, title: this.title_,
        css: { color: color, 'border-color': color } }); // flight info label
      $('<span>', { 'class': 'fnotext', html: this.fno_ +
        (showOtherAirport ? (this.depart_ ? '&raquo;' : '&laquo;')+this.airport_ : '') }).appendTo(this.fidiv_);
      $('<span>', { 'class': 'delay' }).appendTo(this.fidiv_);
      this.fidiv_.appendTo(this.div_);
      this.setAirlineLogo(showAirlineLogos);
      if (transform_prop) {
        this.line_ = lineseg(this.div_, this.depart_ ? '#94C1E7' : '#FAA71A' );
      }
    },
    
    update: function(args) {  // update position and altitude
      args = args || {};
      this.stamp_ = args.stamp; // time of last update
      var newalt = +args.altitude;
      var newpos = args.position;
      var newtime = args.time;
      var dt = newtime - this.time_; // milliseconds between updates
      // var speed = newpos.distanceTo(this.llpos_) * 1000 / dt; // in meters / second
      var speed = this.map_.layerPointToLatLng(this.curpos_).distanceTo(newpos) * 1000 / dt; // in meters / second
      this.time_ = newtime;
      if (args.delay) { this.delay_ = args.delay; }
      if (args.fno !== this.fno_) {
        this.fno_ = args.fno;
        this.fidiv_.find('.fnotext').html(this.fno_ +
          (showOtherAirport ? (this.depart_ ? '&raquo;' : '&laquo;')+this.airport_ : ''));
        if (showAirlineLogos) {
          this.fidiv_.find('img.airlinelogo').remove();
          this.setAirlineLogo(true);
        }
      }
      if (dt > 0 && !newpos.equals(this.llpos_)) { // only update if plane has moved
        this.move_ = 0;
        this.frames_ = dt * frameMin / 60000; // * 0.000016666667;
        var pixpos = this.map_.latLngToLayerPoint(newpos);
        // var newdeg = (computeHeading(pixpos, this.curpos_) + 180) % 360;
        var newdeg = (90 + (Math.atan2(pixpos.y - this.curpos_.y, pixpos.x - this.curpos_.x) *
            L.LatLng.RAD_TO_DEG)) % 360;
        if (newdeg < 0) { newdeg += 360; } // normalize to 0->360
        this.currot_ %= 360;
        if (this.currot_ < 0) { this.currot_ += 360; }

        this.turn_ = newdeg - this.currot_; // calculate shortest turn
        this.turn_ = this.turn_ > 180 ? this.turn_ - 360 : (this.turn_ < -180 ? this.turn_ + 360 : this.turn_ );
        
        // if (newalt > 4000 && Math.abs(this.turn_) / this.frames_ > 2) {  // DEBUG!!!!!!!!!!!!!
          // this.debug_ = this.turn_;
          // console.log('fast turn: '+this.fno_+': '+(dt * 0.001)+' sec, '+speed.toFixed(0)+' m/s, '+newalt+' ft, '+
          //   this.currot_.toFixed(2)+'->'+newdeg.toFixed(2)+' ('+(this.debug_/this.frames_).toFixed(4)+':'+this.debug_.toFixed(2)+') degrees, '+newpos.toString());
          // this.fidiv_.css('background-color', '#cfc');
        // } // else {
        //   if (this.debug_) {
        //     this.fidiv_.css('background-color', '#efe');
        //   }
        // }

        if ((Math.abs(this.turn_) > 90 && speed > 10) || (Math.abs(this.turn_) > 60 && speed > 125)) {  // hack to prevent plane from moving backwards
          // console.log('big turn: '+this.fno_, this.turn_.toFixed(1), (this.turn_ / this.frames_).toFixed(3), this.frames_,
          //   speed.toFixed(2)+' m/s', this.curalt_.toFixed(0)+' ft');
          pixpos = this.curpos_;  // keep airplane stationary
          newalt = this.curalt_;  // maintain current altitude
        }

        var err = pixpos.distanceTo(this.curpos_);  // DEBUG
        // if (err > 100) {
        //   console.log('ERR: '+this.fno_+' err: '+err.toFixed(3)+' pixpos: '+pixpos.toString()+' curpos: '+this.curpos_.toString());
        //   // throw "BIGERR";
        // }
        // if (this.curalt_ > 50000) console.log(this.fno_+' ALT: '+this.curalt_);
        avgerr += err;  // DEBUG
        avgcnt++;  // DEBUG
        maxerr = Math.max(maxerr, err);  // DEBUG
        // this.vx_ = (pixpos.x - this.curpos_.x) / frameMin; // 60 seconds
        // this.vy_ = (pixpos.y - this.curpos_.y) / frameMin;
        // this.vz_ = (newalt - this.curalt_) / frameMin;
        // this.vr_ = 2 * (newdeg - this.currot_) / frameMin; // only 30 seconds
        // console.log('vx '+this.vx_+', vy '+this.vy_+', vz '+this.vz_+', vr '+this.vr_);
        if (jump) { // jump to next position
          this.curpos_ = pixpos;
          this.curalt_ = newalt;
          this.currot_ = newdeg;
          this.draw_();
        } else { // animate!
          this.vx_ = (pixpos.x - this.curpos_.x) / this.frames_;
          this.vy_ = (pixpos.y - this.curpos_.y) / this.frames_;
          if (speed > 343.2) { // limit to the speed of sound in meters/sec
            var speedratio = 343.2 / speed;
            this.vx_ *= speedratio;
            this.vy_ *= speedratio;
          }
          this.vz_ = (newalt - this.curalt_) / this.frames_;  // altitude change per frame
          if (Math.abs(this.vz_) > 50) {  // 100 feet per second
            this.vz_ = this.vz_ > 0 ? 50 : -50;
          }
          this.vr_ = this.turn_ / this.frames_;  // rotation per frame
          if (Math.abs(this.vr_) > 1) {  // 2 degrees per second
            this.vr_ = this.vr_ > 0 ? 1.0 : -1.0;
          }
        }
        
        this.llpos_ = newpos;
        this.rot_ = newdeg;
        this.alt_ = newalt;

        // if (args.hist && tailsize > 0) {
        //   var tail;
        //   for (var i = 0; i < tailsize; i++) {
        //     if (tail) { tail += tail ? 'L' : 'M'; }
        //   }
        // }
      }
    },
    
    move: function() { // move planes
      if (this.curpos_ === null) { return; }
      this.move_++;
      if (this.move_ >= this.frames_) {
        this.vx_ *= 0.8;
        this.vy_ *= 0.8;
        this.vz_ = 0;
        this.vr_ = 0;
        return;
      }
      this.curpos_.x += +this.vx_;
      this.curpos_.y += +this.vy_;
      this.curalt_ += +this.vz_;
      this.currot_ += +this.vr_;
      this.draw_();
    },
    
    getXY: function() {
      return this.curpos_;
    },
    
    getInfo: function() {
      return this.info_;
    },
  
    // Physics engine to position flight info labels
    physics: function(p, i) {
      
      if (this.curpos_ === null) { return; }
      
      function repel(r, s, xc) { // radius, slope, x crossing, repel only
        return Math.min(0, s * (r - xc));
      }
  
      var o, dx, dy, r, f, theta, vxt, vyt, sc;
      
      sc = 0.2 + 12 / flightMarkerScale;
      for (var j = 0; j < p.length; j++) { // force from planes
        o = p[j].getXY();
        if (o === null) { continue; }
        dx = sc * (this.info_.x - o.x);
        dy = 2.8 * sc * (this.info_.y - o.y);
        r = Math.sqrt(dx * dx + dy * dy);
        if (i === j) { // plane for this label (attract)
          f = 2 * (r - 45); // slope * (r - xcross)
        } else { // other planes repel only
          f = repel(r, 0.7, 80);
        }
        theta = Math.atan2(dy, dx);
        vxt = f * fm * Math.cos(theta);
        vyt = f * fm * Math.sin(theta);
        this.info_.vx -= vxt;
        this.info_.vy -= vyt;
      }
      
      sc = 4.8 / labelSize;
      for (j = i + 1; j < p.length; j++) { // force from other labels
        o = p[j].getInfo();
        if (o === null) { continue; }
        dx = sc * (this.info_.x - o.x);
        dy = 5 * sc * (this.info_.y - o.y);
        r = Math.sqrt(dx * dx + dy * dy);
        f = repel(r, 1.1, 80);
        theta = Math.atan2(dy, dx);
        vxt = f * fm * Math.cos(theta);
        vyt = f * fm * Math.sin(theta);
        o.vx += vxt;
        o.vy += vyt;
        this.info_.vx -= vxt;
        this.info_.vy -= vyt;
      }
      
      // force from edges
      var edge = 75;
      var force = fm * 30;
      if (this.info_.x < edge && this.info_.x < this.curpos_.x + edge) { this.info_.vx += force; }
      if (this.info_.x > map.getSize().x - edge && this.info_.x > this.curpos_.x - edge) {
        this.info_.vx -= force;
      }
      if (this.info_.y < edge && this.info_.y < this.curpos_.y + edge) { this.info_.vy += force; }
      if (this.info_.y > map.getSize().y - (edge + (showLegend?44:0)) && this.info_.y > this.curpos_.y - edge) {
        this.info_.vy -= force;
      }
  
      // move label
      // var bias = this.depart_ ? 1.1 : 0.9;
      this.info_.x += (this.vx_ + this.info_.vx) * physicsFrame;
      this.info_.y += (this.vy_ + this.info_.vy) * physicsFrame;
      this.info_.vx *= 0.9; // air friction
      this.info_.vy *= 0.9;
      this.draw_();
    },
    
    mapchanged: function() {
      var newpos = this.map_.latLngToLayerPoint(this.llpos_);
      var change = newpos.subtract(this.curpos_);
      this.curpos_ = newpos;
      this.curalt_ = this.alt_;
      this.currot_ = this.rot_;
      this.vx_ = 0; // x velocity in pixels per frame
      this.vy_ = 0; // y
      this.vz_ = 0; // z (altitude) in feet per frame
      this.vr_ = 0; // rotational velocity in degrees per frame
      if (this.info_) {
        this.info_.x += change.x;
        this.info_.y += change.y;
      }
      this.draw_();
    },
    
    onRemove: function() {
      this.map_.getPanes().overlayPane.removeChild(this.div_[0]);
      // this.div_.remove();
      this.div_ = null;
      this.icon_ = null;
      this.sicon_ = null;
      if (showLabels === true || (showLabels==='delay' && this.delay_ >= 15)) {
        this.fidiv_ = null;
        this.line_.remove(); // line
        this.line_ = null;
      }
    },
    
    remove: function() { // remove this overlay
      map.removeLayer(this);
    },
    
    stamp: function() {
      return this.stamp_;
    },
    
    id: function() {
      return this.id_;
    },
    
    flight: function() {
      return this.fno_;
    },

    city: function() {
      return this.city_;
    },
    
    isDep: function() {
      return this.depart_;
    },

    setAirlineLogo: function(b) {
      if (b) { // add
        var $text = this.fidiv_.find('.fnotext, .delay').css('bottom', labelmargin[labelSize]);
        var alogo = Plane.logo_url(this.fno_.match(/^\w+/)[0].toLowerCase());
        var $airlogo = $('<img/>', { 'class': 'airlinelogo' }).error(kill_logo).attr('src', alogo).prependTo(this.fidiv_);
      } else { // remove
        this.fidiv_.find('img.airlinelogo').remove();
        this.fidiv_.find('.fnotext, .delay').css('bottom', 0);
      }
      function kill_logo() {
        $airlogo.unbind('error', kill_logo);
        $airlogo.remove();
        $text.css('bottom', 0);
        return false;
      }
    },
    showLabel: function(b) {
      if (b) { // add
        this.addLabel_();
      } else { // remove
        this.fidiv_.remove();
        this.fidiv_ = null;
        this.line_.remove(); // line
        this.line_ = null;
      }
    },
    setOtherAirport: function(b) {
      this.fidiv_.find('.fnotext').html(this.fno_ + (b ? (this.depart_ ? '&raquo;' : '&laquo;')+this.airport_ : ''));
    },
    setDelay: function(b) {
      if (this.delay_ >= 15 && b) {
        this.fidiv_.find('.delay').text(this.delay_).css({'background-color': 'yellow',
            color: 'rgb('+Math.min(this.delay_ - 15, 255)+',0,0)'});
      } else {
        this.fidiv_.find('.delay').text('').css('background-color', 'transparent');
      }
    },
    setFlightMarker: function(name) {
      flightMarker = name;
      this.icon_.attr('src', 'http://dem5xqcn61lj8.cloudfront.net/Signage/AirportTracker/airplane/' +
        flightMarker + (this.depart_ ? '-blue.png' : '-orange.png'));
    },
    setFlightMarkerScale: function(n) {
      this.scale_ = n;
      if (jump) { this.draw_(); }
    }

  });

  Plane.logo_url = function(ac) {
    // sizes include 12, 16, 24, 32, 36, 48, 64
    return 'http://dem5xqcn61lj8.cloudfront.net/NewAirlineLogos/'+ac+'/'+ac+'_'+labelSize+'x'+labelSize+'.png'; // aa/aa_24x24.png
  };
  
  // misc functions ----------------------------------------------------------------------
  function lineseg(p, c) { // draw a line using a rotated div
    var $div = $('<div>', { 'class': 'lineseg' });
    if (p) { $div.appendTo(p); } // parent
    if (c) { $div.css('border-top-color', c); } // line color
  
    return {
      draw: function(p1, p2) {
        var temp;
        if (p2.x < p1.x) {
          temp = p1;
          p1 = p2;
          p2 = temp;
        }
        var dx = p2.x - p1.x;
        var dy = p2.y - p1.y;
        var length = Math.sqrt(dx*dx + dy*dy);
        $div.css('width', length);
        if (transform_prop) {
          var angle = Math.atan2(dy,dx);
          $div.css({
              top: p1.y + 0.5*length*Math.sin(angle),
              left: p1.x - 0.5*length*(1 - Math.cos(angle)) }).
              css(transform_prop, 'rotate('+angle+'rad)');
        } else {
          $div.css({ top: Math.min(p1.y, p2.y), left: p1.x });
          var nCos = dx/length;
          var nSin = dy/length;
          $div.css('filter', "progid:DXImageTransform.Microsoft.Matrix(sizingMethod='auto expand', M11=" +
              nCos + ", M12=" + -1*nSin + ", M21=" + nSin + ", M22=" + nCos + ")");
        }
      },
      insertTo: function(parent) {
        $div.appendTo(parent);
      },
      remove: function() {
        $div.remove();
      }
    };
  }
  
  var browser_prefixes = ['Webkit', 'Moz', 'Ms', 'O', 'Khtml'];

  function testStyleProperty(propName, element) {
    element = element || document.documentElement;
    var style = element.style,
        prefixed;
    // test standard property first
    if (typeof style[propName] === 'string') { return propName; }
    // capitalize
    propName = propName.charAt(0).toUpperCase() + propName.slice(1);
    // test vendor specific properties
    for (var i=0, l=browser_prefixes.length; i<l; i++) {
      prefixed = browser_prefixes[i] + propName;
      if (typeof style[prefixed] === 'string') { return prefixed; }
    }
    // if (document.documentMode === 9) { return '-ms-transform'; } // HACK! for IE9
    if (window.msPerformance) { return '-ms-transform'; } // HACK! for IE9
    // IE9 returns undefined for document.documentElement.style.MsTransform!
  }
  
/*  // Flightstats weather tiles -----------------------------------------------------------
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
*/

}(jQuery));

/*  var overlayinfo = {
    acetatefg: { // Acetate Foreground
      name: 'Acetate Foreground',
      url: 'http://acetate.geoiq.com/tiles/acetate-fg/{z}/{x}/{y}.png',
      subdomains: '',
      attribution: '2011 GeoIQ'
    }
  };
*/
    /* if (interactive) {
      layerControl = new L.Control.Layers(basemaps, {})
      map.addControl(layerControl);
    } */
      /* if (interactive) {
        layerControl.addOverlay(airport, 'Airport Marker');
      } */

/*      if (weatherStation === 'AUTO' || (weatherStation === false && weatherFrames !== null)) {
        actualStation = bBox(null, weatherRadar, airportLoc.lat, airportLoc.lng);
        // if (console) { console.log('Using '+weatherStation+' ('+city(weatherStation)+') for weather'); }
      }
      if (actualStation && city(actualStation) !== undefined) { // http://www.srh.noaa.gov/jetstream/doppler/ridge_download.htm
        WeatherImage.setlayer();
        // wlayer = new WeatherImage(actualStation, weatherRadar, weatherFrames, weatherOpacity/100);
        // map.addLayer(wlayer);
        if (interactive) {
          layerControl.addOverlay(wlayer, 'Local Weather Radar');
        }
      }
     
      $.each(overlayinfo, function(k, v) {
        var layer = new L.TileLayer(v.url,
            { maxZoom: 18, attribution: v.attribution, subdomains: v.subdomains});
        if (interactive) {
          layerControl.addOverlay(layer, v.name);
        }
      });
*/
      
      /* if (interactive) {
        layerControl.addOverlay( // Flightstats NEXRAD Radar
          new L.TileLayer.FSWeather({
            opacity: 0.5,
            attribution: "Weather data © 2011 IEM Nexrad"
        }), 'Flightstats Radar')
        layerControl.addOverlay( // Iowa NEXRAD Radar
            new L.TileLayer.WMS("http://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi", {
            layers: 'nexrad-n0r-900913',
            format: 'image/png',
            transparent: true,
            opacity: 0.5,
            attribution: "Weather data © 2011 IEM Nexrad"
        }), 'NEXRAD Radar');
        layerControl.addOverlay( // Iowa 1 Hour Precipitation
            new L.TileLayer.WMS("http://mesonet.agron.iastate.edu/cgi-bin/wms/q2.cgi", {
            layers: 'q2_n1p_900913',
            format: 'image/png',
            subdomains: ['mesonet1', 'mesonet2', 'mesonet3'],
            transparent: true,
            opacity: 0.5,
            attribution: "Weather data © 2011 IEM Nexrad"
        }), '1 Hour Precipitation');
        layerControl.addOverlay( // Iowa IR Satellite
            new L.TileLayer.WMS("http://mesonet.agron.iastate.edu/cgi-bin/wms/goes/conus_ir.cgi", {
            layers: 'conus_ir_4km_900913',
            format: 'image/png',
            transparent: true,
            opacity: 0.5,
            attribution: "Weather data © 2011 IEM Nexrad"
        }), 'Infrared Satellite');

        // layerControl.addOverlay(
        //   new L.TileLayer(
        //     'http://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
        //     { scheme: 'tms' }), 'n0q'
        // );

      } */
 