// FlightStats 3D flight tracker

(function($) {
	"use strict";

	var ge;	// google earth
	var plane = {};	// airplane loaded from kml
	var lookat;
	var speed = 600 * 0.44704;	// 600 mph in m/s

	// http://sketchup.google.com/3dwarehouse/details?mid=33240efb33b9146044894b546f66c3ae&prevstart=24 tilted
	// var MODEL_URL = 'http://sketchup.google.com/3dwarehouse/download?mid=33240efb33b9146044894b546f66c3ae&rtyp=zip&fn=airplane&ctyp=airplane';

	// http://sketchup.google.com/3dwarehouse/details?mid=cbacce3a17e061251ab9df4be75138d0&prevstart=0 ANTICS A380
	// var MODEL_URL = 'http://sketchup.google.com/3dwarehouse/download?mid=cbacce3a17e061251ab9df4be75138d0&rtyp=zip&fn=airplane&ctyp=airplane';

	// http://sketchup.google.com/3dwarehouse/details?mid=c16495a75db30903fc66b6d17679fc1&prevstart=0 Boeing 787-9
	// var MODEL_URL = 'http://sketchup.google.com/3dwarehouse/download?mid=c16495a75db30903fc66b6d17679fc1&rtyp=zip&fn=airplane&ctyp=airplane';

	// http://sketchup.google.com/3dwarehouse/details?mid=d9570d4f12723e194c3a35cee92bb95b
	// var MODEL_URL = 'http://sketchup.google.com/3dwarehouse/download?mid=d9570d4f12723e194c3a35cee92bb95b&rtyp=zip&fn=airplane&ctyp=airplane';

	var MODEL_URL = 'http://zat.com/apps/three/zairplane.kmz';

	$(document).ready(init);

	function init() {
		google.setOnLoadCallback(gloadCB);
	}

	function gloadCB() {
		google.earth.createInstance('ge3d', gsuccessCB, gfailureCB);
	}

	function gfailureCB(error) {	// google load failure
		if (error === 'ERR_CREATE_PLUGIN') {
			alert('You need to install the Google Earth plugin');
		} else {
			alert('Google Earth plugin error code: '+error);
		}
	}

	function gsuccessCB(instance) {	// google load success
		ge = instance;
		ge.getWindow().setVisibility(true);
		// ge.getSun().setVisibility(true);
		ge.getOptions().setStatusBarVisibility(false);
		ge.getNavigationControl().setVisibility(ge.VISIBILITY_AUTO);

		ge.getLayerRoot().enableLayerById(ge.LAYER_BORDERS, true);
		ge.getLayerRoot().enableLayerById(ge.LAYER_ROADS, true);

		ge.getOptions().setFlyToSpeed(ge.SPEED_TELEPORT);

	  google.earth.fetchKml(ge, MODEL_URL, fetchCB);
	}

	function fetchCB(kmlobj) {	// fetchKml success

		// console.log(kmlobj, !kmlobj);
  	if (!kmlobj) {
  		setTimeout(function() {
	      alert('Bad or null KML.');
	    }, 0);
	    return;
  	}

  	// ge.getFeatures().appendChild(kmlobj);

  	walkKmlDom(kmlobj, function() {
			// console.log(this.getType());
			if (this.getType() === 'KmlPlacemark') {
				var geo = this.getGeometry();
				if (geo && geo.getType() === 'KmlModel') {
					// console.log('found model', geo.getType(), this);
					plane.placemark = this;
					return false;
				}
			}					      
		});

  	plane.model = plane.placemark.getGeometry();
  	plane.orientation = plane.model.getOrientation();
  	plane.location = plane.model.getLocation();

  	plane.orientation.setHeading(0);
  	plane.model.setOrientation(plane.orientation);

  	plane.model.setAltitudeMode(ge.ALTITUDE_ABSOLUTE);
  	plane.location.setAltitude(9000);
  	plane.location.setLatitude(50); // 47.6097);
  	plane.location.setLongitude(-122.3331);
  	plane.model.setLocation(plane.location);
  	// console.log(plane.location.getLatitude(), plane.location.getLongitude(), plane.location.getAltitude(), plane.orientation.getHeading());

  	ge.getFeatures().appendChild(plane.placemark);

  	lookat = ge.createLookAt('');
  	lookat.set(plane.location.getLatitude(), plane.location.getLongitude(),
  		plane.location.getAltitude(), /* altitude */
  		// ge.ALTITUDE_RELATIVE_TO_GROUND,
  		ge.ALTITUDE_ABSOLUTE,
  		180, /* heading */
      // fixAngle(180 + me.model.getOrientation().getHeading() + 45),
      70, /* tilt */
      140 /* range */         
  		);
  	ge.getView().setAbstractView(lookat);

		setTimeout(function() {
			plane.curtime = (new Date()).getTime();
			google.earth.addEventListener(ge, "frameend", animate);
		}, 5000);

  }	// end fetchCB callback

  function animate() {
  	var now = (new Date()).getTime();
  	var dt = (now - plane.curtime) / 1000.0; // in seconds
  	var dist = dt * speed * 0.000009; // in degrees
  	plane.curtime = now;

		// plane.model.setLocation(plane.location);
		var heading = lookat.getHeading() - dt;
		if (heading <= -360) { heading += 360; }
		lookat.setHeading(heading);
		var lat = plane.location.getLatitude() - dist;
		if (lat < 35.0 && heading - 180 < 0.05) {
			lat = 50; // 47.6097;
		}
		plane.location.setLatitude(lat);
		lookat.setLatitude(lat);
		ge.getView().setAbstractView(lookat);
  }

}(jQuery));