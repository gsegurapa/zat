# java -jar closure/compiler.jar --compilation_level ADVANCED_OPTIMIZATIONS --js airtrack.js --externs externs.js --externs closure/google_maps_api_v3.js --externs closure/jquery-1.6.js --js_output_file airtrack-min.js
java -jar ../closure/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --js airtrack.js --js ridge.js --js_output_file airtrack-min.js