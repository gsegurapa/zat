#/bin/bash
# usage: ./deploy-clean.sh <app> <bucket>
# example: ./deploy-clean.sh flick flightstats-webapps-staging

list=`s3ls ${2}/${1} -1`
keys=(${list//\n/ })
for key in $(echo $list | tr "\n" "\n")
do
	echo "deleting: ${2}/${key}"
	s3rm "${2}/${key}"
done
