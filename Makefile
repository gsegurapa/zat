default:
	make clean compile APP=${APP}
deploy-setup:
	make compile APP=${APP}
	cp -r ${APP}/img ${APP}/build/.
	cp ${APP}/lib/* ${APP}/build/.
	cp ${APP}/*.html ${APP}/build/.
	tar -zcvf deploy.tar.gz ${APP}/build/*
clean:
	./clean.sh ${APP}
compile:
	./compile.sh ${APP}
deploy:deploy-setup
	bash ./deploy.sh ${APP} ${BUCKET}