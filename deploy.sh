for f in $(find ./${1}/build)
do
	if [[ $f != *"AppleDouble"* && $f != *".git"* ]]
	then
		echo "deploying file ${f} in app ${1}"
	fi
done