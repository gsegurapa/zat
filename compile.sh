#/bin/bash
# usage: ./compile.sh <app>
# example: ./compile.sh flick

mkdir -p ${1}/build
mkdir -p ${1}/build/src
for js in $(find ${1}/src/*.js -maxdepth 1)
do
	echo "compiling ${js} in app ${1}"
	jsstr=" --js ${js} "
	fileparams=$fileparams$jsstr
	count=$((count+1))
done

java -jar ./closure/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS ${fileparams} --js_output_file ${1}/build/src/${1}.js

echo "${count} files compiled to  ${1}/build/src/${1}.js"