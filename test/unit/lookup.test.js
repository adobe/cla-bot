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
const lookup = rewire('../../lookup/lookup.js');

describe('lookup action', function () {
  describe('failure', function () {
    it('should reject if parameters do not contain agreements', async function () {
      const result = await lookup.main({});
      expect(result.error).toContain('not found');
    });
  });
  describe('happy path', function () {
    let revert_lookup_agreement_mock, lookup_agreement_spy;
    let revert_parse_mock, parse_spy; // stubbing csv-parse module
    let revert_access_token_mock;
    let response_mock;
    beforeEach(function () {
      revert_access_token_mock = spyOn(utils, 'get_adobe_sign_access_token').and.returnValue(Promise.resolve({ access_token: 'gimme ze access codes!' }));

      response_mock = Promise.resolve('this string is ignored, but the promise will be used');
      response_mock.abort = jasmine.createSpy('abort spy');
      lookup_agreement_spy = jasmine.createSpy('lookup agreement spy').and.returnValue(response_mock);
      revert_lookup_agreement_mock = lookup.__set__('lookupAgreement', lookup_agreement_spy);

      let count = 1;
      parse_spy = jasmine.createSpy('parse spy').and.callFake(function () {
        return Promise.resolve([{ githubUsername: 'steve' + count++ }]);
      });
      revert_parse_mock = lookup.__set__('parse', parse_spy);
    });
    afterEach(function () {
      revert_lookup_agreement_mock();
      revert_access_token_mock();
      revert_parse_mock();
    });
    it('should be able to handle a single agreement', async function () {
      const params = {
        agreements: '12345',
        username: 'steve1'
      };
      const result = await lookup.main(params);
      expect(result.body.usernames).toEqual(['steve1']);
      expect(response_mock.abort).toHaveBeenCalledTimes(1);
    });
    it('should be able to handle multiple agreements when the first one matches', async function () {
      const params = {
        agreements: ['12345', '43561'],
        username: 'steve1'
      };
      const result = await lookup.main(params);
      expect(result.body.usernames).toEqual(['steve1']);
      expect(response_mock.abort).toHaveBeenCalledTimes(2);
    });
    it('should be able to handle multiple agreements when the last one matches', async function () {
      const params = {
        agreements: ['12345', '99453'],
        username: 'steve2'
      };
      let result = await lookup.main(params);
      expect(result.body.usernames).toEqual(['steve2']);
      expect(response_mock.abort).toHaveBeenCalledTimes(2);
    });
    it('should be able to handle multiple agreements when none match', async function () {
      const params = {
        agreements: ['12345', '99453'],
        username: 'bob'
      };
      let result = await lookup.main(params);
      expect(result.body.usernames).toEqual([]);
      expect(response_mock.abort).toHaveBeenCalledTimes(0);
    });
  });
});
