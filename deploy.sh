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
		# echo "deploying file ${f} for app ${1} to bucket ${2}/${shortpath}"
		echo "s3put ${2}/${1}/${shortpath} ${f}"
		s3put "${2}/${1}/${shortpath}" "${f}" 
	fi
done