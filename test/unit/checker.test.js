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

const rewire = require('rewire');
const checker = rewire('../../checker/checker.js');
const utils = require('../../utils.js');

describe('checker action', function () {
  describe('ignored events', function () {
    it('should return 202 if no pull_request property exists', async function () {
      const params = {};
      const result = await checker.main(params);
      expect(result.statusCode).toBe(202);
      expect(result.body).toContain('Not a pull request');
    });
    it('should return 202 if pull_request property exists but action is "review_requested" or "edited"', async function () {
      const params = { pull_request: { blah: true }, action: 'review_requested' };
      let result = await checker.main(params);
      expect(result.statusCode).toBe(202);
      expect(result.body).toContain('Not a pull request');
      params.action = 'edited';
      result = await checker.main(params);
      expect(result.statusCode).toBe(202);
      expect(result.body).toContain('Not a pull request');
    });
  });
  describe('happy path (setting some manner of useful github check to the user)', function () {
    let revert_github_app_mock, app_spy, github_api_stub; // stubbing github app / api calls
    let revert_openwhisk_mock, openwhisk_stub; // stubbing invoking other actions
    let revert_request_mock, request_spy; // stubbing request module
    let revert_access_token_mock;
    beforeEach(function () {
      revert_access_token_mock = spyOn(utils, 'get_adobe_sign_access_token').and.returnValue(Promise.resolve({ access_token: 'token!' }));
      github_api_stub = {
        orgs: {
          checkMembership: jasmine.createSpy('orgs.checkMembership spy'),
          checkPublicMembership: jasmine.createSpy('orgs.checkPublicMembership spy')
        },
        teams: {
          getMembership: jasmine.createSpy('team.getMembership spy')
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
      revert_access_token_mock();
      revert_github_app_mock();
      revert_openwhisk_mock();
      revert_request_mock();
    });
    it('should proceed with processing webhook events like pr opened, reopened and synchronize', async function () {
      github_api_stub.orgs.checkMembership.and.returnValue(Promise.resolve({
        status: 204
      }));
      openwhisk_stub.actions.invoke.and.returnValue(Promise.resolve({}));
      const events = ['opened', 'reopened', 'synchronize'];
      const params = events.map(function (event) {
        return {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobe' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: event,
          installation: { id: '5431' }
        };
      });
      await Promise.all(params.map(async function (param) {
        const result = await checker.main(param);
        expect(result.statusCode).toBe(200);
      }));
    });
    it('should invoke the setgithubcheck action with a status of completed if user is a bot', async function () {
      const params = {
        pull_request: {
          user: { login: 'greenkeeper', type: 'Bot' },
          base: {
            repo: {
              owner: { login: 'adobe' },
              name: 'photoshop'
            }
          },
          head: { sha: '12345' }
        },
        action: 'opened',
        installation: { id: '5431' }
      };
      openwhisk_stub.actions.invoke.and.returnValue(Promise.resolve({}));
      const response = await checker.main(params);
      const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
      expect(action_invoke_args.name).toBe('cla-setgithubcheck');
      expect(action_invoke_args.params.status).toBe('completed');
      expect(action_invoke_args.params.title).toContain('Bot');
      expect(response.statusCode).toBe(200);
    });
    describe('for PRs issued to the magento github organization', () => {
      it('should invoke the setgithubcheck action with a status of completed if user is a member of the magento employees team', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'magento' },
                name: 'magento2'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        github_api_stub.teams.getMembership.and.returnValue(Promise.resolve({
          status: 204
        }));
        openwhisk_stub.actions.invoke.and.returnValue(Promise.resolve({}));
        const response = await checker.main(params);
        const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('Adobe (Magento) Employee');
        expect(response.statusCode).toBe(200);
      });
      it('should invoke the setgithubcheck action with a status of completed if user is not a member of the magento org but has signed a cla', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'magento' },
                name: 'magento2'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        github_api_stub.teams.getMembership.and.returnValue(Promise.reject({
          message: 'Not Found'
        }));
        request_spy.and.callFake(function (options) {
          if (options.url.includes('agreements')) {
            return Promise.resolve({
              userAgreementList: [{
                status: 'SIGNED',
                name: 'Adobe CLA',
                agreementId: '123'
              }]
            });
          } else {
            return Promise.resolve({ access_token: 'yes' });
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
        const response = await checker.main(params);
        const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('CLA Signed');
        expect(response.statusCode).toBe(200);
      });
      it(`should invoke the setgithubcheck action with a conclusion of action_required if user is not a member of the magento org and no agreements are found containing the user's github username`, async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'magento' },
                name: 'magento2'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        github_api_stub.teams.getMembership.and.returnValue(Promise.reject({
          message: 'Not Found'
        }));
        request_spy.and.callFake(function (options) {
          if (options.url.includes('agreements')) {
            return Promise.resolve({
              userAgreementList: [{
                status: 'SIGNED',
                name: 'Adobe CLA',
                agreementId: '123'
              }]
            });
          } else {
            return Promise.resolve({ access_token: 'yes' });
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
        const response = await checker.main(params);
        const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
      });
      it('should invoke the setgithubcheck action with a conclusion of action_required if user is not a member of the magento org and zero signed CLAs exist', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'magento' },
                name: 'magento2'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        github_api_stub.teams.getMembership.and.returnValue(Promise.reject({
          message: 'Not Found'
        }));
        request_spy.and.callFake(function (options) {
          if (options.url.includes('agreements')) {
            return Promise.resolve({ userAgreementList: [] });
          } else {
            return Promise.resolve({ access_token: 'yes' });
          }
        });
        openwhisk_stub.actions.invoke.and.returnValue(Promise.resolve({}));
        const response = await checker.main(params);
        const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
      });
    });
    describe('for PRs issued to the adobe github organization', () => {
      it('should invoke the setgithubcheck action with a status of completed if user is a member of the adobe org', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobe' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        github_api_stub.orgs.checkMembership.and.returnValue(Promise.resolve({
          status: 204
        }));
        openwhisk_stub.actions.invoke.and.returnValue(Promise.resolve({}));
        const response = await checker.main(params);
        const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('Adobe Employee');
        expect(response.statusCode).toBe(200);
      });
      it('should invoke the setgithubcheck action with a status of completed if user is not a member of the adobe org but has signed a cla', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobe' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        github_api_stub.orgs.checkMembership.and.returnValue(Promise.reject({
          code: 404,
          message: 'hiren is not a member of the organization'
        }));
        request_spy.and.callFake(function (options) {
          if (options.url.includes('agreements')) {
            return Promise.resolve({
              userAgreementList: [{
                status: 'SIGNED',
                name: 'Adobe CLA',
                agreementId: '123'
              }]
            });
          } else {
            return Promise.resolve({ access_token: 'yes' });
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
        const response = await checker.main(params);
        const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('CLA Signed');
        expect(response.statusCode).toBe(200);
      });
      it(`should invoke the setgithubcheck action with a conclusion of action_required if user is not a member of the adobe org and no agreements are found containing the user's github username`, async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobe' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        github_api_stub.orgs.checkMembership.and.returnValue(Promise.reject({
          code: 404,
          message: 'hiren is not a member of the organization'
        }));
        request_spy.and.callFake(function (options) {
          if (options.url.includes('agreements')) {
            return Promise.resolve({
              userAgreementList: [{
                status: 'SIGNED',
                name: 'Adobe CLA',
                agreementId: '123'
              }]
            });
          } else {
            return Promise.resolve({ access_token: 'yes' });
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
        const response = await checker.main(params);
        const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
      });
      it('should invoke the setgithubcheck action with a conclusion of action_required if user is not a member of the adobe org and zero signed CLAs exist', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobe' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        github_api_stub.orgs.checkMembership.and.returnValue(Promise.reject({
          code: 404,
          message: 'hiren is not a member of the organization'
        }));
        request_spy.and.callFake(function (options) {
          if (options.url.includes('agreements')) {
            return Promise.resolve({ userAgreementList: [] });
          } else {
            return Promise.resolve({ access_token: 'yes' });
          }
        });
        openwhisk_stub.actions.invoke.and.returnValue(Promise.resolve({}));
        const response = await checker.main(params);
        const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
      });
    });
    describe('for PRs issued to orgs that are not github.com/adobe, but are adobe-adjacent', function () {
      it('should invoke the setgithubcheck action with a status of completed if user is NOT a member of org the PR is issued on but is a member of the adobe org', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobedocs' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        // Have the first github org check (within org) fail, but the second one
        // (in the adobe org) succeed
        github_api_stub.orgs.checkMembership.and.returnValue(Promise.reject({
          code: 404,
          message: 'hiren is not a member of the organization'
        }));
        github_api_stub.orgs.checkPublicMembership.and.returnValue(Promise.resolve({
          status: 204
        }));
        openwhisk_stub.actions.invoke.and.returnValue(Promise.resolve({}));
        const response = await checker.main(params);
        const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('Adobe Employee');
        expect(response.statusCode).toBe(200);
      });
      it('should invoke the setgithubcheck action with a status of completed if user is not a member of org the PR was issued on and not a public member of github.com/adobe org but has signed a cla', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobedocs' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        github_api_stub.orgs.checkMembership.and.returnValue(Promise.reject({
          code: 404,
          message: 'hiren is not a member of the organization'
        }));
        github_api_stub.orgs.checkPublicMembership.and.returnValue(Promise.reject({
          code: 404,
          message: 'hiren is not a public member of the organization'
        }));
        request_spy.and.callFake(function (options) {
          if (options.url.includes('agreements')) {
            return Promise.resolve({
              userAgreementList: [{
                status: 'SIGNED',
                name: 'Adobe CLA',
                agreementId: '123'
              }]
            });
          } else {
            return Promise.resolve({ access_token: 'yes' });
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
        const response = await checker.main(params);
        const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('CLA Signed');
        expect(response.statusCode).toBe(200);
      });
      it(`should invoke the setgithubcheck action with a conclusion of action_required if user is not a member of org the PR was issued on, not a public member of github.com/adobe and no agreements are found containing the user's github username`, async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobedocs' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        github_api_stub.orgs.checkMembership.and.returnValue(Promise.reject({
          code: 404,
          message: 'hiren is not a member of the organization'
        }));
        github_api_stub.orgs.checkPublicMembership.and.returnValue(Promise.reject({
          code: 404,
          message: 'hiren is not a public member of the organization'
        }));
        request_spy.and.callFake(function (options) {
          if (options.url.includes('agreements')) {
            return Promise.resolve({
              userAgreementList: [{
                status: 'SIGNED',
                name: 'Adobe CLA',
                agreementId: '123'
              }]
            });
          } else {
            return Promise.resolve({ access_token: 'yes' });
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
        const response = await checker.main(params);
        const action_invoke_args = openwhisk_stub.actions.invoke.calls.mostRecent().args[0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
      });
    });
  });
});
