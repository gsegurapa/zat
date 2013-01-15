default:
	make clean compile ${APP}
deploy-setup:
	# mkdir -p deploy
	# git archive --format zip --output deploy.zip origin/deploy
	# unzip deploy.zip -d deploy
	# rm deploy.zip
	make compile ${APP}
	cp -r ${APP}/img ${APP}/build/.
	cp ${APP}/lib/* ${APP}/build/.
	cp ${APP}/*.html ${APP}/build/.
	tar -zcvf deploy.tar.gz ${APP}/build/*
clean:
	rm -rf deploy
	./clean.sh ${APP}
compile:
	./compile.sh ${APP}
deploy:deploy-setup
	./deploy.sh ${APP} ${BUCKET}