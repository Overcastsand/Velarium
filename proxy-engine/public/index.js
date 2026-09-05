"use strict";
/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("uv-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("uv-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("uv-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("uv-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("uv-error-code");
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

form.addEventListener("submit", async (event) => {
	event.preventDefault();

	try {
		await registerSW();
	} catch (err) {
		error.textContent = "Failed to register service worker.";
		errorCode.textContent = err.toString();
		throw err;
	}

	const url = search(address.value, searchEngine.value);

	let frame = document.getElementById("uv-frame");

	// Velarium Custom UI Trigger: Show the browser overlay and sync the typed text
	document.getElementById("browser-window").style.display = "flex";
	document.getElementById("top-url-bar").value = address.value;

	let wispUrl =
	(location.protocol === "https:" ? "wss" : "ws") +
	"://" +
	location.host +
	"/wisp/";
	if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
		await connection.setTransport("/epoxy/index.mjs", [
			{ wisp: wispUrl },
		]);
	}
	frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);
});

// Velarium Custom UI Logic: Handle searches made from the top navigation bar
const topForm = document.getElementById("top-uv-form");
const topAddress = document.getElementById("top-url-bar");

if(topForm) {
	topForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		const url = search(topAddress.value, searchEngine.value);
		let frame = document.getElementById("uv-frame");
		frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);
	});
}
