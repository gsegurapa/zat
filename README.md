webapps
=======

This repository houses html5/css/js standa-alone apps and widgets.  Any client app that can be deployed to an Amazon S3 bucket should live here.  

Current Apps
============
* flick - single-flight tracker
* airtrack - multi-flight airport tracker

Jenkins Jobs
============
* Webapps-airtrack-staging-deploy (http://jenkins.dev.pdx.office/view/Client%20Team/job/Webapps-airtrack-staging-deploy/)
* Webapps-flick-staging-deploy (http://jenkins.dev.pdx.office/view/Client%20Team/job/Webapps-flick-staging-deploy/)
* Unit/Integration/Regression Tests (NEEDED!)

Deployment
==========
Deployment is controlled by a series of bash scripts and a Makefile.  The scripts and Makefile are located in the root of the repository.  A deployment consists of compiling any source javascript (minimizing and obfuscation), packaging the source with dependencies, then copying the bundle to a selected S3 bucket.  A simple deployment command looks like this:

    make deploy-clean APP=airtrack BUCKET=flightstats-webapps-staging

