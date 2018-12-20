var request = require('request');
var config = require('./config.json');
var github_app = require('github-app');
var openwhisk = require('openwhisk');
/*
gets fired from github pr creation webhook.

* Check if they are adobe employee, if yes, give checkmark
* If not an employee, report back if the CLA is already signed
* if signed, give checkmark
* if not signed, give an 'x' and tell them to go sign at http://opensource.adobe.com/cla

*/

function main (params) {
  return new Promise((resolve, reject) => {
    // TODO: we also get 'run checks' payloads from github. should we trigger on
    // pull request events or on check events? check events may be better as
    // users can also 'rerequest' checks be rerun. however, check payloads may
    // be insufficient (see github app payloads under github app -> advanced for
    // details on this)
    if (!params.pull_request) return resolve({ statusCode: 400, body: 'Not a pull request, ignoring' });

    var ow = openwhisk();
    // TODO: currently this runs on pull request closed and reopened.
    // TODO: what if the repo is private?
    var start_time = (new Date()).toISOString();
    var user = params.pull_request.user.login;
    var org = params.pull_request.base.repo.owner.login;
    var repo = params.pull_request.base.repo.name;
    var commit_sha = params.pull_request.head.sha;
    var github;
    var installation_id = params.installation.id;
    var app = github_app({
      id: config.githubAppId,
      cert: config.githubKey
    });
    app.asInstallation(installation_id).then(function (gh) {
      github = gh;
      return github.orgs.checkMembership({org: org, username: user});
    }).then(function (is_member) {
      // if status is 204, user is a member.
      // if status is 404, user is not a member.
      // more details here: https://developer.github.com/v3/orgs/members/#check-membership
      if (is_member.status === 204) {
        ow.actions.invoke({
          name: 'cla-setgithubcheck',
          blocking: true,
          result: true,
          params: {
            installation_id: installation_id,
            org: org,
            repo: repo,
            sha: commit_sha,
            status: 'completed',
            start_time: start_time,
            conclusion: 'success',
            title: '✓ Adobe Employee',
            summary: 'Pull request issued by an Adobe Employee, carry on.'
          }
        }).then(function (check) {
          // The parameter in this function is defined by the setgithubcheck
          // action's resolve parameter (see setgithubcheck/setgithubcheck.js)
          resolve({body: check.title});
        }).catch(function (err) {
          resolve({statusCode: 500, body: { error: err, reason: 'Error during GitHub Check creation.' }});
        });
      } else {
        // User is not a member of org, check if they signed CLA
        var options = {
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

        request(options, function (error, response, body) {
          if (error) return resolve({statusCode: 500, body: { error: error, reason: 'Error retrieving Adobe Sign refresh token.' }});
          var access_token = JSON.parse(body).access_token;
          console.log(access_token);
          var options = {
            method: 'GET',
            url: 'https://api.na1.echosign.com:443/api/rest/v5/agreements',
            qs: { query: user },
            headers:
            {
              'cache-control': 'no-cache',
              'Access-Token': access_token
            }
          };

          request(options, function (error, response, body) {
            if (error) return resolve({statusCode: 500, body: { error: error, reason: 'Error retrieving Adobe Sign agreements.' }});

            console.log(body);
            resolve({ body: JSON.stringify(body) });
          });
        });
      }
    }).catch(function (err) {
      return resolve({statusCode: 500, body: { error: err, reason: 'Generic error in checker promise chain.' }});
    });
  });
}

exports.main = main;
