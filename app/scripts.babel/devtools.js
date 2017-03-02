'use strict';
/* global chrome */

let myPanel;
let urlHolder;
let baseUrl;
let baseUrlReg;
const urls = new Map();

const categories = [{
	pattern: '/static/',
	name: 'Static Elements',
	id: 0
}];

function update() {
	if (!urlHolder) {
		return;
	}
	urlHolder.innerHTML = [...urls.values()].map(function (o) {
		let parseUrl = o.url;
		if (baseUrlReg && o.url.match(baseUrlReg)) {
			parseUrl = parseUrl.substr(baseUrl.length);
		}
		return `<li>${o.count}, ${parseUrl}</li>`;
	}).join('');
}

const port = chrome.runtime.connect({ name: 'devtools-console' });

chrome.devtools.panels.create(
	'Route Helper',
	'images/icon128.png',
	'ui.html',
	function (panel) {
		port.postMessage('panel created');
		panel.onShown.addListener(function (win) {
			port.postMessage('panel shown');
			myPanel = win;
			urlHolder = myPanel.document.querySelector('#all');
			update();

			chrome.devtools.inspectedWindow.eval(
				'window.location.toString()',
				function (result) {

					// Pull out domain name
					baseUrl = result.match(/^.+:\/\/[^\/]*/)[0];
					baseUrlReg = new RegExp('^' + baseUrl);
					myPanel.document.querySelector('#base').value = baseUrl;
					update();
				}
			);

		});
	}
);

chrome.devtools.network.onRequestFinished.addListener(function (e) {
	if (e.request.url.match(/^data:/)) return;
	const url = {
		url: e.request.url,
		headersSize: e.response.headersSize,
		bodySize: e.response.bodySize,
		count: 1
	};
	if (urls.has(url.url)) {
		urls.get(url.url).count += 1;
	} else {
		urls.set(url.url, url);
	}
	update();
});
