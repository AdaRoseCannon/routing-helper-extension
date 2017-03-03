'use strict';
/* eslint no-console: 0 */

chrome.runtime.onInstalled.addListener(details => {
	console.log('previousVersion', details.previousVersion);
});

console.log('\'Allo \'Allo! Event Page');

chrome.runtime.onConnect.addListener(function(port) {
	if (port.name === 'devtools-console') {
		port.onMessage.addListener(function (msg) {
			console.log(msg);
		});
	}
});
