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
const request = require('request-promise-native');

module.exports = {
  CHECKER: 'cla-checker',
  LOOKUP: 'cla-lookup',
  SETGITHUBCHECK: 'cla-setgithubcheck',
  SIGNWEBHOOK: 'cla-signwebhook',
  get_config: function () {
    const fs = require('fs');
    const path = require('path');
    const config_path = path.join(__dirname, 'config.json');
    let config;
    if (fs.existsSync(config_path)) {
      config = require(config_path);
    } else if (process.env.SIGN_REFRESH_TOKEN && process.env.SIGN_CLIENT_ID && process.env.SIGN_CLIENT_SECRET && process.env.GITHUB_KEY && process.env.GITHUB_APP_ID) {
      config = {
        signRefreshToken: process.env.SIGN_REFRESH_TOKEN,
        signClientID: process.env.SIGN_CLIENT_ID,
        signClientSecret: process.env.SIGN_CLIENT_SECRET,
        githubKey: process.env.GITHUB_KEY,
        githubAppId: process.env.GITHUB_APP_ID
      };
    } else if (process.env.NODE_ENV === 'test' || (process.env.TRAVIS_PULL_REQUEST && process.env.TRAVIS_PULL_REQUEST.length)) {
      config = {};
    } else {
      throw new Error('no config file nor environment variables exist for populating configuration');
    }
    return config;
  },
  get_adobe_sign_access_token: async function (config) {
    const options = {
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
    const response = await request(options);
    return response;
  },
  action_error: function (e, msg) {
    return {
      statusCode: 500,
      body: {
        error: e,
        reason: msg
      }
    };
  }
};
