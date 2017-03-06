'use strict';
/* global chrome */

let myPanel;
let $;
let urlHolder;
let baseUrl;
let baseUrlParts;
let routesContainer;

const urls = new Map();
let categories = new Map();

const itemsToSync = [
	'name',
	'id',
	'pattern',
	'regExp'
];

function log(o) {
	const str = JSON.stringify(o);
	port.postMessage(o);
	chrome.devtools.inspectedWindow.eval('console.log(' + str + ');');
}

function generateRouteBox(cat) {
	const el = document.createElement('div');
	el.style.backgroundColor = `hsl(${(222.4922359499622 * cat.id) % 360},70%,90%)`;
	el.style.borderBottom = `3px solid hsl(${(222.4922359499622 * cat.id) % 360},90%,60%)`;
	el.innerHTML = `
	<input id="toggle${cat.id}" type="checkbox" class="drop-down">
	<label for="toggle${cat.id}">
	 	<div class="lozenge" style="background-color: hsl(${(222.4922359499622 * cat.id) % 360},80%,80%);"></div> <input class="route-name" readonly="readonly" />
	</label>
	<span class="pattern">Pattern: <input value="${cat.pattern}" readonly="readonly" /><span class="pattern-type"><br />
		<label><input type="radio" name="pattern-type-${cat.id}" ${cat.pattern === cat.regExp ? 'checked' : ''} value="regexp">RegExp Pattern</label><br />
		<label><input type="radio" name="pattern-type-${cat.id}" ${cat.pattern !== cat.regExp ? 'checked' : ''} value="express">Express Style Pattern</label>
	</span></span>
	<ul></ul>
	`;
	return el;
}

function storeAndUpdateCategories() {
	chrome.storage.sync.set({
		[baseUrl]: [...categories.entries()].map(a => {
			const out = {};
			for (const key of itemsToSync) {
				out[key] = a[1][key];
			}
			a[1] = out;
			return a;
		})
	});
	renderRoutes();
	update();
}

function editCat(cat, focusEl) {
	if (cat.editing) return;
	cat.editing = true;
	cat.nameEl.value = cat.name;
	cat.nameEl.readOnly = false;
	cat.patternEl.readOnly = false;
	cat.nameEl.focus();
	if (focusEl.focus) focusEl.focus();
}

function doneEdit(cat) {
	if (!cat.editing) return;
	cat.editing = false;

	// Update values for rerender
	cat.name = cat.nameEl.value;

	routesContainer.removeChild(cat.el);
	cat.el = false;
	storeAndUpdateCategories();
}

function cancelEdit(cat) {
	if (!cat.editing) return;
	cat.editing = false;

	routesContainer.removeChild(cat.el);
	cat.el = false;
	storeAndUpdateCategories();
}

function renderRoutes() {

	if (!$) return;
	routesContainer = routesContainer || $.querySelector('#routes-container');

	for (const cat of [...categories.values()].reverse()) {
		if (!cat.el) {
			cat.el = generateRouteBox(cat);
			cat.nameEl = cat.el.querySelector('.route-name');
			cat.listEl = cat.el.querySelector('ul');
			cat.patternEl = cat.el.querySelector('.pattern input');
			cat.el.addEventListener('keyup', e => {
				if (e.keyCode === 113) {
					editCat(cat, cat.nameEl);
				}
				if (e.keyCode === 13) {
					doneEdit(cat);
				}
				if (e.keyCode === 27) {
					cancelEdit(cat);
					e.preventDefault();
					e.stopPropagation();
				}
			});
			cat.el.addEventListener('dblclick', e => editCat(cat, e.target));
		}
		routesContainer.appendChild(cat.el);
	}
}

function getParts(urlIn, stripSearch) {
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
	if (!stripSearch && url.search) {
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

function escapeRegExp(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

function liOnClick(e) {
	if (e.target.dataset.urlPart) {
		const value = e.target.dataset.urlPart;
		if (!categories.has(value)) {
			let pattern;
			let regExp;
			const parts = getParts(value);
			const fullUrl = e.currentTarget.dataset.fullUrl

			if (
				parts[0] === true &&
				(
					// if it is the base url
					parts.length === 1 || (

						// and has no search query
						parts[parts.length - 1].text[0] !== '?' &&

						// and isn't just the full url
						parts[parts.length - 1].value !== fullUrl
					)
				)
			) {

				// treat as a relative url so generate express style routes
				// special case: just base url gets treated as '/'

				if (parts.length === 1) {
					pattern = '/*';
					regExp = window.pathToRegexp(baseUrl + '*');
				} else {
					pattern = parts.map(i => i.text).join('') + '*';

					// Create a RegExp which includes the baseUrl but behaves like an express route
					regExp = window.pathToRegexp(parts[parts.length - 1].value + '*');
				}
			} else {

				// treat as an absolute url so use RegExp
				if (parts[parts.length - 1].value === fullUrl) {

					// The full url needs an absolute match
					regExp = new RegExp('^' + escapeRegExp(value) + '$');
				} else {

					// otherwise allow additional parts of the url
					regExp = new RegExp('^' + escapeRegExp(value) + '.*');
				}
				pattern = regExp.toString();
			}
			const id = categories.size;
			categories.set(value, {
				pattern,
				regExp: regExp.toString(),
				name: 'Category ' + (id + 1),
				id
			});
			storeAndUpdateCategories();
		}
	}
}

function createListItem(o) {
	const el = $.createElement('li');
	el.classList.add('unsorted-url');
	el.dataset.fullUrl = o.url;
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

function reviveRegExp(exp) {
	const m = exp.match(/\/(.*)\/(.*)?/);
    return new RegExp(m[1], m[2] || '');
}

function update() {
	if (!baseUrl) return;
	urlHolder = urlHolder || $.querySelector('#all');
	for (const o of urls.values()) {
		o.el = o.el || createListItem(o);
		o.el.dataset.count = o.count;
		urlHolder.appendChild(o.el);

		for (const cat of [...categories.values()].reverse()) {
			if (cat.regExp) {
				const regex = cat.actualRegExp || (cat.actualRegExp = reviveRegExp(cat.regExp));
				if (regex.exec(o.url)) {
					cat.listEl.appendChild(o.el);
					break;
				}
			}
		}
	}

	for (const cat of categories.values()) {
		cat.nameEl.value = `${cat.name} (${cat.listEl.children.length})`;
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

	chrome.storage.sync.get(baseUrl, function (result) {
		result = result[baseUrl];
		if (result && result.constructor === Array) {
			log(JSON.stringify(result));
			categories = new Map(result);
		}
		renderRoutes();
		update();
	});
}

const port = chrome.runtime.connect({ name: 'devtools-console' });


chrome.devtools.panels.create(
	'Route Helper',
	'images/icon128.png',
	'ui.html',
	function (panel) {
		panel.onShown.addListener(function temp(win) {

			if (myPanel) return;

			myPanel = win;
			$ = myPanel.document;

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
	if (urls.has(e.request.url)) {
		urls.get(e.request.url).count += 1;
	} else {
		const url = {
			url: e.request.url,
			headersSize: e.response.headersSize,
			bodySize: e.response.bodySize,
			count: 1
		};

		urls.set(e.request.url, url);
	}
	update();
});

chrome.storage.onChanged.addListener(function (changes) {
	for (const key in changes) {
		if (key === baseUrl) {
			const newValue = changes[key].newValue;
			log(newValue);
			for (const o of newValue) {
				const toBeUpdated = categories.get(o[0]);
				for (const key of itemsToSync) {
					toBeUpdated[key] = o[1][key];
				}
			}
			renderRoutes();
			update();
		}
	}
});