// Map of Vaux Swift roosting sites and counts
/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, unused:true, curly:true, indent:false */
/*global jQuery:false, L:false, document:false */

(function($){
  "use strict";

  var data_sources = {
    '2008-2010HighNorth': 'high counts 2008 to 2010 North (spring)',
    '2008-2010HighSouth': 'high counts 2008 to 2010 South (fall)',
    '2008-2011HighNorth': 'high counts 2008 to 2011 North (spring)',
    '2008-2011HighSouth': 'high counts 2008 to 2011 South (fall)',
    '2008-2013HighNorth': 'high counts 2008 to 2013 North (spring)',
    '2008-2013HighSouth': 'high counts 2008 to 2013 South (fall)'
  };
  var currentgroup = '2008-2010HighSouth'; // currently displayed data group

  var tilesinfo = {
    mqosm: { // map quest / open street map
      name: 'MapQuest Open Street Map',
      url: 'http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.jpg',
      subdomains: '1234',
      attribution: 'Data, imagery and map information provided by <a href="http://open.mapquest.co.uk" target="_blank">MapQuest</a>, <a href="http://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> and contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/" target="_blank">CC-BY-SA</a>',
      minZoom: 0, maxZoom: 18
    },
    mqaerial: { // map quest / aerial (satellite)
      name: 'MapQuest Open Aerial',
      url: 'http://oatile{s}.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg',
      subdomains: '1234',
      attribution: 'Tiles courtesy of MapQuest. Portions Courtesy NASA/JPL-Caltech and U.S. Depart. of Agriculture, Farm Service Agency',
      minZoom: 0, maxZoom: 18 // only up to 11 outside US
    },
    mqhybrid: { // map quest hybrid = aerial (satellite) PLUS overlay
      name: 'MapQuest Open Hybrid',
      url: 'http://oatile{s}.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg',
      subdomains: '1234',
      attribution: 'Tiles courtesy of MapQuest. Portions Courtesy NASA/JPL-Caltech and U.S. Depart. of Agriculture, Farm Service Agency',
      minZoom: 0, maxZoom: 18 // only up to 11 outside US
    },
    osm: { // open street map
      name: 'Open Street Map Normal',
      url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: 'abc',
      attribution: 'Data, imagery and map information provided by <a href="http://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> and contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/" target="_blank">CC-BY-SA</a>',
      minZoom: 0, maxZoom: 18
    },
    terrain: { // shaded relief terrain from OSM data
      name: 'Stamen US Terrain',
      url: 'http://{s}.tile.stamen.com/terrain/{z}/{x}/{y}.jpg',
      subdomains: 'abcd',
      attribution: 'Michal Migurski http://mike.teczno.com/notes/osm-us-terrain-layer/foreground.html',
      minZoom: 4, maxZoom: 18
    },
    acetate: { // http://developer.geoiq.com/tools/acetate/
      name: 'GeoIQ Acetate',
      url: 'http://{s}.acetate.geoiq.com/tiles/acetate-hillshading/{z}/{x}/{y}.png',
      subdomains: ['a1', 'a2', 'a3'],
      attribution: '2011 GeoIQ &#038; Stamen, Data from OSM and Natural Earth',
      minZoom: 0, maxZoom: 17
    }
  };
  
  // hybrid is actually the aerial basemap + an overlay
  var mqoverlay = L.tileLayer('http://otile{s}.mqcdn.com/tiles/1.0.0/hyb/{z}/{x}/{y}.png',
        { maxZoom: 18, subdomains: '1234', zIndex: 5 });

  // process URL parameters and cookies --------------------------------------------------
  function getParams(p) {
    
    var params = {}; // parameters
    p.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { params[key] = value; });
    if (params.mapType) { mapType = params.mapType; }
    if (params.zoomLevel) { zoomLevel = +params.zoomLevel; }
    if (params.center) {
      var n = params.center.split(',', 2);
      center = L.latLng(+n[0], +n[1]);
    }
    if (params.controls) { controls = params.controls === 'true'; }
    if (params.view) { view = params.view; }
    // if (params.info) { info = params.info === 'true'; }
  }
  
  function setCookie(name, value) {
    var date = new Date();
    date.setTime(date.getTime() + 7*86400000); // 7 days
    document.cookie = name+'='+value+'; expires='+date.toGMTString()+'; path='+window.location.pathname;
  }
  
  var mapType = 'mqosm', // keys from tilesinfo
      zoomLevel = 5,
      center = L.latLng(40, -115),
      controls = true,
      view = null; // 3D
  
  getParams('?'+document.cookie); // params from cookies
  getParams(window.location.href); // params from URL override
  
  var map; // Leaflet map object
  var layerControl; // interactive control
  var groups = {};  // layer groups for each data source
  var databounds; // view bounds to see all data

  $(document).ready(function() {
      
    if (view === '3D') {
      $('#map_div').addClass('three');
    }

    var $select = $('#data_layer select');
    $.each(data_sources, function(k, v) {
      groups[k] = L.layerGroup();
      $select.append('<option value="'+k+'"'+(k===currentgroup?' selected':'')+'>'+v+'</option>');
    });
  
    $select.on('change', function(e) {
      map.removeLayer(groups[currentgroup]); // remove old data group
      currentgroup = $.trim($(e.target).val());
      map.addLayer(groups[currentgroup]);  // add new data group
    });

    map = L.map('map_div', { // create map
      zoomControl: controls,
      attributionControl: controls
    }).on('load', mapReady);
        
    var basemaps = {};

    if (controls) {
      layerControl = L.control.layers({}, {});
      map.addControl(layerControl);
    }

    $.each(tilesinfo, function(k, v) {
      var minz = v.minZoom ? v.minZoom : 0;
      var maxz = v.maxZoom ? v.maxZoom : 22;
      var layer = L.tileLayer(v.url,
        { minZoom: minz, maxZoom: maxz, attribution: v.attribution, subdomains: v.subdomains ? v.subdomains : ''});
      basemaps[v.name] = layer;
      if (controls) {
        layerControl.addBaseLayer(layer, v.name);
      }
    });

    if (!tilesinfo[mapType]) {
      alert('invalid mapType: '+mapType);
      mapType = 'mqosm';
      setCookie('mapType', mapType);
    }
    map.addLayer(basemaps[tilesinfo[mapType].name]);
    if (mapType === 'mqhybrid') {
      map.addLayer(mqoverlay);
    }
    
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
      case 187: // + or =
        map.setZoom(++zoomLevel);
        break;
      case 189: // - or _
        map.setZoom(--zoomLevel);
        break;
      case 13: // return
        map.fitBounds(databounds);
        break;
      }
    });
    
    map.setView(center, zoomLevel).on('baselayerchange', function(e) {
      if (map.hasLayer(mqoverlay)) { map.removeLayer(mqoverlay); }
      var layer = e.layer;
      $.each(basemaps, function(k, v) {
        if (layer === v) {
          var name = k;
          $.each(tilesinfo, function(k, v) {
            if (name === v.name) {
              mapType = k;
              // if (console && console.log) { console.log('mapType='+k+' ('+name+')'); }
              setCookie('mapType', mapType);
              if (mapType === 'mqhybrid') {
                map.addLayer(mqoverlay);
              }
              return false;
            }
          });
          return false;
        }
      });
    });
    
    function mapReady() {
      if (controls) { map.attributionControl.setPrefix(''); }

      $.ajax({
        dataType: 'json',
        url: 'counts.json',
        success: successfn,
        error: function(jqXHR, status, thrown) {
          if (console && console.log) { console.log('error', jqXHR, status, thrown); }
        }
      });
    } // end mapready

    function successfn(data, status) {
      if (status !== 'success') { alert('cannot load counts.json: '+status); }
      var points = [];
      $.each(data, function(k, v) {
        if (v.counts === null || v.latitude === null || v.longitude === null) { return; }
        points.push(L.latLng(v.latitude, v.longitude));
        $.each(data_sources, function(k) {
          addMarkerToGroup(k, v);
        });
      });
      databounds = L.latLngBounds(points);
      map.fitBounds(databounds).addLayer(groups[currentgroup]);
    }

    function addMarkerToGroup(group, v) {
      var c = v.counts[group];  // count for this data group
      if (c === undefined || c === null) { return; }
      var size = 15 + Math.round(c * 0.004);
      var icon = L.divIcon({
        iconSize: [10, 10],
        popupAnchor: [1, -size],
        html: '<img class="roost" src="img/' + (v.type === 'snag' ? 'snag' : 'chimney') + '.png" style="height:' +
            size + 'px;left:' + (5-Math.round(size * 0.0979)) + 'px;" />'
      });
      groups[group].addLayer(L.marker([v.latitude, v.longitude], { title: v.counts[group]+' swifts', riseOnHover: true, icon: icon }).
          bindPopup(v.counts[group]+' swifts<br />'+v.location+'<br />'+v.name+'<br />('+v.latitude+','+v.longitude+')'));
    }

  });
  
}(jQuery));