(function(){
	"use strict";

	console.log('d3.geo',d3.geo);

	var width = window.outerWidth || window.innerWidth;
	var height = window.outerHeight || window.innerHeight ;

	var projection = d3.geo.azimuthal()
		.scale(380)
		.origin([0, 0])
		.mode('orthographic')
		.translate([width / 2, height / 2]);

	// var projection = d3.geo.orthographic()
	//	.scale(3*(width + 1) / 2 / Math.PI)
	//	.translate([width / 2, height / 2])
	//	.clipAngle(90);

	var path = d3.geo.path().projection(projection);

	// clipping circle
	var circle = d3.geo.greatCircle().origin(projection.origin());

	function clippedpath(d) {
		return path(circle.clip(d));
	}

	var svg = d3.select('body').append('svg')
		.attr('width', width)
		.attr('height', height)
		.on('mousedown', mousedown);

	// var graticule = d3.geo.graticule();

	// svg.append('path')
	//	.datum(graticule)
	//	.attr('class', 'graticule')
	//	.attr('d', clippedpath);

	var feature;

	d3.json("planet-110m.json", function(error, planet) {
		var land = topojson.feature(planet, planet.objects.land),
				countries = topojson.feature(planet, planet.objects.countries);

		// svg.append('path')
		//		.datum(land.geometry)
		//		.attr('d', path)
		//		.attr('class', 'land');

		feature = svg.selectAll('.country').data(countries.features)
			.enter().append('path')
				.attr('class', function(d) { return 'country country-' + d.id; })
				.attr('d', clippedpath);

		// var fs_url = 
		// d3.jsonp(fs_url, function() {
		//	console.log(arguments);
		// });


	});

	d3.select(window)
		.on('mousemove', mousemove)
		.on('mouseup', mouseup);

	var mouse0, origin0;

	function mousedown() {
		mouse0 = [d3.event.pageX, d3.event.pageY];
		origin0 = projection.origin();
		d3.event.preventDefault();
	}

	function mousemove() {
		if (mouse0) {
			var m1 = [d3.event.pageX, d3.event.pageY],
					o1 = [origin0[0] + (mouse0[0] - m1[0]) / 7, Math.min(Math.max(-90, origin0[1] + (m1[1] - mouse0[1]) / 7), 90)];
			projection.origin(o1);
			circle.origin(o1);
			refresh();
		}
	}

	function mouseup() {
		if (mouse0) {
			// mousemove();
			mouse0 = null;
		}
	}

	function refresh() {
		feature.attr('d', clippedpath);
	}

}());
