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

var rewire = require('rewire');
var lookup = rewire('../lookup/lookup.js');

describe('lookup action', function () {
  describe('failure', function () {
    it('should reject if parameters do not contain agreements', function (done) {
      lookup.main({}).then(function () {
        fail('unexpected promise resolution');
      }).catch(function () {
        done();
      });
    });
  });
  describe('happy path', function () {
    var revert_request_mock, request_spy; // stubbing request module
    var revert_parse_mock, parse_spy; // stubbing csv-parse module
    beforeEach(function () {
      request_spy = jasmine.createSpy('request spy').and.callFake(function (options) {
        if (options.url.includes('oauth/refresh')) {
          return Promise.resolve({ access_token: 'yes' });
        } else {
          return Promise.resolve('this will not be used');
        }
      });
      revert_request_mock = lookup.__set__('request', request_spy);
      parse_spy = jasmine.createSpy('parse spy').and.callFake(function (body, opts, cb) {
        cb(null, [{ githubUsername: 'steve' }]);
      });
      revert_parse_mock = lookup.__set__('parse', parse_spy);
    });
    afterEach(function () {
      revert_request_mock();
      revert_parse_mock();
    });
    it('should be able to handle a single agreement', function (done) {
      var params = {
        agreements: '12345'
      };
      lookup.main(params).then(function (result) {
        expect(result.body.usernames).toContain('steve');
        done();
      }).catch(function (err) {
        fail(err);
      });
    });
    it('should be able to handle multiple agreements', function (done) {
      parse_spy.and.callFake(function (body, opts, cb) {
        cb(null, [{ githubUsername: 'steve' + Math.random() }]);
      });
      var params = {
        agreements: ['12345', '43561']
      };
      lookup.main(params).then(function (result) {
        expect(result.body.usernames.length).toBe(2);
        done();
      }).catch(function (err) {
        fail(err);
      });
    });
  });
});
