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

const { Octokit } = require('@octokit/rest');

if (!process.env.TEST_ONE_PAC) throw new Error('environment variable `TEST_ONE_PAC` not present, aborting. This is required for integration tests against GitHub.com.');
if (!process.env.TEST_TWO_PAC) throw new Error('environment variable `TEST_TWO_PAC` not present, aborting. This is required for integration tests against GitHub.com.');
if (!process.env.TEST_THREE_PAC) throw new Error('environment variable `TEST_THREE_PAC` not present, aborting. This is required for integration tests against GitHub.com.');
// if (!process.env.TEST_FOUR_PAC) throw new Error('environment variable `TEST_FOUR_PAC` not present, aborting. This is required for integration tests against GitHub.com.');
// if (!process.env.TEST_FIVE_PAC) throw new Error('environment variable `TEST_FIVE_PAC` not present, aborting. This is required for integration tests against GitHub.com.');
/*
 * description of what the github.com personal access tokens above represent:
 * - TEST_ONE_PAC: PAC for account adobetester1. Adobe ICLA signed. not a member
 *   of any orgs.
 * - TEST_TWO_PAC: PAC for account adobetester2. Adobe CCLA signed. not a member
 *   of any orgs.
 * - TEST_THREE_PAC: PAC for account adobetester3. Adobe CCLA signed. member of
 *   the adobe org and magento org (and part of magento-employees team).
 * - TEST_Four_PAC: PAC for account adobetester4. no CLA signed. not a member of any
 *   orgs. added as a _collaborator_ on magento/devops-cla-test and
 *   magento/devops-cla-test-adcb
 * - TEST_FIVE_PAC: PAC for account adobetester5. no CLA signed. member of
 *   magento and the community-contributors team.
 */

const ADOBE_REPO = 'cla-bot-playground';
const PRIVATE_MAGENTO_REPO = 'devops-cla-test';
const PUBLIC_MAGENTO_REPO = 'devops-cla-test-public';

function createBranch (github, user, repo, newBranch) {
  return async function () {
    console.log('\n[setup]');
    console.log(`Getting ${user}/${repo} HEAD reference...`);
    const headRef = await github.rest.git.getRef({
      owner: user,
      repo,
      ref: 'heads/master'
    });
    const headSha = headRef.data.object.sha;
    console.log(`Creating branch ${newBranch} on ${user}/${repo}...`);
    await github.rest.git.createRef({
      owner: user,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha: headSha
    });
    console.log(`Creating file on branch ${newBranch} on ${user}/${repo}...`);
    await github.rest.repos.createOrUpdateFileContents({
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

// integration tests not working yet, partially due to github blocking the accounts as bots
// partially due to not being able to see all logs associated with the checks for debugging
// I have temp support for adobetester1, not sure about the rest
describe.skip('github integration tests', () => {
  describe('pull requests from user with no signed cla nor member of any org (account adobetester4)', () => {
    const user = 'adobetester4';
    const newBranch = '' + new Date().valueOf();
    const github = new Octokit({
      auth: process.env.TEST_FOUR_PAC
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
    const user = 'adobetester1';
    const newBranch = '' + new Date().valueOf();
    const github = new Octokit({
      auth: process.env.TEST_ONE_PAC
    });
    // use only on this test first
    it('should approve a pull request to an adobe repo', async () => {
      const userdata = await github.rest.rateLimit.get();
      console.log(userdata.data.resources.core);
      const setup = createBranch(github, user, ADOBE_REPO, newBranch);
      await setup();
      console.log(`Creating pull request to adobe/${ADOBE_REPO}...`);
      const pr = await github.rest.pulls.create({
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
      const pr = await github.rest.pulls.create({
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
  describe('pull requests from a user who is a member of the magento org but not the magento-employees team and with no signed CLAs (account adobetester5)', () => {
    const user = 'adobetester5';
    const newBranch = '' + new Date().valueOf();
    const github = new Octokit({
      auth: process.env.TEST_FIVE_PAC
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
});
