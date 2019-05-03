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

var request = require('request-promise-native');
var github_app = require('github-app');
var openwhisk = require('openwhisk');
var utils = require('../utils.js');
var config = utils.get_config();
/*
gets fired from github pr creation webhook.
* Check if they are adobe employee, if yes, give checkmark
* If not an employee, report back if the CLA is already signed
* if signed, give checkmark
* if not signed, give an 'x' and tell them to go sign at http://opensource.adobe.com/cla
*/
var valid_pr_events = ['opened', 'reopened', 'synchronize'];

function main (params) {
  return new Promise(function (resolve, reject) {
    if (!params.pull_request || !valid_pr_events.includes(params.action)) {
      return resolve({
        statusCode: 202,
        body: 'Not a pull request being (re)opened or synchronized, ignoring'
      });
    }

    var ow = openwhisk();
    // TODO: what if the repo is private?
    var github;
    var user = params.pull_request.user.login;
    var start_time = (new Date()).toISOString();
    var org = params.pull_request.base.repo.owner.login;
    var repo = params.pull_request.base.repo.name;
    var commit_sha = params.pull_request.head.sha;
    var installation_id = params.installation.id;

    var args = {
      start_time: start_time,
      org: org,
      repo: repo,
      commit_sha: commit_sha,
      installation_id: installation_id,
      user: user
    };

    if (params.pull_request.user.type === 'Bot') {
      return set_green_is_bot(resolve, ow, args);
    }

    var app = github_app({
      id: config.githubAppId,
      cert: config.githubKey
    });
    app.asInstallation(installation_id).then(function (gh) {
      github = gh;
      return github.orgs.checkMembership({
        org: org,
        username: user
      });
    }).then(function (is_member) {
      // if status is 204, user is a member.
      // if status is 404, user is not a member - but this triggers the catch in
      // the promise.
      // more details here: https://developer.github.com/v3/orgs/members/#check-membership
      if (is_member.status === 204) {
        set_green_is_adobe_employee(resolve, ow, args, org);
      }
    }).catch(function (err) {
      if (err.code === 404 && err.message.indexOf('is not a member of the org') > -1) {
        // User is not a member of org the PR was issued on
        if (org !== 'adobe') {
          // .. but maybe they are a member of the adobe org?
          // need to use checkPublicMembership here as we don't have permissions
          // to check for private membership as we are using the installation_id
          // of the bot on the non-adobe org.
          github.orgs.checkPublicMembership({
            org: 'adobe',
            username: user
          }).then(function (is_member) {
            // if status is 204, user is a member.
            // if status is 404, user is not a member - but this triggers the catch in
            // the promise.
            // more details here: https://developer.github.com/v3/orgs/members/#check-public-membership
            if (is_member.status === 204) {
              set_green_is_adobe_employee(resolve, ow, args);
            }
          }).catch(function (err) {
            if (err.code === 404 && err.message.indexOf('is not a public member of the org') > -1) {
              check_cla(resolve, ow, args);
            } else {
              return resolve({
                statusCode: 500,
                body: {
                  error: err,
                  reason: 'Generic error in checker promise chain.'
                }
              });
            }
          });
        } else {
          //  check if they signed CLA
          check_cla(resolve, ow, args);
        }
      } else {
        return resolve({
          statusCode: 500,
          body: {
            error: err,
            reason: 'Generic error in checker promise chain.'
          }
        });
      }
    });
  });
}

function check_cla (resolve, ow, args) {
  var options = {
    json: true,
    method: 'POST',
    url: 'https://api.na2.echosign.com/oauth/refresh',
    headers: {
      'cache-control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {
      client_id: config.signClientID,
      client_secret: config.signClientSecret,
      grant_type: 'refresh_token',
      refresh_token: config.signRefreshToken
    }
  };

  request(options).then(function (response) {
    var access_token = response.access_token;
    if (!access_token) {
      return resolve({
        statusCode: 500,
        body: 'Empty access_token retrieved from Adobe Sign.'
      });
    }
    var options = {
      method: 'GET',
      url: 'https://api.na1.echosign.com:443/api/rest/v5/agreements',
      qs: {
        query: args.user
      },
      headers: {
        'cache-control': 'no-cache',
        'Access-Token': access_token
      },
      json: true
    };
    return request(options);
  }, function (err) {
    return resolve({
      statusCode: 500,
      body: {
        error: err,
        reason: 'Error retrieving Adobe Sign access token.'
      }
    });
  }).then(function (body) {
    if (body.userAgreementList && body.userAgreementList.length) {
      // We have a few agreements to search through.
      var agreements = body.userAgreementList.filter(function (agreement) {
        return (agreement.status === 'SIGNED' && (agreement.name === 'Adobe Contributor License Agreement' || agreement.name === 'Adobe CLA'));
      }).map(function (agreement) {
        return agreement.agreementId;
      });
      ow.actions.invoke({
        name: 'cla-lookup',
        blocking: true,
        result: true,
        params: {
          agreements: agreements,
          username: args.user
        }
      }).then(function (res) {
        var usernames = res.body.usernames;
        if (usernames.map(function (item) { return item.toLowerCase(); }).includes(args.user.toLowerCase())) {
          return ow.actions.invoke({
            name: 'cla-setgithubcheck',
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
              summary: 'A Signed CLA has been found for the github user ' + args.user
            }
          }).then(function (check) {
            return {
              statusCode: 200,
              body: check.title
            };
          });
        } else {
          return action_required(ow, args);
        }
      }).then(function (check) {
        resolve(check);
      }).catch(function (err) {
        resolve({
          statusCode: 500,
          body: {
            error: err,
            reason: 'Error during lookup action.'
          }
        });
      });
    } else {
      // No agreements found, set the GitHub Check to fail
      action_required(ow, args).then(function (check) {
        resolve(check);
      });
    }
  }, function (err) {
    return resolve({
      statusCode: 500,
      body: {
        error: err,
        reason: 'Error retrieving Adobe Sign agreements.'
      }
    });
  });
}

function set_green_is_bot (resolve, ow, args) {
  ow.actions.invoke({
    name: 'cla-setgithubcheck',
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
  }).then(function (check) {
    // The parameter in this function is defined by the setgithubcheck
    // action's resolve parameter (see setgithubcheck/setgithubcheck.js)
    resolve({
      statusCode: 200,
      body: check.title
    });
  }).catch(function (err) {
    resolve({
      statusCode: 500,
      body: {
        error: err,
        reason: 'Error during GitHub Check creation.'
      }
    });
  });
}
function set_green_is_adobe_employee (resolve, ow, args, membership_org) {
  ow.actions.invoke({
    name: 'cla-setgithubcheck',
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
      title: '✓ Adobe Employee',
      summary: `Pull request issued by an Adobe Employee (based on membership in github.com/${membership_org}), carry on.`
    }
  }).then(function (check) {
    // The parameter in this function is defined by the setgithubcheck
    // action's resolve parameter (see setgithubcheck/setgithubcheck.js)
    resolve({
      statusCode: 200,
      body: check.title
    });
  }).catch(function (err) {
    resolve({
      statusCode: 500,
      body: {
        error: err,
        reason: 'Error during GitHub Check creation.'
      }
    });
  });
}

function action_required (ow, args) {
  return ow.actions.invoke({
    name: 'cla-setgithubcheck',
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
      details_url: 'http://opensource.adobe.com/cla.html',
      title: 'Sign the Adobe CLA!',
      summary: 'No signed agreements were found. Please [sign the Adobe CLA](http://opensource.adobe.com/cla.html)! Once signed, close and re-open your pull request to run the check again.\n\n If you are an Adobe employee, you do not have to sign the CLA. Instead [add yourself to the Adobe GitHub Org](https://git.corp.adobe.com/OpenSourceAdvisoryBoard/handbook/blob/master/GitHub-Adobe-Org-Management.md#request-access-to-our-adobe-github-org) to be recognized as an Adobe Employee. Once added to the GitHub Org, close and re-open the pull-request to run the check again.\n\n If you have any questions, contact Adobe\'s Open Source Office by mentioning them on the pull request with **@adobe/open-source-office** or via email <grp-opensourceoffice@adobe.com>.'
    }
  }).then(function (check) {
    return {
      statusCode: 200,
      body: check.title
    };
  }).catch(function (err) {
    return {
      statusCode: 500,
      body: {
        error: err,
        reason: 'Error during GitHub Check (action_required) creation.'
      }
    };
  });
}

exports.main = main;
