'use strict';
/* global chrome */

let myPanel;
let $;
let urlHolder;
let baseUrl;
let baseUrlParts;
let routesContainer;

const urls = new Map();
const categories = new Map();

function generateRouteBox(cat) {
	const el = document.createElement('div');
	el.innerHTML = `
	<input id="toggle" type="checkbox" class="drop-down">
	<label for="toggle">
	 	<div class="lozenge" style="background-color: blue;"></div> <span class="route-name"></span>
	</label>
	<span>Pattern: <code>${cat.pattern}</code></span>
	`;
	return el;
}

function renderRoutes() {

	if (!$) return;
	routesContainer = routesContainer || $.querySelector('#routes-container');

	for (const cat of categories.values()) {
		if (!cat.el) {
			cat.el = generateRouteBox(cat);
			cat.nameEl = cat.el.querySelector('.route-name');
			cat.nameEl.textContent = cat.name;
		}
		routesContainer.appendChild(cat.el);
	}
}

function getParts(urlIn) {
	const url = new URL(urlIn);
	let urlBits = url.pathname.split('/');
	urlBits[0] = url.origin;
	urlBits = urlBits.map((part, i) => {
		const out = {};
		out.text = (i?'/':'') + part;
		let partvalue = urlBits.slice(0, i+1).join('/');
		if (i !== urlBits.length - 1) {
			partvalue = partvalue + '/';
		}
		out.value = partvalue;
		return out;
	});
	if (url.search) {
		const out = {};
		out.text = url.search;
		out.value = urlIn;
		urlBits.push(out);
	}
	let toRemove = 0;
	for (let i = 0, l = Math.min(baseUrlParts.length, urlBits.length); i < l; i++) {
		if (baseUrlParts[i].value === urlBits[i].value) {
			toRemove++;
		} else {
			break;
		}
	}
	if (toRemove) {
		urlBits.splice(0, toRemove);
		urlBits.unshift(true);
	}
	return urlBits;
}

function liOnClick(e) {
	if (e.target.dataset.urlPart) {
		const value = e.target.dataset.urlPart;
		if (!categories.has(value)) {
			const id = categories.size;
			categories.set(value, {
				pattern: value,
				name: 'Category ' + (id + 1),
				id
			});
		}
		renderRoutes();
	}
}

function createListItem(o) {
	const el = $.createElement('li');
	el.classList.add('unsorted-url');
	const container = $.createElement('span');
	container.classList.add('url-part_container');
	const urlBits = getParts(o.url);
	for (const part of urlBits) {
		const bitEl = $.createElement('span');
		bitEl.classList.add('url-part');
		if (part === true) {
			bitEl.textContent = '[base url]';
			bitEl.dataset.urlPart = baseUrl;
		} else {
			bitEl.textContent = part.text;
			bitEl.dataset.urlPart = part.value;
		}
		container.appendChild(bitEl);
	}
	el.appendChild(container);

	el.addEventListener('click', liOnClick)

	return el;
}

function update() {
	if (!baseUrl) return;
	urlHolder = urlHolder || $.querySelector('#all');
	for (const o of urls.values()) {
		o.el = o.el || createListItem(o);
		o.el.dataset.count = o.count;
		urlHolder.appendChild(o.el);
	}
}

function updateBaseUrlParts(url) {
	if (url[url.length - 1] !== '/') {
		url = url + '/';
	}
	baseUrl = url;
	baseUrlParts = [];
	baseUrlParts = getParts(url);
	$.querySelector('#base').value = url;
	renderRoutes();
	update();
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
			$ = myPanel.document;
			update();

			chrome.devtools.inspectedWindow.eval(
				'window.location.toString()',
				function (result) {

					// Pull out domain name
					updateBaseUrlParts(result.match(/^.+:\/\/[^\/]*/)[0]);
					chrome.devtools.inspectedWindow.eval('window.location.reload()');
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
