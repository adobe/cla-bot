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

var request = require('request-promise-native');
var parse = require('csv-parse');
var utils = require('../utils.js');
var config = utils.get_config();

function main (params) {
  var agreements = [];

  return new Promise(function (resolve, reject) {
    // Expects an array of agreement_ids for cla-bot/checker

    if (params.agreements && params.agreements.constructor === Array) {
      agreements = params.agreements;
    } else if (params.agreements) {
      agreements.push(params.agreements);
    } else {
      return reject(new Error("param 'agreements' not found in request"));
    }

    // Get an access_token from a refresh_token for Adobe Sign APIs
    // TODO: below is the same as what we use in checker. should we factor this
    // out?
    var options = {
      json: true,
      method: 'POST',
      url: 'https://api.na2.echosign.com/oauth/refresh',
      headers: {
        'cache-control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      form: {
        client_id: config.signClientID,
        client_secret: config.signClientSecret,
        grant_type: 'refresh_token',
        refresh_token: config.signRefreshToken
      }
    };

    request(options).then(function (body) {
      var access_token = body.access_token;
      var args = {
        agreements: agreements,
        access_token: access_token
      };
      return lookup(args);
    }).then(function (usernames) {
      resolve({
        body: {
          usernames: usernames
        }
      });
    }).catch(reject);
  });
}

function lookup (args) {
  return new Promise(function (resolve, reject) {
    var agreements = args.agreements;
    var usernames = [];
    var promises = agreements.map(function (agreement) {
      return lookupSingleAgreement(args, agreement).then(function (users) {
        usernames = Array.from(new Set(usernames.concat(users)));
      });
    });
    Promise.all(promises).then(function () {
      resolve(usernames);
    }).catch(reject);
  });
}

function lookupSingleAgreement (args, agreement) {
  return new Promise(function (resolve, reject) {
    var access_token = args.access_token;

    var options = {
      method: 'GET',
      url: 'https://api.na1.echosign.com:443/api/rest/v5/agreements/' + agreement + '/formData',
      headers: {
        'cache-control': 'no-cache',
        Authorization: 'Bearer ' + access_token
      }
    };

    request(options).then(function (body) {
      // Logic to parse CSV and get the value for Custom Field 8 or Custom Field 1 or githubUsername
      parse(body.trim(), {
        columns: true
      }, function (err, records) {
        if (err) {
          return reject(err);
        }
        var usernames = [];
        var data = records[0];
        if (data['Custom Field 8'] !== undefined && data['Custom Field 8'].trim() !== '') {
          usernames = data['Custom Field 8'].split(/[\s,\n]+/);
        }
        if (data['Custom Field 1'] !== undefined && data['Custom Field 1'].trim() !== '') {
          usernames.push(data['Custom Field 1']);
        }
        if (data.githubUsername !== undefined && data.githubUsername.trim() !== '') {
          usernames.push(data.githubUsername);
        }
        resolve(usernames);
      });
    });
  });
}

exports.main = main;
