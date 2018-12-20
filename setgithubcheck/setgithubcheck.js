var config = require('./config.json');
var github_app = require('github-app');

/*
 * acts as an action that sets github Checks, using the Checks API, on behalf of
 * the CLA bot.
*/

function main (params) {
  return new Promise((resolve, reject) => {
    var installation_id = params.installation_id;
    var app = github_app({
      id: config.githubAppId,
      cert: config.githubKey
    });
    app.asInstallation(installation_id).then(function (github) {
      var options = {
        owner: params.org,
        repo: params.repo,
        name: 'Adobe CLA Signed?',
        head_sha: params.sha,
        status: params.status,
        started_at: params.start_time,
        conclusion: params.conclusion,
        completed_at: (new Date()).toISOString(),
        output: {
          title: params.title,
          summary: params.summary
        }
      };
      if (params.details_url) options.details_url = params.details_url;
      return github.checks.create(options);
    }).then(function (check) {
      resolve({title: params.title});
    }).catch(function (err) {
      reject(new Error(err));
    });
  });
}

exports.main = main;
