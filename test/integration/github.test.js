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
if (!process.env.TEST_MAJ_PAC) throw new Error('environment variable `TEST_MAJ_PAC` not present, aborting. This is required for integration tests against GitHub.com.');

function createBranch (github, user, repo, newBranch) {
  return async function () {
    console.log('\n[setup]');
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
      branch: newBranch,
      message: 'adding new file',
      content: Buffer.from('random contents').toString('base64')
    });
  };
}
function deleteBranch (github, user, repo, newBranch) {
  return async function () {
    console.log('\n[teardown]');
    console.log(`Deleting branch ${newBranch} on ${user}/${repo}...`);
    await github.git.deleteRef({
      owner: user,
      repo,
      ref: `heads/${newBranch}`
    });
  };
}

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForCheck (github, owner, repo, ref) {
  let checks = { total_count: 0, check_suites: [] };
  let findStagingBot = (suite) => suite && suite.app && suite.app.name && suite.app.name === 'Adobe CLA Bot Staging';

  while (checks.total_count === 0 || !checks.check_suites.some(findStagingBot)) {
    console.log(`Waiting 2s for CLA Bot Staging check to land on ${owner}/${repo}#${ref}...`);
    await sleep(2000);
    let data = await github.checks.listSuitesForRef({ owner, repo, ref });
    checks = data.data;
  }
  return checks.check_suites.find(findStagingBot);
}

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

describe('github integration tests', () => {
  describe('pull requests from user with no signed cla nor member of any org (account majtest)', () => {
    const user = 'majtest';
    const repo = 'cla-bot-playground';
    const newBranch = '' + new Date().valueOf();
    const github = new Octokit({
      auth: process.env.TEST_MAJ_PAC
    });
    beforeAll(createBranch(github, user, repo, newBranch));
    afterAll(deleteBranch(github, user, repo, newBranch));
    it('should deny a pull request to an adobe repo from author with no signed cla nor org membership', async () => {
      console.log('Creating pull request...');
      let pr = await github.pulls.create({
        owner: 'adobe',
        repo,
        title: `testing build ${newBranch}`,
        head: `${user}:${newBranch}`,
        base: 'master'
      });
      let suite = await waitForCheck(github, 'adobe', repo, pr.data.head.sha);
      expect(suite.conclusion).not.toEqual('success');
    });
  });
  describe('pull requests from user in the adobe org (account adobeiotest4)', () => {
    const user = 'adobeiotest4';
    const repo = 'cla-bot-playground';
    const newBranch = '' + new Date().valueOf();
    const github = new Octokit({
      auth: process.env.TEST_FOUR_PAC
    });
    beforeAll(createBranch(github, user, repo, newBranch));
    afterAll(deleteBranch(github, user, repo, newBranch));
    it('should approve a pull request to an adobe repo from an adobe org member', async () => {
      console.log('Creating pull request...');
      let pr = await github.pulls.create({
        owner: 'adobe',
        repo,
        title: `testing build ${newBranch}`,
        head: `${user}:${newBranch}`,
        base: 'master'
      });
      let suite = await waitForCheck(github, 'adobe', repo, pr.data.head.sha);
      expect(suite.conclusion).toEqual('success');
    });
  });
});
