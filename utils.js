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

module.exports = {
  CHECKER: 'cla-checker',
  LOOKUP: 'cla-lookup',
  SETGITHUBCHECK: 'cla-setgithubcheck',
  get_config: function () {
    var fs = require('fs');
    var path = require('path');
    var config_path = path.join(__dirname, 'config.json');
    var config;
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
  }
};
