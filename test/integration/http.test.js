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

const fetch = require('node-fetch');
const BASE = `https://adobeioruntime.net/api/v1/web/io-solutions/default`;

describe('HTTP integration tests', () => {
  describe('checker', () => {
    const URL = `${BASE}/cla-checker-stage`;
    it('should respond with a 202 and body should say ignoring when not a PR event', async () => {
      let res = await fetch(URL, {
        method: 'post',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });
      expect(res.status).toBe(202);
      let text = await res.text();
      expect(text).toContain('ignoring');
    });
  });
});
