var request = require("request");
var config = require("./config.json");

/* 
gets fired from github pr creation webhook.

* Check if they are adobe employee, if yes, give checkmark
* If not an employee, report back if the CLA is already signed
* if signed, give checkmark
* if not signed, give an 'x' and tell them to go sign at http://opensource.adobe.com/cla

*/

function main(params) {
  return new Promise((resolve, reject) => {
    let user = params.pull_request.user.login;
    console.log(user);
    console.log(JSON.stringify(params));

    var options = {
      method: 'POST',
      url: 'https://api.na2.echosign.com/oauth/refresh',
      headers: {
        'cache-control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      form: {
        client_id: config.clientID,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken
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
  })
}

exports.main = main;
