//
//  FSFirstViewController.m
//  FSHTMLSampleApp
//
//  Created by Chad Berkley on 11/5/12.
//  Copyright (c) 2012 Chad Berkley. All rights reserved.
//

#import "FSFlightTrackerViewController.h"

@implementation FSFlightTrackerViewController

- (void)viewDidLoad
{
    [super viewDidLoad];
	// Do any additional setup after loading the view, typically from a nib.
    NSURL *url = [NSURL URLWithString:@"http://flightstats.com"];
    NSURLRequest *request = [[NSURLRequest alloc] initWithURL:url];
    [_webView loadRequest:request];
}

- (void)didReceiveMemoryWarning
{
    [super didReceiveMemoryWarning];
    // Dispose of any resources that can be recreated.
}

@end
