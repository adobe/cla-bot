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

const Octokit = require('@octokit/rest');

if (!process.env.TEST_FOUR_PAC) throw new Error('environment variable `TEST_FOUR_PAC` not present, aborting. This is required for integration tests against GitHub.com.');

describe('pull requests from user in the adobe org (account adobeiotest4)', () => {
  const user = 'adobeiotest4';
  const repo = 'cla-bot-playground';
  const org = 'adobe';
  const newBranch = new Date().valueOf();
  const github = new Octokit({
    auth: process.env.TEST_FOUR_PAC
  });
  beforeAll(async () => {
    console.log(`Getting ${user}/${repo} HEAD reference...`);
    let headRef = await github.git.getRef({
      owner: user,
      repo,
      ref: 'heads/master'
    });
    let headSha = headRef.data.object.sha;
    console.log(`Creating branch ${newBranch} on ${user}/${repo}...`);
    await github.git.createRef({
      owner: user,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha: headSha
    });
    console.log(`Creating file on branch ${newBranch} on ${user}/${repo}...`);
    await github.repos.createOrUpdateFile({
      owner: user,
      repo,
      path: `${newBranch}.md`,
      message: 'adding new file',
      content: Buffer.from('file contents').toString('base64')
    });
  });
  afterAll(async () => {
    console.log(`Deleting branch ${newBranch} on ${user}/${repo}...`);
    await github.git.deleteRef({
      owner: user,
      repo,
      ref: `heads/${newBranch}`
    });
  });
  it('should do something here', (done) => {
    setTimeout(done, 1000);
  });
});
