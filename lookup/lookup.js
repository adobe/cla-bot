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

const parse = require('util').promisify(require('csv-parse'));
const utils = require('../utils.js');
const config = utils.get_config();

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

async function lookup (args) {
  const agreements = args.agreements;
  let usernames = [];
  await Promise.all(agreements.map(async function (agreement) {
    const agreementUsers = await lookupSingleAgreement(args, agreement);
    usernames = Array.from(new Set(usernames.concat(agreementUsers)));
  }));
  return usernames;
}

async function lookupSingleAgreement (args, agreement) {
  const fetchResponse = await fetch(`https://api.na1.echosign.com:443/api/rest/${args.apiVersion}/agreements/${agreement}/formData`, {
    method: 'GET',
    headers: {
      'cache-control': 'no-cache',
      Authorization: 'Bearer ' + args.access_token
    }
  });

  if (!fetchResponse.ok) {
    throw new Error(`Error: ${fetchResponse.status} - ${fetchResponse.statusText}`);
  }

  const response = await fetchResponse.text();

  // Logic to parse CSV and get the value for Custom Field 8 or Custom Field 1 or githubUsername
  const records = await parse(response.trim(), { columns: true });
  let usernames = [];
  const data = records[0];
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
