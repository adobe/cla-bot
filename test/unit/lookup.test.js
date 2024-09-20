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
const lookup = require('../../lookup/lookup.js');

describe('lookup action', function () {
  describe('failure', function () {
    it('should reject if parameters do not contain agreements', async function () {
      const result = await lookup.main({});
      expect(result.error).toContain('not found');
    });
  });
  describe('happy path', function () {
    beforeEach(function () {
      jest.spyOn(utils, 'get_adobe_sign_access_token').mockResolvedValue({ access_token: 'gimme ze access codes!' });
    });

    afterEach(function () {
      jest.restoreAllMocks();
    });

    it('should be able to handle a single agreement', async function () {
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, access_token: 'yes', text: () => 'Custom Field 8\nsteve' });
      const params = {
        agreements: '12345'
      };
      const result = await lookup.main(params);
      expect(result.body.usernames).toContain('steve');
    });
    it('should be able to handle multiple agreements', async function () {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce({ ok: true, status: 200, access_token: 'yes', text: () => 'Custom Field 8\nsteve' })
        .mockResolvedValueOnce({ ok: true, status: 200, access_token: 'yes', text: () => 'Custom Field 8\nmary' });
      const params = {
        agreements: ['12345', '43561']
      };
      const result = await lookup.main(params);
      expect(result.body.usernames.length).toBe(2);
    });
  });
});
