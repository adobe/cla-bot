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
var setgithubcheck = rewire('../setgithubcheck/setgithubcheck.js');

describe('setgithubcheck action', function () {
  var revert_github_app_mock, app_spy, github_api_stub; // stubbing github app / api calls
  beforeEach(function () {
    github_api_stub = {
      checks: {
        create: jasmine.createSpy('create check spy')
      }
    };
    app_spy = jasmine.createSpy('github app spy').and.returnValue({
      asInstallation: jasmine.createSpy('GitHub App asInstallation spy').and.returnValue(Promise.resolve(github_api_stub))
    });
    revert_github_app_mock = setgithubcheck.__set__('github_app', app_spy);
  });
  afterEach(function () {
    revert_github_app_mock();
  });
  it('should fail if creating a check fails', function (done) {
    github_api_stub.checks.create.and.returnValue(Promise.reject(new Error('boom!')));
    setgithubcheck.main({}).then(function () {
      fail('unexpected promise resolution');
    }).catch(function (err) {
      expect(err.message).toContain('boom!');
      done();
    });
  });
  it('should return title parameter if check passes', function (done) {
    github_api_stub.checks.create.and.returnValue(Promise.resolve({}));
    setgithubcheck.main({ title: 'batman' }).then(function (result) {
      expect(result.title).toBe('batman');
      done();
    }).catch(function (err) {
      fail(err);
    });
  });
});
