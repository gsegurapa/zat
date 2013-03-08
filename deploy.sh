#/bin/bash
# usage: ./deploy.sh <app> <bucket> <public=true|false>
# example: ./deploy.sh flick flightstats-webapps-staging false
# the public parameter determines public read access in the s3 bucket
# need more comments

if [ $4 ]
then
	touch ./$1/build/DEPLOY-VERSION-$4
fi

for f in $(find ./${1}/build)
do
	if [[ $f != *"AppleDouble"* && $f != *".git"* ]]
	then
		namespace="./${1}/build"
		length=${#namespace}+1
		shortpath=${f:length}
		s3path=s3://${2}/${1}/${shortpath}
		if [ $3 ]
		then
			echo "s3cmd put --acl-public ${f} ${s3path}"
			s3cmd put --acl-public "${f}" "${s3path}"
		else
			echo "s3cmd put ${f} ${s3path}"
	    	s3cmd put "${f}" "${s3path}"
	    fi
	fi
done
