#/bin/bash
mkdir -p ${1}/build
for js in $(find ${1}/src/*.js -maxdepth 1)
do
	echo "compiling ${js} in app ${1}"
	jsstr=" --js ${js} "
	fileparams=$fileparams$jsstr
	count=$((count+1))
done

java -jar ./closure/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS ${fileparams} --js_output_file ${1}/build/${1}.js

echo "${count} files compiled to  ${1}/build/${1}-min.js"