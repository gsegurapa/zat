// Show delays by airport
// Also has current weather
// See help.html for documentation

(function($){
  "use strict";

  var default_appId='23d80adf', default_appKey='ebc0894e85d4ef2435d40914a285f956';

  var tilesinfo = {
    terrain: {
      name: 'Flightstats Terrain US',
      url: 'http://maptiles-{s}.flightstats-ops.com/terrain/{z}/{x}/{y}.jpg',
      subdomains: 'abcd',
      attribution: 'Map data <a href="http://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a> <a href="http://stamen.com/">Stamen Design</a>, <a href="http://www.openstreetmap.org/">OpenStreetMap</a>',
      minZoom: 4, maxZoom: 12
    },
    terrainbg: {
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
    mapboxterrain: {
      name: 'Mapbox Terrain',
      url: 'http://maptiles-{s}.flightstats-ops.com/mapboxterrain/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      attribution: 'Mapbox',
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
  
  // process URL parameters --------------------------------------------------------------

  var airportSize, minDelay, mapType, zoomLevel, mapCenter,
      showHeat, showIcons, showRoutes, showLegend, ontimeIcon,
      showWeather, weatherOpacity, showWunder,
      updateRate, timestamp, timeFormat, timeOffset,
      capture;  // requires node server to be running
  var appId, appKey;

  function getParams(p) {
    
    var params = {}; // parameters
    p.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { params[key] = value; });

    if (params.airportSize) { airportSize = params.airportSize; }
    if ($.isNumeric(params.minDelay)) { minDelay = +params.minDelay; }
    if ($.isNumeric(params.zoomLevel)) { zoomLevel = +params.zoomLevel; }
    if (params.mapType) { mapType = params.mapType; }
    if (params.mapCenter) {
      var n = params.mapCenter.split(',', 2);
      mapCenter = L.latLng(+n[0], +n[1]);
    }
    if (params.showHeat) { showHeat = params.showHeat==='true'; }
    if (params.showIcons) { showIcons = params.showIcons==='true'; }
    if (params.showRoutes) { showRoutes = params.showRoutes==='true'; }
    if (params.showLegend) { showLegend = params.showLegend==='true'; }
    if (params.ontimeIcon) { ontimeIcon = params.ontimeIcon==='true'; } // use green circle instead of plus sign
    if (params.showWeather) { showWeather = params.showWeather==='true'; }
    if (params.showWunder) { showWunder = params.showWunder==='true'; }
    if ($.isNumeric(params.weatherOpacity)) { weatherOpacity = +params.weatherOpacity; }
    if ($.isNumeric(params.updateRate)) { updateRate = +params.updateRate; }
    if (params.timestamp) { timestamp = params.timestamp==='true'; }
    if (params.timeFormat) { timeFormat = decodeURIComponent(params.timeFormat); }
    if (params.timeOffset) { timeOffset = +params.timeOffset; }
    // don't save
    if (params.interactive) { interactive = params.interactive==='true'; }
    if (params.view) { view = params.view.toUpperCase(); }
    if (params.appId) { appId = params.appId; }
    if (params.appKey) { appKey = params.appKey; }
    if (params.capture) { capture = params.capture==='true'; }
  }

  function setDefaults() {
    airportSize = 3;
    minDelay = 0; // minimum delay to show
    mapType = 'blue'; // keys from tilesinfo
    zoomLevel = 4;
    mapCenter = L.latLng(38, -98); // North America
    showHeat = true;
    showIcons = true;
    showRoutes = true;
    showLegend = true;
    ontimeIcon = true;
    showWeather = false;
    weatherOpacity = 35;
    updateRate = 15;  // 15 minutes
    timestamp = false;
    timeFormat = null;
    timeOffset = 0;
    showWunder = false;
    capture = false;
  }

  function setCookie(name, value) {
    var date = new Date();
    date.setTime(date.getTime() + 730*86400000); // 2 years
    document.cookie = name+'='+value+'; expires='+date.toGMTString()+'; path='+window.location.pathname;
  }

  function saveCookies() {
    setCookie('airportSize', airportSize);
    setCookie('minDelay', minDelay);
    setCookie('mapType', mapType);
    setCookie('zoomLevel', zoomLevel);
    setCookie('mapCenter', mapCenter.lat+','+mapCenter.lng);
    setCookie('showHeat', showHeat);
    setCookie('showIcons', showIcons);
    setCookie('showRoutes', showRoutes);
    setCookie('showLegend', showLegend);
    setCookie('ontimeIcon', ontimeIcon);
    setCookie('showWeather', showWeather);
    setCookie('timestamp', timestamp);
    setCookie('timeFormat', encodeURIComponent(timeFormat));
    setCookie('timeOffset', timeOffset);
    setCookie('weatherOpacity', weatherOpacity);
    // setCookie('interactive', interactive.toString());
    // setCookie('view', view);

    $('#configurl').width($('#config table').width()).
    text(window.location.href.replace(/\?.*$/, '')+'?'+
      document.cookie.replace(/;\s__.*$/, '').replace(/;\s*/g, '&'));
}

  var view = null;  // 2D or 3D
  var interactive = true;

  setDefaults(); // create variables
  getParams('?'+document.cookie); // params from cookies
  getParams(window.location.href); // params from URL override

  // if (appId.length === 0 || appKey.length === 0) {
    appId = default_appId;
    appKey = default_appKey;
  //   alert('appId and appKey required, app will run for 15 minutes');
  //   setTimeout(function() {
  //     appId = '';
  //     appKey = '';
  //     alert('app timeout, valid appId and appKey required');
  //   }, 900000);
  // } else if (appId === default_appId && appKey === default_appKey) {
  //     appId = '';
  //     appKey = '';
  //     alert('invalid appId and appKey');
  // }

  if (view === '3D') { interactive = true; }
  
  var map; // Leaflet map object
  var bounds;  // only draw inside this boundary
  var airports;

  var maintimer, weathertimer;

  var captureframe;

  var originalZoom = zoomLevel;
  var originalCenter = mapCenter;
  // var USbounds = new L.LatLngBounds(new L.LatLng(24, -127), new L.LatLng(49, -66.5)); // US

  var transform_prop = testStyleProperty('transform'); // test for transform CSS property
  var prefix = (transform_prop && transform_prop !== 'transform') ? // CSS browser prefix  
    '-'+(/^[A-Z][a-z]*/.exec(transform_prop).toString().toLowerCase())+'-' : '';   

  $(document).ready(function() {

    var $body = $(document);

    if (view === '3D') {
      $('#map_div').addClass('three');
    }
    // $(window).resize(reload);

    if (timestamp) {
      formatDate(timeFormat);
    }

    if (!(showLegend && showIcons)) { $('#legend').hide(); }

    map = L.map('map_div', { // create map
      dragging: interactive,
      touchZoom: false,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: false,
      zoomAnimation: false,
      keyboard: false,
      maxBounds: [[-85,-360],[85, 180]],  // west -380?
      worldCopyJump: false
    }).on({load: mapReady});
    map.setView(mapCenter, zoomLevel);

    function mapReady() {
      reload();
      map.on({ zoomend: reload, moveend: reload });
    }

    // bounds = map.getBounds();
        
    var basemaps = {};
    $.each(tilesinfo, function(k, v) {
      var layer = L.tileLayer(v.url,
        { maxZoom: v.maxZoom ? v.maxZoom : 18, minZoom: v.minZoom ? v.minZoom : 0,
          attribution: v.attribution, subdomains: v.subdomains ? v.subdomains : ''});
      basemaps[v.name] = layer;
    });
    map.addLayer(basemaps[tilesinfo[mapType].name]);

    if (showWunder) { // !!!!
      var layer = new Wsat({ // Wunderground satellite
        opacity: 0.28,
        attribution: 'Weather Underground'
      });
      map.addLayer(layer);
    }

    // var fdl = new RouteDelayLine();
    // if (showRoutes) { map.addLayer(fdl); }

    var airportdelay = new AirportDelay();
    if (showHeat || showIcons || showRoutes) { map.addLayer(airportdelay); }
    var fsweather = new L.TileLayer.FSWeather({ opacity: weatherOpacity/100,
        attribution: "Weather data © 2012 IEM Nexrad" });
    if (showWeather) {
      map.addLayer(fsweather);
      weathertimer = setInterval(function() {
        fsweather.redraw();
      }, updateRate * (60 * 1000));
    }

    if (interactive) {
      $('body').keydown(function(e) {
        if ($(e.target).filter('body').length === 0) { return; }
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
          map.panTo(originalCenter);
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
        }
      });
    } else {
        BigScreen.onenter = function() { $('#map_div').css('cursor', 'none'); }
        BigScreen.onexit = function() { $('#map_div').css('cursor', ''); }      
    }  // end if (interactive)

    // map has changed --------------------------------------
    function reload(e) {
      bounds = map.getBounds();
      console.log('bounds:',bounds);
      zoomLevel = map.getZoom();
      $('#zoomLevel').val(zoomLevel);
      mapCenter = map.getCenter();
      mainloop();
    } // end reload()

    // mainloop();

    maintimer = setInterval(mainloop, updateRate * (60000));  // every minute

    function mainloop() {
      if (appId.length === 0 || appKey.length === 0) { return; }
      if (!bounds) {
        bounds = L.latLngBounds([[-85, -180],[85, 180]]);
      }
      // maximum size of request is size of world. North and South are limited by map.maxBounds
      var west = bounds.getSouthWest().lng;
      var east = bounds.getNorthEast().lng;
      if (east - west > 360) {
        west = -180;
        east = 180;
      } else {
        if (west < -180) {
          west += 360;
        }
        if (east > 180) {
          east = 180;
        } else if (east < -180) {
          east += 360;
        }
      }
      // console.log('west:', west, 'east:', east);

      $.ajax({
        url: 'https://api.flightstats.com/flex/delayindex/rest/v2/jsonp/within/'+
        bounds.getSouthWest().lat+'/'+west+'/'+bounds.getNorthEast().lat+'/'+east,
        data: { appId: appId, appKey: appKey, classification: airportSize, score: minDelay  },
        dataType: 'jsonp',
        success: getDelays,
        error: badajax
      });
      if (capture) { // requires node server to be running
        // window.location = 'http://127.0.0.1:1337';
        captureframe = $('<iframe>', { src: 'http://127.0.0.1:1337', onload: function(e) {
          // console.log(e);
          // if (data !== 'OK' && console && console.log) {
          //   console.log('screen capture problem: '+data);
          // }
        }});
      }
    } // end mainloop()

    function badajax(jqXHR, textStatus, errorThrown) {
      clearInterval(maintimer);
      if (console && console.log) {
        console.log('AJAX JSONP Timeout', jqXHR, textStatus, errorThrown);
      }
    }

    function getDelays(data, status, xhr) {
      if (timestamp) {
        formatDate(timeFormat);
      }
      if (!data || data.error) {
        if (console && console.log) {
          console.log('data request error:', data.error.errorMessage, data);
        } else {
          if (data.error) { alert(data.error.errorMessage); }
        }
        return;
      }
      console.log('data:', data);
      airports = getAppendix(data.appendix.airports);
      if (showHeat || showIcons || showRoutes) { airportdelay.update(data); }
    }

    // configurator ------------------------------------------------------------
    $('#weatherOpacity, #minDelay, #timeOffset').rangeinput({
      speed: 100, keyboard: false
    }).bind('onSlide', function(e) {
      $('#configurl').text('');
      var $el = $(e.delegateTarget);
      switch($el.attr('id')) {
       case 'minDelay':
        minDelay = +$el.val();
        // mainloop();
        break;
       case 'weatherOpacity':
        weatherOpacity = +$el.val();
        fsweather.setOpacity(weatherOpacity/100);
        break;
       case 'timeOffset':
        timeOffset = +$el.val();
        formatDate(timeFormat);
      }
    });

    function fillDialog() {
      if (!BigScreen.enabled) { $('#cbutton input[value="Full"]').hide(); }
      // $('#airportSize option').removeAttr('selected');
      // $('#airportSize option[value="'+airportSize+'"]').attr('selected','true');
      $('#airportSize').val(airportSize);
      $('#minDelay').val(minDelay);
      // $('#mapType option').removeAttr('selected');
      // $('#mapType option[value="'+mapType+'"]').attr('selected','true');
      $('#mapType').val(mapType);
      $('#zoomLevel').val(zoomLevel);
      $('#showHeat').val(showHeat.toString());
      $('#showIcons').val(showIcons.toString());
      $('#showRoutes').val(showRoutes.toString());
      $('#showLegend').val(showLegend.toString());
      $('#ontimeIcon').val(ontimeIcon.toString());
      $('#showWeather').val(showWeather.toString());
      $('#weatherOpacity').val(weatherOpacity); // .next().text(weatherOpacity);
      $('#timestamp').val(timestamp.toString());
      $('#timeFormat').val(timeFormat);
      $('#timeOffset').val(timeOffset);

      // if ($('#weatherOpacity').prop('type') !== 'range') {
      //   $('#config input[type="range"]').next().hide();
      // }
    }

    var $config = $('#config');

    // click logo to open configurator, or close it
    function configurator(e) {
      if ($('#config:visible').length === 0) {
        if (+($config.css('left').slice(0,-2)) > $body.width()-100 || +($config.css('bottom').slice(0,-2)) < -300) {
          $config.animate({left: 10, bottom: 54}, {queue: false});
        }
        $config.slideDown(); // reveal
        fillDialog();
      } else {
        $config.slideUp(); // hide
        $(document.activeElement).blur();
      }
    }

    $('#fsimg').click(configurator);

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
      var upfun = function(e) {
        $body.unbind('mousemove', movefun).unbind('mouseup', upfun);
      };
      $body.mouseup(upfun);
      return false;
    });

    // true/false buttons
    $('#config td :button.bool').click(function(e) {
      var $el = $(e.target);
      $el.val(function(i, v) {
        return (v==='true') ? 'false' : 'true';
      });
      $el.change();
    });

    // zoomLevel buttons
    $('#inczoom, #deczoom').click(function(e) {
      $('#configurl').text('');
      var tinfo = tilesinfo[mapType];
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
      mainloop();
    });

    // configurator buttons
    $('#cbutton input').click(function(e) {
      var $el = $(e.target);
      switch($el.val()) {
       case 'Hide':
        $('#config').slideUp();
        $(document.activeElement).blur();
        break;
       case 'Save':
        zoomLevel = map.getZoom();
        mapCenter = map.getCenter();
        saveCookies();
        // $('#config').slideUp();
        $(document.activeElement).blur();
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
        break;
      }
    });

    // input change
    $('#config :input').change(function(e) {
      $('#configurl').text('');
      var tinfo, v, i, newz, $el = $(e.delegateTarget);
      switch($el.attr('id')) {
       case 'airportSize':
        airportSize = $el.val();
        mainloop();
        break;
       case 'minDelay':
        minDelay = $el.val();
        mainloop();
        break;
       case 'mapType':
        map.removeLayer(basemaps[tilesinfo[mapType].name]);
        mapType = $el.val();
        tinfo = tilesinfo[mapType];
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
          tinfo = tilesinfo[mapType];
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
       case 'showHeat':
        showHeat = $el.val() === 'true';
        if (showHeat || showIcons || showRoutes) {
          if (!map.hasLayer(airportdelay)) {
            map.addLayer(airportdelay);
            maintimer = setInterval(mainloop, updateRate * (60000));
          }
          mainloop();
        } else {
          if (map.hasLayer(airportdelay)) {
            map.removeLayer(airportdelay);
            clearInterval(maintimer);
          }
        }
        break;
       case 'showIcons':
        showIcons = $el.val() === 'true';
        if (showIcons || showHeat || showRoutes) {
          if (!map.hasLayer(airportdelay)) {
            map.addLayer(airportdelay);
            maintimer = setInterval(mainloop, updateRate * (60000));
          }
          mainloop();
          if (showLegend) { $('#legend').show(); }
        } else {
          if (map.hasLayer(airportdelay)) {
            map.removeLayer(airportdelay);
            clearInterval(maintimer);
          }
          if (showLegend) { $('#legend').hide(); }
        }
        break;
       case 'showRoutes':
        showRoutes = $el.val() === 'true';
        if (showHeat || showIcons || showRoutes) {
          if (!map.hasLayer(airportdelay)) {
            map.addLayer(airportdelay);
            maintimer = setInterval(mainloop, updateRate * (60000));
          }
          mainloop();
        } else {
          if (map.hasLayer(airportdelay)) {
            map.removeLayer(airportdelay);
            clearInterval(maintimer);
          }
        }
        break;
       case 'ontimeIcon':
        ontimeIcon = $el.val() === 'true';
        $('#ontime').attr('src', ontimeIcon ?
          'http://dem5xqcn61lj8.cloudfront.net/GoogleMapTools/delay_factor_1_9x9.png' :
          'http://dem5xqcn61lj8.cloudfront.net/GoogleMapTools/airport_unknown_7.png');
        if (showIcons) {
          mainloop();
        }
        break;
       case 'showLegend':
        showLegend = $el.val() === 'true';
        if (showLegend && showIcons) {
          $('#legend').show();
        } else {
          $('#legend').hide();
        }
        break;
       case 'showWeather':
        showWeather = $el.val() === 'true';
        if (showWeather) {
          map.addLayer(fsweather);
          weathertimer = setInterval(function() {
            fsweather.redraw();
          }, updateRate * (60 * 1000));
        } else {
          map.removeLayer(fsweather);
          clearInterval(weathertimer);
        }
        break;
       case 'weatherOpacity':
        v = $el.val();
        if ($.isNumeric(v) && +v >= 0 && +v <= 100) {
          weatherOpacity = +v;
          fsweather.setOpacity(weatherOpacity / 100);
        } else {
          alert('bad value: '+v);
          $('#weatherOpacity').val(weatherOpacity);
        }
        break;
       case 'timestamp':
        timestamp = $el.val() === 'true';
        if (timestamp) {
          formatDate(timeFormat);
          $('#datetime').show();
        } else {
          $('#datetime').hide();
        }
        break;
       case 'timeFormat':
        timeFormat = $el.val();
        if ($.trim(timeFormat).length === 0) { timeFormat = null; }
        formatDate(timeFormat);
        break;
       case 'timeOffset':
        timeOffset = +$el.val();
        formatDate(timeFormat);
        break;
      }
    });

  }); // end document ready

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


  // airport delay overlay (heat and icons) ----------------------------------------------------
  var AirportDelay = L.Class.extend({
    initialize: function(args) {
      args = args || {};
      this.opacity_ = args.opacity || 1;
    },
    onAdd: function(map) {
      this.div_ = $('<div>', { id: 'airportdelay', css: { position: 'absolute', opacity: this.opacity_ }});
      this.div_.appendTo(map.getPanes().overlayPane);
    },
    onRemove: function(map) {
      map.getPanes().overlayPane.removeChild(this.div_[0]);
      this.div_ = null;
    },
    update: function(data) {
      var $d = $('<div>', { id: 'airportdelay', css: { position: 'absolute', opacity: this.opacity_ }});
      var scale = 0.025*Math.pow(2,zoomLevel);
      if (data.delayIndexes) $.each(data.delayIndexes, function(i, v) {
        var airport = airports[v.airportFsCode];
        var lat = +airport.latitude, lng = +airport.longitude;
        var pos = L.latLng(lat, lng);
        var pixpos = map.latLngToLayerPoint(pos); // convert position to pixels
        var pib = bounds.contains(pos);
        var pos2, pixpos2, pib2 = false;
        if (lng > 0) {
          pos2 = L.latLng(lat, lng-360);
          pixpos2 = map.latLngToLayerPoint(pos2);
          pib2 = bounds.contains(pos2);
        }
        if (pib || pib2) {  // one or the other is inside bounds
          var flights = +v.flights;
          var title = airport.fs+' ('+airport.city+', '+airport.countryCode+') delay: '+v.normalizedScore+' flights: '+flights;
          if (showHeat && flights*scale >= 10) { // draw delay heat
            var size = Math.round(flights*scale);
            var offset = Math.round(size / 2);
            var cv = Math.round(51 * +v.normalizedScore); // 0 - 255
            var cp = 'rgba(255,'+(255-cv)+','+(255-cv)+','; // 1)';
            var $heat = $('<div>', { title: title, // airport.fs+' cv: '+cv+' size: '+size,
              css: {
                left: (pixpos.x - offset)+'px',
                top: (pixpos.y - offset)+'px',
                width: size+'px', height: size+'px',
                'border-radius': '50%'
            }});
            $heat.css(transform_prop ? {
              'background-image': prefix+'radial-gradient(closest-side, '+cp+(0.5+(cv/1020))+'), '+cp+'0) 100%)'
            } : {
              // opacity: (0.5+(cv/1020)).toString(),
              // 'background-color': cp+(0.5+(cv/1020))+')',
              'background-color': 'rgb(255,'+(255-cv)+','+(255-cv)+')',
              'filter': 'progid:DXImageTransform.Microsoft.Alpha(opacity=100, finishopacity=0, style=2)'
            });
            if (pib) { $heat.appendTo($d); }
            if (pib2) {
              $heat.clone().css('left', (pixpos2.x - offset)+'px').appendTo($d);
            }
            // console.log('gradient: ', $heat, size, flights, cv);
          }
          if (showRoutes) { // draw route delay lines
            var routes = v.routeDelays;
            for (var j = 0; j < routes.length; j++) {
              var route = routes[j];
              var ofl = +route.flights;
              if (ofl > 1) {
                var rs = +route.normalizedScore;
                if (rs >= 1) {
                  var color = 'rgba(255,0,0,'+(rs*0.2)+')';
                  var other = airports[route.destinationAirportFsCode];
                  if (other === undefined) {
                    console.log('no airport', route.destinationAirportFsCode);
                  } else {
                    var olat = +other.latitude, olng = +other.longitude;
                    if (olng - lng > 180) {
                      olng -= 360;
                    } else if (olng - lng < -180) {
                      olng += 360;
                    }
                    if (pib) {
                      $d.append(drawline(pixpos, map.latLngToLayerPoint(L.latLng(olat, olng)), color, ofl * 0.75));
                    }
                    if (pib2) {
                      $d.append(drawline(pixpos2, map.latLngToLayerPoint(L.latLng(olat, olng-360)), color, ofl * 0.75));
                    }
                  }
                  // var opixpos = map.latLngToLayerPoint(L.latLng(olat, olng));
                  // $d.append(drawline(pixpos, opixpos, color, ofl * 0.75));
                }
              }
            }
          }
          if (showIcons) { // draw delay icons
            var url = 'http://dem5xqcn61lj8.cloudfront.net/GoogleMapTools/' +
              (+v.observations === 0 ? 'airport_unknown_8.png' : (!ontimeIcon && v.normalizedScore < 1.01 ? 'airport_unknown_7.png' :
              'delay_factor_'+AirportDelay.icons[Math.floor(v.normalizedScore + 0.76)]+'_9x9.png'));
            var $icon = $('<img>', { src: url, title: title,
              css: {
                left: (pixpos.x - 4)+'px',
                top: (pixpos.y - 4)+'px',
                'z-index': 2+Math.round(v.normalizedScore*4)
            }});
            if (pib) { $icon.appendTo($d); }
            if (pib2) {
              $icon.clone().css('left', (pixpos2.x - 4)+'px').appendTo($d);
            }
          }
        }
      }); // end each
      this.div_.empty().append($d);
    },
    empty: function() {
      this.div_.empty();
    }
  });

  AirportDelay.icons = ['1','1','2a','3c','4','5c'];

  // Weather Underground IR satellite ---------------------------------------------------- !!!!
  var Wsat = L.Class.extend({
    initialize: function(args) {
      this.opacity_ = args.opacity || '0.3';
      this.updateRate_ = (args.updateRate || 600) * 1000; // update image every 10 minutes
    },

    onAdd: function(map) {
      this.map_ = map;
      var that = this;
      this.timer_ = setInterval(function() {
        that.$img_.attr('src', that.url_+(new Date).getTime());
      }, this.updateRate_); 

      map.on('viewreset', that.draw_, that).on('moveend', that.draw_, that);
      this.draw_();
    },
    
    draw_: function() {
      var map = this.map_;
      var size = map.getSize();
      this.bounds_ = map.getBounds();
      var ne = this.bounds_.getNorthEast(), sw = this.bounds_.getSouthWest();
      this.url_ = 'http://wublast.wunderground.com/cgi-bin/WUBLAST?maxlat='+
          ne.lat+'&maxlon='+ne.lng+'&minlat='+sw.lat+'&minlon='+sw.lng+'&width='+size.x+'&height='+size.y+
          '&gtt=109&frame=0&num=1&delay=25&key=sat_ir4&proj=me&rand=';
      if (this.$img_) { this.$img_.remove(); }
      this.$img_ = $('<img>', { src: this.url_+(new Date).getTime(),
        css: { position: 'absolute', width: '100%', height: '100%', opacity: this.opacity_ }
        }).appendTo('#map_div');
    },
    
    onRemove: function() {
      clearInterval(this.timer_);
      this.$img_.remove();
      this.$img_ = null;
      this.map_.off('viewreset', this.draw_, this).off('moveend', this.draw_, this);
    }
  });
  
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
            '/radar_tile_z', z, 'x', xy.x, 'y', xy.y, '.png?nocache='+(new Date).getTime()].join('') : '';
    }
  
  });
  
  L.TileLayer.FSWeather.weather_tiles_range = {
    2: { x: {min: 0, max: 1}, y: {min: 1, max: 1} },
    3: { x: {min: 0, max: 2}, y: {min: 2, max: 3} },
    4: { x: {min: 0, max: 5}, y: {min: 4, max: 7} },
    5: { x: {min: 0, max: 10}, y: {min: 8, max: 14} },
    6: { x: {min: 0, max: 20}, y: {min: 16, max: 28} }
  };

  // misc functions ----------------------------------------------------------------------
  function drawline(p1, p2, color, swidth) { // draw a line using a rotated div
    var $div = $('<div>', { 'class': 'lineseg' });
    // $div.appendTo(parent);
    // map.getPanes().overlayPane.appendChild($div[0]);
    if (color) { $div.css('border-top-color', color); } // line color
    if (swidth) { $div.css('border-top-width', swidth+'px'); } // stroke width
  
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
      $div.css({ top: Math.min(p1.y, p2.y), left: x1 });
      var nCos = dx/length;
      var nSin = dy/length;
      $div.css('filter', "progid:DXImageTransform.Microsoft.Matrix(sizingMethod='auto expand', M11=" +
          nCos + ", M12=" + -1*nSin + ", M21=" + nSin + ", M22=" + nCos + ")");
    }
    return $div;
  }

  function testStyleProperty(propName, element) {
    var browser_prefixes = ['Webkit', 'Moz', 'Ms', 'O', 'Khtml'];
    element = element || document.documentElement;
    var style = element.style,
        prefixed;
    // test standard property first
    if (typeof style[propName] == 'string') return propName;
    // capitalize
    propName = propName.charAt(0).toUpperCase() + propName.slice(1);
    // test vendor specific properties
    for (var i=0, l=browser_prefixes.length; i<l; i++) {
      prefixed = browser_prefixes[i] + propName;
      if (typeof style[prefixed] == 'string') return prefixed;
    }
    // if (document.documentMode === 9) { return 'MsTransform'; } // HACK! for IE9
    // if (window.msPerformance) { return 'MsTransform'; } // HACK! for IE9
    // IE9 returns undefined for document.documentElement.style.MsTransform!
  }

  function isin(v, ar) { // is v in array ar?
    var len = ar.length;
    for (var i = 0; i < len; i++) {
      if (ar[i] === v) { return true; }
    }
    return false;
  }

  function formatDate(fm) {
    var d = new Date;
    if (timeOffset) { d.addHours(timeOffset); }
    // $('#datetime').text(fm ? (new Date).toString(fm) : (new Date).toJSON().substring(0,16)).show();
    $('#datetime').text(fm ? unidecode(d.toString(fm)) : d.toJSON().substring(0,16)).show();
  }

  function unidecode(s) {
    return s.replace(/&(\d+);/g, function(m, p1) { return String.fromCharCode(+p1); });
  }

  L.Map.include({ // fix for maxBounds bug in Leaflet
    panInsideBounds: function(bounds) {
      bounds = L.latLngBounds(bounds);

      var viewBounds = this.getBounds(),
          viewSw = this.project(viewBounds.getSouthWest()),
          viewNe = this.project(viewBounds.getNorthEast()),
          sw = this.project(bounds.getSouthWest()),
          ne = this.project(bounds.getNorthEast()),
          dx = 0,
          dy = 0;

      if (viewNe.y < ne.y) { // north
        dy = ne.y - viewNe.y + Math.max(0, this.latLngToContainerPoint([85.05112878, 0]).y);
      }
      if (viewNe.x > ne.x) { // east
        dx = ne.x - viewNe.x;
      }
      if (viewSw.y > sw.y) { // south
        dy = sw.y - viewSw.y + Math.min(0, this.latLngToContainerPoint([-85.05112878, 0]).y - this.getSize().y);
      }
      if (viewSw.x < sw.x) { // west
        dx = sw.x - viewSw.x;
      }

      return this.panBy(new L.Point(dx, dy, true));
    }
  });

}(jQuery));
