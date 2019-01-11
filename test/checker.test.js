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
var checker = rewire('../checker/checker.js');

describe('checker action', function () {
  describe('ignored events', function () {
    it('should return 202 if no pull_request property exists', function (done) {
      var params = {};
      return checker.main(params).then(function (result) {
        expect(result.statusCode).toBe(202);
        expect(result.body).toContain('Not a pull request');
        done();
      }).catch(function () {
        fail('Unexpected promise failure');
      });
    });
    it('should return 202 if pull_request property exists but action is not "opened"', function (done) {
      var params = { pull_request: { blah: true }, action: 'review_requested' };
      return checker.main(params).then(function (result) {
        expect(result.statusCode).toBe(202);
        expect(result.body).toContain('Not a pull request');
        done();
      }).catch(function () {
        fail('Unexpected promise failure');
      });
    });
  });
  describe('happy path', function () {
    var revert_github_app_mock, app_spy, github_api_stub; // stubbing github app / api calls
    var revert_openwhisk_mock, openwhisk_stub; // stubbing github app / api calls
    beforeEach(function () {
      github_api_stub = {
        orgs: {
          checkMembership: jasmine.createSpy('checkMembership spy')
        }
      };
      app_spy = jasmine.createSpy('github app spy').and.returnValue({
        asInstallation: jasmine.createSpy('GitHub App asInstallation spy').and.returnValue(Promise.resolve(github_api_stub))
      });
      revert_github_app_mock = checker.__set__('github_app', app_spy);
      openwhisk_stub = {
        actions: {
          invoke: jasmine.createSpy('openwhisk invoke action spy')
        }
      };
      revert_openwhisk_mock = checker.__set__('openwhisk', jasmine.createSpy('openwhisk spy').and.returnValue(openwhisk_stub));
    });
    afterEach(function () {
      revert_github_app_mock();
      revert_openwhisk_mock();
    });
    it('should invoke the setgithubcheck action with a status of completed if user is a member of org', function () {
      var params = {
        pull_request: {
          user: { login: 'hiren' },
          base: { repo: {
            owner: { login: 'adobe' },
            name: 'photoshop'
          } },
          head: { sha: '12345' }
        },
        action: 'opened',
        installation: { id: '5431' }
      };
      github_api_stub.orgs.checkMembership.and.returnValue(Promise.resolve({
        status: 204
      }));
      openwhisk_stub.actions.invoke.and.returnValue(Promise.resolve({}));
      return checker.main(params).then(function (result) {
        var action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('Adobe Employee');
      }).catch(function (err) {
        fail(err);
      });
    });
  });
});
