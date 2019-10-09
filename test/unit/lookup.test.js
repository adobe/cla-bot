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

const utils = require('../../utils.js');
const rewire = require('rewire');
let lookup = rewire('../../lookup/lookup.js');

describe('lookup action', function () {
  describe('failure', function () {
    it('should reject if parameters do not contain agreements', async function () {
      let result = await lookup.main({});
      expect(result.error).toContain('not found');
    });
  });
  describe('happy path', function () {
    let revert_request_mock, request_spy; // stubbing request module
    let revert_parse_mock, parse_spy; // stubbing csv-parse module
    let revert_access_token_mock;
    beforeEach(function () {
      revert_access_token_mock = spyOn(utils, 'get_adobe_sign_access_token').and.returnValue(Promise.resolve({ access_token: 'gimme ze access codes!' }));
      // TODO: fix spy to implement .abort() and assert that it's called
      request_spy = jasmine.createSpy('request spy').and.callFake(function (options) {
        if (options.url.includes('oauth/refresh')) {
          return Promise.resolve({ access_token: 'yes' });
        } else {
          return Promise.resolve('this will not be used');
        }
      });
      revert_request_mock = lookup.__set__('request', request_spy);
      let count = 1;
      parse_spy = jasmine.createSpy('parse spy').and.callFake(function () {
        return Promise.resolve([{ githubUsername: 'steve' + count++ }]);
      });
      revert_parse_mock = lookup.__set__('parse', parse_spy);
    });
    afterEach(function () {
      revert_access_token_mock();
      revert_request_mock();
      revert_parse_mock();
    });
    it('should be able to handle a single agreement', async function () {
      const params = {
        agreements: '12345',
        username: 'steve1'
      };
      let result = await lookup.main(params);
      expect(result.body.usernames).toEqual(['steve1']);
    });
    it('should be able to handle multiple agreements when the first one matches', async function () {
      const params = {
        agreements: ['12345', '43561'],
        username: 'steve1'
      };
      let result = await lookup.main(params);
      expect(result.body.usernames).toEqual(['steve1']);
    });
    it('should be able to handle multiple agreements when the last one matches', async function () {
      const params = {
        agreements: ['12345', '99453'],
        username: 'steve2'
      };
      let result = await lookup.main(params);
      expect(result.body.usernames).toEqual(['steve2']);
    });
    it('should be able to handle multiple agreements when none match', async function () {
      const params = {
        agreements: ['12345', '99453'],
        username: 'bob'
      };
      let result = await lookup.main(params);
      expect(result.body.usernames).toEqual([]);
    });
  });
});
