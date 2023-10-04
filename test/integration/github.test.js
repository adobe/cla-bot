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

if (!process.env.TEST_ONE_PAC) throw new Error('environment variable `TEST_ONE_PAC` not present, aborting. This is required for integration tests against GitHub.com.');
if (!process.env.TEST_TWO_PAC) throw new Error('environment variable `TEST_TWO_PAC` not present, aborting. This is required for integration tests against GitHub.com.');
if (!process.env.TEST_FOUR_PAC) throw new Error('environment variable `TEST_FOUR_PAC` not present, aborting. This is required for integration tests against GitHub.com.');
if (!process.env.TEST_MAJ_PAC) throw new Error('environment variable `TEST_MAJ_PAC` not present, aborting. This is required for integration tests against GitHub.com.');
if (!process.env.TEST_MAJ583_PAC) throw new Error('environment variable `TEST_MAJ583_PAC` not present, aborting. This is required for integration tests against GitHub.com.');
/*
 * description of what the github.com personal access tokens above represent:
 * - TEST_ONE_PAC: PAC for account adobeiotest1. Adobe ICLA signed. not a member
 *   of any orgs.
 * - TEST_TWO_PAC: PAC for account adobeiotest2. Adobe CCLA signed. not a member
 *   of any orgs.
 * - TEST_FOUR_PAC: PAC for account adobeiotest4. Adobe CCLA signed. member of
 *   the adobe org and magento org (and part of magento-employees team).
 * - TEST_MAJ_PAC: PAC for account majtest. no CLA signed. not a member of any
 *   orgs. added as a _collaborator_ on magento/devops-cla-test and
 *   magento/devops-cla-test-adcb
 * - TEST_MAJ583_PAC: PAC for account majtest583. no CLA signed. member of
 *   magento and the community-contributors team.
 */

const ADOBE_REPO = 'cla-bot-playground';
const PRIVATE_MAGENTO_REPO = 'devops-cla-test';
const PUBLIC_MAGENTO_REPO = 'devops-cla-test-public';

function createBranch (github, user, repo, newBranch) {
  return async function () {
    console.log('\n[setup]');
    console.log(`Getting ${user}/${repo} HEAD reference...`);
    const headRef = await github.git.getRef({
      owner: user,
      repo,
      ref: 'heads/master'
    });
    const headSha = headRef.data.object.sha;
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
  const findStagingBot = (suite) => suite && suite.app && suite.app.name && suite.app.name === 'Adobe CLA Bot Staging' && suite.conclusion != null;

  while (checks.total_count === 0 || !checks.check_suites.some(findStagingBot)) {
    console.log(`Waiting 2s for CLA Bot Staging check to land on ${owner}/${repo}#${ref}...`);
    await sleep(2000);
    const data = await github.checks.listSuitesForRef({ owner, repo, ref });
    checks = data.data;
  }
  return checks.check_suites.find(findStagingBot);
}

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

describe('github integration tests', () => {
  describe('pull requests from user with no signed cla nor member of any org (account majtest)', () => {
    const user = 'majtest';
    const newBranch = '' + new Date().valueOf();
    const github = new Octokit({
      auth: process.env.TEST_MAJ_PAC
    });
    it('should deny a pull request to an adobe repo', async () => {
      const setup = createBranch(github, user, ADOBE_REPO, newBranch);
      await setup();
      console.log(`Creating pull request to adobe/${ADOBE_REPO}...`);
      const pr = await github.pulls.create({
        owner: 'adobe',
        repo: ADOBE_REPO,
        title: `testing build ${newBranch}`,
        head: `${user}:${newBranch}`,
        base: 'master'
      });
      const suite = await waitForCheck(github, 'adobe', ADOBE_REPO, pr.data.head.sha);
      expect(suite.conclusion).not.toEqual('success');
      const teardown = deleteBranch(github, user, ADOBE_REPO, newBranch);
      await teardown();
    });
    it('should deny a pull request to a magento repo', async () => {
      const setup = createBranch(github, user, PUBLIC_MAGENTO_REPO, newBranch);
      await setup();
      console.log(`Creating pull request to magento/${PUBLIC_MAGENTO_REPO}...`);
      const pr = await github.pulls.create({
        owner: 'magento',
        repo: PUBLIC_MAGENTO_REPO,
        title: `testing build ${newBranch}`,
        head: `${user}:${newBranch}`,
        base: 'master'
      });
      const suite = await waitForCheck(github, 'magento', PUBLIC_MAGENTO_REPO, pr.data.head.sha);
      expect(suite.conclusion).not.toEqual('success');
      const teardown = deleteBranch(github, user, PUBLIC_MAGENTO_REPO, newBranch);
      await teardown();
    });
  });
  describe('pull requests from user with a signed Adobe ICLA (account adobeiotest1)', () => {
    const user = 'adobeiotest1';
    const newBranch = '' + new Date().valueOf();
    const github = new Octokit({
      auth: process.env.TEST_ONE_PAC
    });
    it('should approve a pull request to an adobe repo', async () => {
      const setup = createBranch(github, user, ADOBE_REPO, newBranch);
      await setup();
      console.log(`Creating pull request to adobe/${ADOBE_REPO}...`);
      const pr = await github.pulls.create({
        owner: 'adobe',
        repo: ADOBE_REPO,
        title: `testing build ${newBranch}`,
        head: `${user}:${newBranch}`,
        base: 'master'
      });
      const suite = await waitForCheck(github, 'adobe', ADOBE_REPO, pr.data.head.sha);
      expect(suite.conclusion).toEqual('success');
      const teardown = deleteBranch(github, user, ADOBE_REPO, newBranch);
      await teardown();
    });
    it('should approve a pull request to a public magento repo', async () => {
      const setup = createBranch(github, user, PUBLIC_MAGENTO_REPO, newBranch);
      await setup();
      console.log(`Creating pull request to magento/${PUBLIC_MAGENTO_REPO}...`);
      const pr = await github.pulls.create({
        owner: 'magento',
        repo: PUBLIC_MAGENTO_REPO,
        title: `testing build ${newBranch}`,
        head: `${user}:${newBranch}`,
        base: 'master'
      });
      const suite = await waitForCheck(github, 'magento', PUBLIC_MAGENTO_REPO, pr.data.head.sha);
      expect(suite.conclusion).toEqual('success');
      const teardown = deleteBranch(github, user, PUBLIC_MAGENTO_REPO, newBranch);
      await teardown();
    });
  });
  describe('pull requests from user with a signed Adobe CCLA (account adobeiotest2)', () => {
    const user = 'adobeiotest2';
    const newBranch = '' + new Date().valueOf();
    const github = new Octokit({
      auth: process.env.TEST_TWO_PAC
    });
    it('should approve a pull request to an adobe repo', async () => {
      const setup = createBranch(github, user, ADOBE_REPO, newBranch);
      await setup();
      console.log(`Creating pull request to adobe/${ADOBE_REPO}...`);
      const pr = await github.pulls.create({
        owner: 'adobe',
        repo: ADOBE_REPO,
        title: `testing build ${newBranch}`,
        head: `${user}:${newBranch}`,
        base: 'master'
      });
      const suite = await waitForCheck(github, 'adobe', ADOBE_REPO, pr.data.head.sha);
      expect(suite.conclusion).toEqual('success');
      const teardown = deleteBranch(github, user, ADOBE_REPO, newBranch);
      await teardown();
    });
    it('should approve a pull request to a public magento repo', async () => {
      const setup = createBranch(github, user, PUBLIC_MAGENTO_REPO, newBranch);
      await setup();
      console.log(`Creating pull request to magento/${PUBLIC_MAGENTO_REPO}...`);
      const pr = await github.pulls.create({
        owner: 'magento',
        repo: PUBLIC_MAGENTO_REPO,
        title: `testing build ${newBranch}`,
        head: `${user}:${newBranch}`,
        base: 'master'
      });
      const suite = await waitForCheck(github, 'magento', PUBLIC_MAGENTO_REPO, pr.data.head.sha);
      expect(suite.conclusion).toEqual('success');
      const teardown = deleteBranch(github, user, PUBLIC_MAGENTO_REPO, newBranch);
      await teardown();
    });
  });
  describe('pull requests from a user who is a member of the magento org but not the magento-employees team and with no signed CLAs (account MajTest583)', () => {
    const user = 'MajTest583';
    const newBranch = '' + new Date().valueOf();
    const github = new Octokit({
      auth: process.env.TEST_MAJ583_PAC
    });
    it('should deny a pull request to a public magento repo', async () => {
      const setup = createBranch(github, user, PUBLIC_MAGENTO_REPO, newBranch);
      await setup();
      console.log(`Creating pull request to magento/${PUBLIC_MAGENTO_REPO}...`);
      const pr = await github.pulls.create({
        owner: 'magento',
        repo: PUBLIC_MAGENTO_REPO,
        title: `testing build ${newBranch}`,
        head: `${user}:${newBranch}`,
        base: 'master'
      });
      const suite = await waitForCheck(github, 'magento', PUBLIC_MAGENTO_REPO, pr.data.head.sha);
      expect(suite.conclusion).not.toEqual('success');
      const teardown = deleteBranch(github, user, PUBLIC_MAGENTO_REPO, newBranch);
      await teardown();
    });
    it('should deny a pull request to a private magento repo', async () => {
      const setup = createBranch(github, user, PRIVATE_MAGENTO_REPO, newBranch);
      await setup();
      console.log(`Creating pull request to magento/${PRIVATE_MAGENTO_REPO}...`);
      const pr = await github.pulls.create({
        owner: 'magento',
        repo: PRIVATE_MAGENTO_REPO,
        title: `testing build ${newBranch}`,
        head: `${user}:${newBranch}`,
        base: 'master'
      });
      const suite = await waitForCheck(github, 'magento', PRIVATE_MAGENTO_REPO, pr.data.head.sha);
      expect(suite.conclusion).not.toEqual('success');
      const teardown = deleteBranch(github, user, PRIVATE_MAGENTO_REPO, newBranch);
      await teardown();
    });
  });
  describe('merge queues', () => {
    const user = 'adobeiotest2';
    const newBranch = '' + new Date().valueOf();
    const github = new Octokit({
      auth: process.env.TEST_TWO_PAC
    });
    it('should approve a check_request from a merge group bot', async () => {
      const setup = createBranch(github, user, ADOBE_REPO, newBranch);
      await setup();
      console.log(`Creating pull request to adobe/${ADOBE_REPO}...`);
      const pr = await github.pulls.create({
        owner: 'adobe',
        repo: ADOBE_REPO,
        title: `testing build ${newBranch}`,
        head: `${user}:${newBranch}`,
        base: 'mergeq'
      });
      const suite = await waitForCheck(github, 'adobe', ADOBE_REPO, pr.data.head.sha);
      expect(suite.conclusion).toEqual('success');
      const commit = await github.pulls.merge({ // might be how we api merge queue?
        owner: 'adobe',
        repo: ADOBE_REPO,
        pull_number: pr.data.number
      });
      const suite2 = await waitForCheck(github, 'adobe', ADOBE_REPO, commit.data.sha); // might be how we check the sha?
      expect(suite2.conclusion).toEqual('success');
      const teardown = deleteBranch(github, user, ADOBE_REPO, newBranch);
      await teardown();
    });
  });
});
