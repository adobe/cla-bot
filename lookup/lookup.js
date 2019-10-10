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

const request = require('request-promise-native');
const parse = require('util').promisify(require('csv-parse'));
const utils = require('../utils.js');
const config = utils.get_config();
const transpose = m => m[0].map((x, i) => m.map(x => x[i]));

async function main (params) {
  let agreements = [];

  // Expects an array of agreement_ids for cla-bot/checker
  if (params.agreements && params.agreements.constructor === Array) {
    agreements = params.agreements;
  } else if (params.agreements) {
    agreements.push(params.agreements);
  } else {
    return { error: `param 'agreements' not found in request` };
  }
  let apiVersion = 'v5';
  if (params.apiVersion) {
    apiVersion = params.apiVersion;
  }

  // Get an access_token from a refresh_token for Adobe Sign APIs
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
  let usernames;
  try {
    usernames = await lookup({
      agreements: agreements,
      access_token: access_token,
      username: params.username,
      apiVersion
    });
  } catch (e) {
    return utils.action_error(e, `Error during lookup of agreements using API version ${apiVersion} (params: ${JSON.stringify(params)}).`);
  }
  return {
    body: {
      usernames: usernames
    }
  };
}

function lookup (args) {
  const agreements = args.agreements;
  const username = args.username.toLowerCase();
  const promiseMatrix = agreements.map(agreement => lookupAndParseAgreement(args, agreement));
  const [responsePromises, usernamesPromises] = transpose(promiseMatrix);

  // A new Promise that resolves to either
  // 1. Username from the first Sign API call that includes the username
  // 2. Empty array if none of the Sign API calls includes the username
  // Promise is rejected if any of the Sign API calls fail before resolution
  // If the username is found, all requests are aborted (it's okay to abort completed requests)
  return new Promise((resolve, reject) => {
    Promise.all(usernamesPromises.map(promise => {
      return promise.then(agreementUsers => {
        if (agreementUsers.map(u => u.toLowerCase()).includes(username)) {
          resolve([username]);
          responsePromises.forEach(p => p.abort());
        }
      });
    })).then(_results => resolve([]), error => reject(error));
  });
}

function lookupAndParseAgreement (args, agreement) {
  const responsePromise = lookupAgreement(args, agreement);
  const usernamesPromise = responsePromise
    .then(function (response) {
      return parse(response.trim(), { columns: true });
    })
    .then(function (records) {
      return Promise.resolve(extractUsernames(records));
    });

  // We only need the result of usernamesPromise, however
  // we need to hold on to responsePromise in order to abort the HTTP request
  // as it is both an {http.ClientRequest} and a {Promise<http.IncomingMessage>}
  return [responsePromise, usernamesPromise];
}

function lookupAgreement (args, agreement) {
  const options = {
    method: 'GET',
    url: `https://api.na1.echosign.com:443/api/rest/${args.apiVersion}/agreements/${agreement}/formData`,
    headers: {
      'cache-control': 'no-cache',
      Authorization: 'Bearer ' + args.access_token
    }
  };
  return request(options);
}

function extractUsernames (agreementRows) {
  // Logic to get value of Custom Field 8 or Custom Field 1 or githubUsername from the parsed CSV
  let usernames = [];
  const data = agreementRows[0];
  if (data['Custom Field 8'] !== undefined && data['Custom Field 8'].trim() !== '') {
    // CCLA; form fields are a text area that accept multiple employee
    // usernames
    usernames = data['Custom Field 8'].split(/[\s,\n]+/);
  }
  if (data['Custom Field 1'] !== undefined && data['Custom Field 1'].trim() !== '') {
    // ICLA; form field is a single text input for a single github username
    usernames.push(data['Custom Field 1']);
  }
  if (data.githubUsername !== undefined && data.githubUsername.trim() !== '') {
    usernames.push(data.githubUsername);
  }
  return usernames;
}

exports.main = main;
