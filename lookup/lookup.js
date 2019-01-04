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
var fs = require('fs');
var config_path = './config.json';
var config;
if (fs.existsSync(config_path)) {
  config = require('./config.json');
} else if (process.env.SIGN_REFRESH_TOKEN && process.env.SIGN_CLIENT_ID && process.env.SIGN_CLIENT_SECRET && process.env.GITHUB_KEY && process.env.GITHUB_APP_ID) {
  config = {
    signRefreshToken: process.env.SIGN_REFRESH_TOKEN,
    signClientID: process.env.SIGN_CLIENT_ID,
    signClientSecret: process.env.SIGN_CLIENT_SECRET,
    githubKey: process.env.GITHUB_KEY,
    githubAppId: process.env.GITHUB_APP_ID
  };
} else {
  throw new Error('no config file nor environment variables exist for populating configuration');
}
var async = require('async');
var parse = require('csv-parse');

function main (params) {
  var agreements = [];

  return new Promise(function (resolve, reject) {
    // Expects an array of agreement_ids for cla-bot/checker and a single agreement_id for cla-bot/confirmer

    if (params.agreements && params.agreements.constructor === Array) {
      agreements = params.agreements;
    } else if (params.agreements) {
      agreements.push(params.agreements);
    } else {
      return reject(new Error("param 'agreements' not found in request"));
    }

    // Get an access_token from a refresh_token for Adobe Sign APIs
    var options = {
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

    request(options, function (error, response, body) {
      if (error) throw new Error(error);
      var access_token = JSON.parse(body).access_token;
      var args = {
        agreements: agreements,
        access_token: access_token
      };

      lookup(args, function (usernames) {
        resolve({
          body: {
            usernames: usernames
          }
        });
      });
    });
  });
}

function lookup (args, callback) {
  var agreements = args.agreements;
  var usernames = [];

  // Lookup github usernames for each agreement in the list and return the consolidated response
  async.each(agreements, function (agreement, callback) {
    lookupSingleAgreement(args, agreement, function (users) {
      usernames = Array.from(new Set(usernames.concat(users)));
      callback();
    });
  }, function (err) {
    if (err) {
      console.log('Error:' + err);
      callback(err);
    } else {
      callback(usernames);
    }
  });
}

function lookupSingleAgreement (args, agreement, callback) {
  var access_token = args.access_token;

  var options = {
    method: 'GET',
    url: 'https://api.na1.echosign.com:443/api/rest/v5/agreements/' + agreement + '/formData',
    headers: {
      'cache-control': 'no-cache',
      Authorization: 'Bearer ' + access_token
    }
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    // Logic to parse CSV and get the value for Custom Field 8 or Custom Field 1 or githubUsername

    parse(body.trim(), {
      columns: true
    }, function (_, records) {
      var usernames = [];
      var data = records[0];
      if (data['Custom Field 8'] !== undefined) {
        usernames = data['Custom Field 8'].split(/[\s,\n]+/);
      } else if (data['Custom Field 1'] !== undefined) {
        usernames.push(data['Custom Field 1']);
      } else if (data.githubUsername !== undefined) {
        usernames.push(data.githubUsername);
      }
      callback(usernames);
    });
  });
}

exports.main = main;
