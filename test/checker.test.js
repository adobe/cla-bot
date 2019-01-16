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
    it('should return 202 if pull_request property exists but action is "review_requested" or "edited"', function (done) {
      var params = { pull_request: { blah: true }, action: 'review_requested' };
      return checker.main(params).then(function (result) {
        expect(result.statusCode).toBe(202);
        expect(result.body).toContain('Not a pull request');
        params.action = 'edited';
        checker.main(params).then(function (result) {
          expect(result.statusCode).toBe(202);
          expect(result.body).toContain('Not a pull request');
          done();
        }).catch(function () {
          fail('Unexpected promise failure');
        });
      }).catch(function () {
        fail('Unexpected promise failure');
      });
    });
  });
  describe('happy path (setting some manner of useful github check to the user)', function () {
    var revert_github_app_mock, app_spy, github_api_stub; // stubbing github app / api calls
    var revert_openwhisk_mock, openwhisk_stub; // stubbing github app / api calls
    var revert_request_mock, request_spy; // stubbing request module
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
      request_spy = jasmine.createSpy('request spy');
      revert_request_mock = checker.__set__('request', request_spy);
    });
    afterEach(function () {
      revert_github_app_mock();
      revert_openwhisk_mock();
      revert_request_mock();
    });
    it('should proceed with processing webhook events like pr opened, reopened and synchronize', function (done) {
      github_api_stub.orgs.checkMembership.and.returnValue(Promise.resolve({
        status: 204
      }));
      openwhisk_stub.actions.invoke.and.returnValue(Promise.resolve({}));
      var events = ['opened', 'reopened', 'synchronize'];
      var params = events.map(function (event) {
        return {
          pull_request: {
            user: { login: 'hiren' },
            base: { repo: {
              owner: { login: 'adobe' },
              name: 'photoshop'
            } },
            head: { sha: '12345' }
          },
          action: event,
          installation: { id: '5431' }
        };
      });
      var promises = params.map(function (param) {
        return checker.main(param).then(function (response) {
          expect(response.statusCode).toBe(200);
        }).catch(function (err) {
          fail(err);
        });
      });
      Promise.all(promises).then(done);
    });
    it('should invoke the setgithubcheck action with a status of completed if user is a member of org', function (done) {
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
      return checker.main(params).then(function (response) {
        var action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('Adobe Employee');
        expect(response.statusCode).toBe(200);
        done();
      }).catch(function (err) {
        fail(err);
      });
    });
    it('should invoke the setgithubcheck action with a status of completed if user is not a member of org but has signed a cla', function (done) {
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
      github_api_stub.orgs.checkMembership.and.returnValue(Promise.reject({
        code: 404,
        message: 'hiren is not a member of the organization'
      }));
      request_spy.and.callFake(function (options, cb) {
        if (options.url.includes('agreements')) {
          cb(null, { statusCode: 200 }, { userAgreementList: [{
            status: 'SIGNED',
            name: 'Adobe CLA',
            agreementId: '123'
          }] });
        } else {
          cb(null, { statusCode: 200 }, '{"access_token":"yes"}');
        }
      });
      openwhisk_stub.actions.invoke.and.callFake(function (params) {
        if (params.name === 'cla-lookup') {
          return Promise.resolve({
            body: {
              usernames: ['hiren']
            }
          });
        } else {
          // we are invoking setgithubcheck here
          return Promise.resolve({});
        }
      });
      return checker.main(params).then(function (response) {
        var action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('CLA Signed');
        expect(response.statusCode).toBe(200);
        done();
      }).catch(function (err) {
        fail(err);
      });
    });
    it('should invoke the setgithubcheck action with a conclusion of action_required if user is not a member of org and no agreements are found containing the user\'s github username', function (done) {
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
      github_api_stub.orgs.checkMembership.and.returnValue(Promise.reject({
        code: 404,
        message: 'hiren is not a member of the organization'
      }));
      request_spy.and.callFake(function (options, cb) {
        if (options.url.includes('agreements')) {
          cb(null, { statusCode: 200 }, { userAgreementList: [{
            status: 'SIGNED',
            name: 'Adobe CLA',
            agreementId: '123'
          }] });
        } else {
          cb(null, { statusCode: 200 }, '{"access_token":"yes"}');
        }
      });
      openwhisk_stub.actions.invoke.and.callFake(function (params) {
        if (params.name === 'cla-lookup') {
          return Promise.resolve({
            body: {
              usernames: ['steven']
            }
          });
        } else {
          // we are invoking setgithubcheck here
          return Promise.resolve({});
        }
      });
      return checker.main(params).then(function (response) {
        var action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
        done();
      }).catch(function (err) {
        fail(err);
      });
    });
    it('should invoke the setgithubcheck action with a conclusion of action_required if user is not a member of org and no signed CLAs are found exactly matching the user\'s github username', function (done) {
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
      github_api_stub.orgs.checkMembership.and.returnValue(Promise.reject({
        code: 404,
        message: 'hiren is not a member of the organization'
      }));
      request_spy.and.callFake(function (options, cb) {
        if (options.url.includes('agreements')) {
          cb(null, { statusCode: 200 }, { userAgreementList: [] });
        } else {
          cb(null, { statusCode: 200 }, '{"access_token":"yes"}');
        }
      });
      openwhisk_stub.actions.invoke.and.returnValue(Promise.resolve({}));
      return checker.main(params).then(function (response) {
        var action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
        done();
      }).catch(function (err) {
        fail(err);
      });
    });
  });
});
