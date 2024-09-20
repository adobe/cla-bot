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

const github_app = require('github-app');
const openwhisk = require('openwhisk');
const utils = require('../utils.js');
const config = utils.get_config();
/*
gets fired from github pr creation/update webhook.
* Check if they are adobe employee, if yes, give checkmark
* If not an employee, report back if the CLA is already signed
* if signed, give checkmark
* if not signed, give an 'x' and tell them to go sign at https://opensource.adobe.com/cla.html
*/
const valid_pr_events = ['opened', 'reopened', 'synchronize'];

async function main (params) {
  const isMergeQueue = params.merge_group && params.action === 'checks_requested';
  if (!isMergeQueue && (!params.pull_request || !valid_pr_events.includes(params.action))) {
    return {
      statusCode: 202,
      body: 'Not a pull request being (re)opened or synchronized, ignoring'
    };
  }
  let github;
  const ow = openwhisk();

  if (isMergeQueue) {
    const res = await set_green_is_bot(ow, {
      commit_sha: params.merge_group.head_sha,
      org: params.repository.owner.login,
      repo: params.repository.name,
      start_time: (new Date()).toISOString()
    });
    return res;
  }

  const user = params.pull_request.user.login;
  const start_time = (new Date()).toISOString();
  const org = params.pull_request.base.repo.owner.login;
  const repo = params.pull_request.base.repo.name;
  const commit_sha = params.pull_request.head.sha;
  const installation_id = params.installation.id;

  const args = {
    start_time: start_time,
    org: org,
    repo: repo,
    commit_sha: commit_sha,
    installation_id: installation_id,
    user: user
  };

  if (params.pull_request.user.type === 'Bot') {
    const res = await set_green_is_bot(ow, args);
    return res;
  }

  const app = github_app({
    id: config.githubAppId,
    cert: config.githubKey
  });

  try {
    github = await app.asInstallation(installation_id);
  } catch (e) {
    return utils.action_error(e, 'Error retrieving GitHub API instance on behalf of app installation.');
  }

  // Check if author is employee.
  let is_employee;
  if (org === 'magento') {
    // For the magento org, we want everyone to sign the CLA
    const res = await check_cla(ow, args);
    return res;
  } else {
    // For non-Magento orgs, as long as user is a member of the org, they are
    // considered an employee
    try {
      // checking if user is member of org, has funky logic flow:
      // if status is 204, user is a member.
      // if status is 404, user is not a member - but this triggers the catch in
      // the promise, so flow jumps down to the next catch statement.
      // more details here: https://developer.github.com/v3/orgs/members/#check-membership
      is_employee = await github.orgs.checkMembership({
        org: org,
        username: user
      });
    } catch (e) {
      if (e.code === 404 && e.message.indexOf('is not a member of the org') > -1) {
        // User is not a member of org the PR was issued on
        if (org !== 'adobe') {
          // .. but maybe they are a member of the adobe org?
          // need to use checkPublicMembership here as we don't have permissions
          // to check for private membership as we are using the installation_id
          // of the bot on the non-adobe org.
          let public_member;
          try {
            public_member = await github.orgs.checkPublicMembership({
              org: 'adobe',
              username: user
            });
          } catch (e2) {
            if (e2.code === 404 && e2.message.indexOf('is not a public member of the org') > -1) {
              // They are not a public member of Adobe org either, so now we go
              // through CLA checking process.
              const res = await check_cla(ow, args);
              return res;
            } else {
              return utils.action_error(e2, 'Error during checking of public membership in the Adobe org.');
            }
          }
          // if status is 204, user is a member.
          // if status is 404, user is not a member - but this triggers the catch in
          // the promise.
          // more details here: https://developer.github.com/v3/orgs/members/#check-public-membership
          if (public_member.status === 204) {
            const res = await set_green_is_adobe_employee(ow, args, 'adobe');
            return res;
          }
        } else {
          // This is a PR issued against the Adobe org, and they are not a
          // member so we need to check if they signed CLA
          const res = await check_cla(ow, args);
          return res;
        }
      }
    }
    if (is_employee.status === 204) {
      const res = await set_green_is_adobe_employee(ow, args, org);
      return res;
    }
  }
}

async function check_cla (ow, args) {
  // First get Adobe Sign access token
  let response;
  try {
    response = await utils.get_adobe_sign_access_token(config);
  } catch (e) {
    return utils.action_error(e, 'Error during retrieval of Adobe Sign access token.');
  }

  const access_token = response.access_token;
  if (!access_token) {
    return { statusCode: 500, body: 'Empty access_token retrieved from Adobe Sign.' };
  }

  // Next we look up signed agreements containing the author's github username in Adobe Sign
  try {
    const fetchResponse = await fetch(`https://api.na1.echosign.com:443/api/rest/v5/agreements?query=${args.user}`, {
      method: 'GET',
      headers: {
        'cache-control': 'no-cache',
        'Access-Token': access_token
      }
    });

    if (!fetchResponse.ok) {
      return utils.action_error(new Error('Failed to fetch'), 'Error retrieving Adobe Sign agreements.');
    }

    response = await fetchResponse.json();
  } catch (e) {
    return utils.action_error(e, 'Error retrieving Adobe Sign agreements.');
  }

  if (response.userAgreementList && response.userAgreementList.length) {
    // We found agreements containing the github username to search through.
    const agreements = response.userAgreementList.filter(function (agreement) {
      return (
        (agreement.status === 'SIGNED' ||
          agreement.status === 'FORM_FILLED') &&
        (agreement.name === 'Adobe Contributor License Agreement' ||
          agreement.name === 'Adobe CLA')
      );
    }).map(function (agreement) {
      return agreement.agreementId;
    });
    let lookup_res;
    // Now we defer to the lookup action to parse the specific fields inside
    // these agreements containing the github username and ensure the github
    // usernames are present inside the agreement where they should be
    try {
      lookup_res = await ow.actions.invoke({
        name: utils.LOOKUP,
        blocking: true,
        result: true,
        params: {
          agreements: agreements,
          username: args.user
        }
      });
    } catch (e) {
      return utils.action_error(e, 'Error invoking lookup action when agreements were found.');
    }

    const usernames = lookup_res.body.usernames;
    if (usernames.map(function (item) { return item.toLowerCase(); }).includes(args.user.toLowerCase())) {
      // If the username exists in the response from the lookup action, then we
      // can render a green checkmark on the PR!
      let check_res;
      try {
        check_res = await ow.actions.invoke({
          name: utils.SETGITHUBCHECK,
          blocking: true,
          result: true,
          params: {
            installation_id: args.installation_id,
            org: args.org,
            repo: args.repo,
            sha: args.commit_sha,
            status: 'completed',
            start_time: args.start_time,
            conclusion: 'success',
            title: 'CLA Signed',
            summary: 'A Signed CLA has been found for the GitHub.com user ' + args.user
          }
        });
      } catch (e) {
        return utils.action_error(e, 'Error invoking setgithubcheck when CLA was found.');
      }

      return {
        statusCode: 200,
        body: check_res.title
      };
    } else {
      try {
        const check = await action_required(ow, args);
        return check;
      } catch (e) {
        return utils.action_error(e, 'Error setting Action Required GitHub Check when no usernames were returned from lookup invocation.');
      }
    }
  } else {
    // No agreements found, set the GitHub Check to fail
    try {
      const check = await action_required(ow, args);
      return check;
    } catch (e) {
      return utils.action_error(e, 'Error setting Action Required GitHub Check when no agreements containing user was found.');
    }
  }
}

async function set_green_is_bot (ow, args) {
  let result;
  try {
    result = await ow.actions.invoke({
      name: utils.SETGITHUBCHECK,
      blocking: true,
      result: true,
      params: {
        installation_id: args.installation_id,
        org: args.org,
        repo: args.repo,
        sha: args.commit_sha,
        status: 'completed',
        start_time: args.start_time,
        conclusion: 'success',
        title: '✓ Bot',
        summary: 'Pull request issued by a bot account, carry on.'
      }
    });
  } catch (e) {
    return utils.action_error(e, 'Error during GitHub Check creation while setting status to green (via bot).');
  }
  return {
    statusCode: 200,
    body: result.title
  };
}

async function set_green_is_adobe_employee (ow, args, membership_org) {
  const company = 'Adobe';
  const reason = `membership in github.com/${membership_org}`;
  let result;
  try {
    result = await ow.actions.invoke({
      name: utils.SETGITHUBCHECK,
      blocking: true,
      result: true,
      params: {
        installation_id: args.installation_id,
        org: args.org,
        repo: args.repo,
        sha: args.commit_sha,
        status: 'completed',
        start_time: args.start_time,
        conclusion: 'success',
        title: `✓ ${company} Employee`,
        summary: `Pull request issued by an Adobe Employee (based on ${reason}), carry on.`
      }
    });
  } catch (e) {
    return utils.action_error(e, 'Error during GitHub Check creation while setting status to green (via employee).');
  }
  return {
    statusCode: 200,
    body: result.title
  };
}

async function action_required (ow, args) {
  let result;
  try {
    result = await ow.actions.invoke({
      name: utils.SETGITHUBCHECK,
      blocking: true,
      result: true,
      params: {
        installation_id: args.installation_id,
        org: args.org,
        repo: args.repo,
        sha: args.commit_sha,
        status: 'completed',
        start_time: args.start_time,
        conclusion: 'action_required',
        details_url: 'https://opensource.adobe.com/cla.html',
        title: 'Sign the Adobe CLA!',
        summary: `
No signed agreements were found. Please [sign the Adobe CLA](http://opensource.adobe.com/cla.html)! Once signed, close and re-open your pull request to run the check again.

If you have any questions, contact Adobe's Open Source Office by mentioning them on the pull request with **@adobe/open-source-office** or via email <grp-opensourceoffice@adobe.com>.

If you believe this was a mistake, please report an issue at [adobe/cla-bot](https://github.com/adobe/cla-bot/issues).`
      }
    });
  } catch (e) {
    return utils.action_error(e, 'Error invoking setgithubcheck during action_required creation.');
  }
  return {
    statusCode: 200,
    body: result.title
  };
}

exports.main = main;
