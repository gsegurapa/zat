webapps
=======

This repository houses html5/css/js stand alone apps and widgets.  Any client app that can be deployed to an Amazon S3 bucket should live here.  

Current Apps
============
* flick - single-flight tracker
* airtrack - multi-flight airport tracker

Jenkins Jobs
============
* Webapps-airtrack-staging-deploy (http://jenkins.dev.pdx.office/view/Client%20Team/job/Webapps-airtrack-staging-deploy/)
* Webapps-flick-staging-deploy (http://jenkins.dev.pdx.office/view/Client%20Team/job/Webapps-flick-staging-deploy/)
* Webapps-airtrack-demo-deploy (http://jenkins.dev.pdx.office/view/Client%20Team/job/Webapps-airtrack-demo-deploy/)
* Webapps-flick-demo-deploy (http://jenkins.dev.pdx.office/view/Client%20Team/job/Webapps-flick-demo-deploy/)
* Unit/Integration/Regression Tests (NEEDED!)

Deployment
==========
Deployment is controlled by a series of bash scripts and a Makefile.  The scripts and Makefile are located in the root of the repository.  A deployment consists of compiling any source javascript (minimization and obfuscation), packaging the source with dependencies and assets, then copying the bundle to a selected S3 bucket.  A simple deployment command looks like this:

    make deploy-clean deploy APP=airtrack BUCKET=flightstats-webapps-staging VERSION=1.0

The scripts that do the actual building and deployment are as follows:
* compile.sh - compiles the src javascript with the Google closure compiler.  Syntax is:

    compile.sh app

* deploy.sh - Copies all artifacts in the build directory to the given S3 bucket.  Syntax is:

    deploy.sh app bucket

* clean.sh - Delete the contents of the build directory.  Syntax is:
    
    clean.sh app

* clean-deploy.sh - Delete the contents of a deployed app.  Syntax is:

    deploy-clean.sh app bucket

* version.sh - Version the .js files and do a token replacement in the build directory

	version.sh app version_name

By default, a deployment creates non-publicly readable files on S3.  If the deployment should be made public,
use the target 'deploy-public' which will set the public ACL on each file uploaded to S3.


The scripts depend on two different s3 tools for uploading and changing permissions.  They can be downloaded here
http://s3tools.org/s3cmd
and here
http://timkay.com/aws/