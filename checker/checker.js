var request = require('request');
var config = require('./config.json');
var github_app = require('github-app');

/*
gets fired from github pr creation webhook.

* Check if they are adobe employee, if yes, give checkmark
* If not an employee, report back if the CLA is already signed
* if signed, give checkmark
* if not signed, give an 'x' and tell them to go sign at http://opensource.adobe.com/cla

*/

function main (params) {
  return new Promise((resolve, reject) => {
    if (!params.pull_request) throw new Error('Not a pull request');

    var user = params.pull_request.user.login;
    var installation_id = params.installation.id;
    var app = github_app({
      id: config.githubAppId,
      cert: config.githubKey
    });
    app.asInstallation(installation_id).then(function (github) {
            // TODO: org param here should not be hard-coded so that it works
            // across multiple orgs
            // TODO: how would it work for user (not org) repos?
      return github.orgs.checkMembership({org: 'adobe', username: user});
    }).then(function (is_member) {
            // if status is 204, user is a member.
            // if status is 404, user is not a member.
            // more details here: https://developer.github.com/v3/orgs/members/#check-membership
      if (is_member.status === 204) {
                // TODO: user is a member of adobe org, can set check on PR.
                // TODO: factor this out to own function, we'll need this a
                // bunch
                // TODO: looks like there are github.checks.create, update,
                // and listForRef methods. we may need to check if an
                // existing ref already exists first, and if so, update it
                // if it is set to fail, if not create one.
        resolve({body: user + ' is a member of adobe.'});
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
          if (error) throw new Error(error);
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
            if (error) throw new Error(error);

            console.log(body);
            resolve({ body: JSON.stringify(body) });
          });
        });
      }
    }).catch(function (err) {
      reject(new Error((err && err.message) || err));
    });
  });
}

exports.main = main;
