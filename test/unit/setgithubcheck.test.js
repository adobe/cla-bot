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
jest.mock('../../setgithubcheck/node_modules/github-app', () => {
  return jest.fn().mockImplementationOnce(() => {
    return {
      asInstallation: async () => {
        return {
          checks: {
            create: async () => {
              throw new Error('boom!');
            }
          }
        };
      }
    };
  }).mockImplementationOnce(() => {
    return {
      asInstallation: async () => {
        return {
          checks: {
            create: async (options) => {
              return { title: options.output.title };
            }
          }
        };
      }
    };
  });
});

const setgithubcheck = require('../../setgithubcheck/setgithubcheck.js');

describe('setgithubcheck action', function () {
  it('should fail if creating a check fails', async function () {
    const result = await setgithubcheck.main({});
    expect(result.statusCode).toEqual(500);
    expect(result.body.error.toString()).toContain('boom!');
  });

  it('should return title parameter if check passes', async function () {
    const result = await setgithubcheck.main({ title: 'batman' });
    expect(result.title).toBe('batman');
  });
});
