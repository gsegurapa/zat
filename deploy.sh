#/bin/bash
# usage: ./deploy.sh <app> <bucket>
# example: ./deploy.sh flick flightstats-webapps-staging

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
echo "setacl s3://${2} --acl-public --recursive"
s3cmd setacl "s3://${2}" --acl-public --recursive
