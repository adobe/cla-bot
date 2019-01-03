/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

var request = require('request');
var config = require('./config.json');
var github_app = require('github-app');
var openwhisk = require('openwhisk');

function main (params) {
  return new Promise((resolve, reject) => {
    if (!params.agreement) {
      reject(`NO AGREEMENT ID, SOMETHING IS WRONG!`);
    }

    var agreementID = params.agreement.id;

    var response = {};
    response = {
      statusCode: 400,
				// body: `something went horribly wrong ${clientID} ${config.signClientID}`
      body: agreementID
    };
    resolve(response);
  });
}

exports.main = main;
