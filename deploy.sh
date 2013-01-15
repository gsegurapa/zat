#/bin/bash
# usage: ./deploy <app> <bucket>
# example: ./deploy flick flightstats-webapps-staging

for f in $(find ./${1}/build)
do
	if [[ $f != *"AppleDouble"* && $f != *".git"* ]]
	then
		namespace="./${1}/build"
		length=${#namespace}+1
		shortpath=${f:length}
		s3path=${2}/${1}/${shortpath}
		echo "s3put ${s3path} ${f}"
		s3put "${s3path}" "${f}" 
	fi
done