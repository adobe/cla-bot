var request = require("request");
var config = require("./config.json");
var async = require("async");

function main(params) {
  var agreements = [];

  return new Promise(function (resolve, reject) {
    //Expects an array of agreement_ids for cla-bot/checker and a single agreement_id for cla-bot/confirmer
    if (params.agreements && params.agreements.constructor === Array) {
      agreements = params.agreements;
    } else if (params.agreements) {
      agreements.push(params.agreements);
    } else {
      reject({
        body: "param 'agreements' not found in request"
      });
    }

    //Get an access_token from a refresh_token for Adobe Sign APIs
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

      var args = {
        agreements: agreements,
        access_token: access_token
      };

      lookup(args, function (usernames) {
        resolve({
          body: {
            usernames: usernames
          }
        });
      });
    });
  });
}

function lookup(args, callback) {
  var agreements = args.agreements;
  var usernames = [];

  //Lookup github usernames for each agreement in the list and return the consolidated response
  async.each(agreements, function (agreement, callback) {
    lookupSingleAgreement(args, agreement, function (username) {
      if (usernames.indexOf(username) === -1) {
        usernames.push(username);
      }
      callback();
    });
  }, function (err) {
    if (err) {
      console.log("Error:" + err);
      callback(err);
    } else {
      callback(usernames);
    }

  });
}

function lookupSingleAgreement(args, agreement, callback) {
  var access_token = args.access_token;

  var options = {
    method: 'GET',
    url: 'https://api.na1.echosign.com:443/api/rest/v5/agreements/' + agreement + '/formData',
    headers: {
      'cache-control': 'no-cache',
      Authorization: 'Bearer ' + access_token
    }
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    //Logic to parse CSV and get the value for Custom Field 1
    var csv = body.replace(/"/g, '').split('\n');
    var username = csv[1].split(',')[csv[0].split(',').indexOf("Custom Field 1")];
    if (username !== undefined && username !== "") {
      callback(username);
    }
  });
}


exports.main = main;