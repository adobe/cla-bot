var request = require('request');
var config = require('./config.json');
var github_app = require('github-app');
var openwhisk = require('openwhisk');

function main(params) {
	return new Promise((resolve, reject) => {
		if(!params.agreement) {
			reject(`NO AGREEMENT ID, SOMETHING IS WRONG!`);
		}

		var agreementID = params.agreement.id;

		var response = {};
			response = {
				statusCode: 400,
				//body: `something went horribly wrong ${clientID} ${config.signClientID}`
				body: agreementID
			};
		resolve(response);
	});
}

exports.main = main;
