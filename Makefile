default:
	make clean compile APP=${APP}
deploy-setup:
	make compile APP=${APP}
	cp -r ${APP}/img ${APP}/build/.
	cp -r ${APP}/lib ${APP}/build/.
	cp ${APP}/*.html ${APP}/build/.
	# tar -zcvf deploy.tar.gz ${APP}/build/*
clean:
	bash clean.sh ${APP}
compile:
	bash compile.sh ${APP}
deploy-clean:
	make clean APP=${APP}
	bash deploy-clean.sh ${APP} ${BUCKET}
deploy-public:version
	bash ./deploy.sh ${APP} ${BUCKET} true
deploy:version
	bash ./deploy.sh ${APP} ${BUCKET}
version:deploy-setup
	bash version.sh ${APP} ${VERSION}
