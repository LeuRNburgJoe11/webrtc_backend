const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // Allows your Flutter web app and portal to connect
});

// Global state to temporarily store active chatbot rooms in memory
const activeSessions = {};

// ==========================================
// 1. REST API Endpoints (For the Chatbot)
// ==========================================

// Add a default home route just to verify deployment
app.get('/', (req, res) => {
  res.send('🚀 WebRTC Signaling and Control Plane Server is running smoothly!');
});

// Chatbot hits this to create a room
app.post('/api/webrtc/session/create', (req, { res }) => {
  const { userId } = req.body;
  const roomId = `room_${Math.random().toString(36).substring(2, 9)}`;

  // Save room status
  activeSessions[roomId] = {
    roomId: roomId,
    userId: userId,
    status: 'waiting',
  };

  console.log(`[REST] Created room ${roomId} for user ${userId}`);
  
  // Return this payload back to the chatbot
  res.status(201).json(activeSessions[roomId]);
});

// Flutter or Chatbot polls this to verify room status
app.get('/api/webrtc/session/status/:roomId', (req, res) => {
  const { roomId } = req.params;
  const session = activeSessions[roomId];

  if (!session) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.status(200).json(session);
});

// ==========================================
// 2. WebRTC Signaling (Via Socket.io)
// ==========================================
io.on('connection', (socket) => {
  console.log(`[Socket] New connection: ${socket.id}`);

  socket.on('join-room', ({ roomId }) => {
    socket.join(roomId);
    console.log(`[Socket] ${socket.id} joined room: ${roomId}`);
  });

  // Relay WebRTC Session Descriptions (Offers/Answers) between peers
  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', data);
  });

  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', data);
  });

  // Relay ICE Network Candidates
  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', data);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

// Render dynamically allocates a port via process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server streaming active on port ${PORT}`);
});
