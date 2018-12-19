var request = require("request");
var config = require("config.json");

/* 
gets fired from github pr creation webhook.

* Check if they are adobe employee, if yes, give checkmark
* If not an employee, report back if the CLA is already signed
* if signed, give checkmark
* if not signed, give an 'x' and tell them to go sign at http://opensource.adobe.com/cla

*/

function main(params) {
  return new Promise((resolve, reject) => {
    let user = params.sender.login;
    console.log(user);
    console.log(JSON.stringify(params));
	resolve({body:JSON.stringify(params)});
   })

}

exports.main = main;
