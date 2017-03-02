'use strict';
/* global chrome */

let myPanel;

chrome.devtools.panels.create(
	'Route Helper',
	'images/icon128.png',
	'ui.html',
	function (panel) {
		myPanel = panel;
	}
);

const urls = [];

chrome.devtools.network.onRequestFinished.addListener(function (e) {
	const url = {
		url: e.request.url,
		headersSize: e.response.headersSize,
		bodySize: e.response.bodySize
	};
	urls.push(url);

	if (myPanel) {

	}
});
