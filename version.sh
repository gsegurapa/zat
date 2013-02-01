#/bin/bash
# this script versions an app by renaming source files with a version number
# it also updates any file that calls a versioned file
# the app should be compiled into the build directory before running this script
# usage: ./version.sh <app> <version>
# example: ./version.sh flick 1.0

#change the name of each .js file in src
for js in $(find ${1}/build/src/*.js -maxdepth 1)
do
	origfilename=`basename $js`
	dotindex=`expr index "$origfilename" "."`
	basename=${origfilename:0:dotindex-1}
	extension=${origfilename:dotindex}
	newfilename=${basename}-${2}.${extension}
	newname=${basename}-${2}.${extension}
	echo "renaming ${js} to ${1}/build/src/${newname}"
	mv $js ${1}/build/src/$newname
	#update all html files with new filename
	for f in $(find ${1}/build/*.html)
	do
		echo "updating html file: ${f}"
	    sed "s/${origfilename}/${newname}/g" $f > ${1}/build/output
	    mv ${1}/build/output ${f}
	done
done

# #change the name of each img file and update any referenced files
# for img in $(find ${1}/build/img/*.*)
# do
# 	origfilename=`basename $img`
# 	dotindex=`expr index "$origfilename" "."`
# 	basename=${origfilename:0:dotindex-1}
# 	extension=${origfilename:dotindex}
# 	newfilename=${basename}-${2}.${extension}
# 	newname=${basename}-${2}.${extension}
# 	echo "renaming ${img} to ${1}/build/img/${newname}"
# 	mv ${img} ${1}/build/img/${newname}
# 	#update all html files with new filename
# 	for f in $(find ${1}/build/*.html)
# 	do
# 		echo "updating html file: ${f}"
# 	    sed "s/${origfilename}/${newname}/g" $f > ${1}/build/output
# 	    mv ${1}/build/output ${f}
# 	done
# 	#update all js files with new filename
# 	for f in $(find ${1}/build/src/*.js)
# 	do
# 		echo "updating js file: ${f}"
# 	    sed "s/${origfilename}/${newname}/g" $f > ${1}/build/output
# 	    mv ${1}/build/output ${f}
# 	done
# done