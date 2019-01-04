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
/* eslint-env mocha */
var assert = require('assert');
var checker = require('./checker.js');
var openwhisk = require('openwhisk');
var ow;

/**
 * Create a function which delegates to openwhisk to run a function f
 */
function makeAdapter (f) {
  return function (params) {
    return ow.actions.invoke({ name: f,
      blocking: true,
      result: true,
      params: params });
  };
}

/**
 * For each function in an object, create an openwhisk adapter.
 * return an object with each adapter function.
 */
function adapt (obj) {
  var adapter = {};
  for (var p in obj) {
    adapter[p] = makeAdapter(p);
  }
  return adapter;
}

describe('checker action', function () {
  before(function () {
    if (process.env.TEST_OPENWHISK) {
      var options = { apihost: process.env.OPENWHISK_HOST,
        api_key: process.env.OW_AUTH_KEY };
      ow = openwhisk(options);
      checker = adapt(checker, ow);
    }
  });

  it('should return 400 if no pull_request property exists', function () {
    var params = {};
    return checker.main(params).then(function (result) {
      assert.strictEqual(result.statusCode, 400);
      assert(result.body.includes('Not a pull request'));
    }).catch(function () {
      assert(false);
    });
  });
});
