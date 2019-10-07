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
const setgithubcheck = rewire('../../setgithubcheck/setgithubcheck.js');

describe('setgithubcheck action', function () {
  let revert_github_app_mock, app_spy, github_api_stub; // stubbing github app / api calls
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
  it('should fail if creating a check fails', async function () {
    github_api_stub.checks.create.and.returnValue(Promise.reject(new Error('boom!')));
    const result = await setgithubcheck.main({});
    expect(result.statusCode).toEqual(500);
    expect(result.body.error.toString()).toContain('boom!');
  });
  it('should return title parameter if check passes', async function () {
    github_api_stub.checks.create.and.returnValue(Promise.resolve({}));
    const result = await setgithubcheck.main({ title: 'batman' });
    expect(result.title).toBe('batman');
  });
});
