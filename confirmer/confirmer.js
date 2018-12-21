var request = require('request');
var config = require('./config.json');
var github_app = require('github-app');
var openwhisk = require('openwhisk');

function main(params) {
	return new Promise((resolve, reject) => {
		var clientID;
		var response = {};
		console.log('here')

		// only in validation for creating webhook
		if (params.__ow_headers && params.__ow_headers['x-adobesign-clientid']) {
			// Fetch client id
			clientID = params.__ow_headers['x-adobesign-clientid'];

			console.log(clientID);

			if (clientID === config.signClientID) {
				response.statusCode = 200;
				//response.status = 200;
				response.headers = {
					"X-ADOBESIGN-CLIENTID": clientID
				}
				response.headers['Content-Type'] = 'application/json';
				var responseBody = {
					"xAdobeSignClientId" : clientID // Return Client Id in the body
				};
				response.body = responseBody;
			};
		} else {
			// not a validation request, so do my actual work
			response = {
				statusCode: 400,
				//body: `something went horribly wrong ${clientID} ${config.signClientID}`
				body: params
			};
		};
		resolve(response);
	});
}

exports.main = main;
