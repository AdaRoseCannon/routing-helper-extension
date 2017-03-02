'use strict';
/* global chrome */

let myPanel;
let urlHolder;
const urls = ['dummy'];

function update() {
	if (!urlHolder) {
		return;
	}
	urlHolder.innerHTML = urls.map(o => `
		<li>${o.url}</li>
	`).join('');
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
			port.postMessage(urlHolder.tagName);
			update();
		});
	}
);

chrome.devtools.network.onRequestFinished.addListener(function (e) {
	const url = {
		url: e.request.url,
		headersSize: e.response.headersSize,
		bodySize: e.response.bodySize
	};
	urls.push(url);
	update();
});
