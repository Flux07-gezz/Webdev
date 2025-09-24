// server.js — complete minimal backend
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { nanoid } = require('nanoid');
const Sentiment = require('sentiment');
const axios = require('axios');
const { Low, JSONFile } = require('lowdb');
const path = require('path');
const { OpenAI } = require('openai');
const { ethers } = require('ethers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// Lowdb for simple storage
const adapter = new JSONFile('db.json');
const db = new Low(adapter);

async function initDB(){
  await db.read();
  db.data = db.data || { users: [], listings: [], itineraries: [], feedback: [], transports: [], analytics: {} };
  await db.write();
}
initDB();

// OpenAI client (optional)
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const openai = hasOpenAI ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Sentiment analyzer fallback
const sentiment = new Sentiment();

// Simple ethers provider (for blockchain integration)
let provider, wallet, contract;
const CONTRACT_ABI = [ // trimmed ABI for main functions used
  "function registerGuide(address wallet, string calldata docHash) external",
  "function verifyGuide(address wallet, bool verified) external",
  "function mintCertificate(address to, string calldata metadataURI) external returns (uint256)",
  "function getGuide(address wallet) external view returns (address,string,bool)"
];
if (process.env.ETH_NODE_URL && process.env.PRIVATE_KEY) {
  provider = new ethers.JsonRpcProvider(process.env.ETH_NODE_URL);
  wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  if (process.env.CONTRACT_ADDRESS) {
    contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
  }
}

// ----------------- ROUTES -----------------

// Basic health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Marketplace listing
app.get('/api/marketplace', async (req, res) => {
  await db.read();
  res.json(db.data.listings);
});

app.post('/api/marketplace', async (req, res) => {
  const { title, type, price, location, images } = req.body;
  const item = { id: nanoid(), title, type, price, location, images, createdAt: Date.now() };
  await db.read();
  db.data.listings.push(item);
  await db.write();
  res.json(item);
});

// Itinerary planning (AI-powered)
app.post('/api/itinerary', async (req, res) => {
  const { userId, preferences, language } = req.body;
  // fallback simple itinerary generator when OpenAI not present
  if (!hasOpenAI) {
    const result = {
      id: nanoid(),
      userId,
      preferences,
      language: language || 'en',
      itinerary: [
        { day:1, title: "Ranchi Heritage Walk", details: "Visit Jagannath Temple, Rock Garden; local lunch" },
        { day:2, title: "Betla National Park", details: "Safari + tribal craft visit" }
      ],
      createdAt: Date.now()
    };
    await db.read();
    db.data.itineraries.push(result);
    await db.write();
    return res.json(result);
  }

  // Use OpenAI to generate personalized itinerary
  try {
    const prompt = `Create a 3-day personalized tourist itinerary for a visitor to Jharkhand with preferences: ${JSON.stringify(preferences)}. Output JSON with days, activities, durations, transport suggestions, and estimated costs. Language: ${language || 'English'}.`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // example; change as desired
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800
    });
    const text = completion.choices[0].message.content;
    // try parse JSON
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text }; }

    const entry = { id: nanoid(), userId, preferences, language, itinerary: parsed, raw: text, createdAt: Date.now() };
    await db.read();
    db.data.itineraries.push(entry);
    await db.write();
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI service error", details: err.message });
  }
});

// Feedback & sentiment analysis
app.post('/api/feedback', async (req, res) => {
  const { userId, targetId, text, rating } = req.body;
  // try AI-based sentiment if available
  let sentimentScore = null;
  if (hasOpenAI) {
    try {
      const resp = await openai.responses.create({
        model: "gpt-4o-mini",
        input: `Analyze sentiment score (-1 to 1) for: "${text}" and return JSON { "score": <number>, "label":"positive|neutral|negative" }`
      });
      const out = resp.output_text || resp.output?.[0]?.content?.[0]?.text;
      const parsed = JSON.parse(out);
      sentimentScore = parsed.score;
    } catch (e) {
      sentimentScore = sentiment.analyze(text).comparative; // fallback
    }
  } else {
    sentimentScore = sentiment.analyze(text).comparative;
  }

  const fb = { id: nanoid(), userId, targetId, text, rating, sentimentScore, createdAt: Date.now() };
  await db.read();
  db.data.feedback.push(fb);
  // simple analytics update
  db.data.analytics.lastFeedback = Date.now();
  await db.write();
  res.json(fb);
});

// Guide registration (offchain record)
app.post('/api/guides/register', async (req, res) => {
  const { wallet, docHash } = req.body;
  // in a real app we'd check auth; here we store and optionally call contract.registerGuide via admin wallet
  await db.read();
  db.data.guides = db.data.guides || [];
  db.data.guides.push({ wallet, docHash, verified: false, createdAt: Date.now() });
  await db.write();

  // attempt on-chain registration if contract available
  if (contract) {
    try {
      const tx = await contract.registerGuide(wallet, docHash);
      const rc = await tx.wait();
      console.log("onchain register tx:", rc.transactionHash);
    } catch (e) {
      console.warn("onchain register failed:", e.message);
    }
  }

  res.json({ ok: true, wallet, docHash });
});

// Admin endpoint: verify guide and mint certificate
app.post('/api/guides/verify', async (req, res) => {
  const { wallet, verify, metadataURI } = req.body;
  await db.read();
  db.data.guides = db.data.guides || [];
  const g = db.data.guides.find(x => x.wallet === wallet);
  if (g) g.verified = !!verify;
  await db.write();

  let tokenId = null;
  if (verify && contract) {
    try {
      const tx = await contract.verifyGuide(wallet, true);
      await tx.wait();
      const tx2 = await contract.mintCertificate(wallet, metadataURI || "ipfs://Qm...");
      const rc = await tx2.wait();
      // Note: ethers v6 returns events differently; for simplicity attempt to get tokenId from event logs
      tokenId = 1; // placeholder
      console.log("minted cert for", wallet);
    } catch (e) {
      console.warn("blockchain verify/mint failed:", e.message);
    }
  }
  res.json({ ok: true, wallet, verified: !!verify, tokenId });
});

// Simple analytics overview
app.get('/api/analytics/overview', async (req, res) => {
  await db.read();
  const listings = db.data.listings.length;
  const itineraries = db.data.itineraries.length;
  const feedbackCount = db.data.feedback.length;
  // aggregate sentiment average
  const avgSent = db.data.feedback.reduce((s,a)=> s + (a.sentimentScore||0), 0) / Math.max(1, feedbackCount);
  res.json({ listings, itineraries, feedbackCount, avgSentiment: avgSent });
});

// Map sites (sample)
app.get('/api/map/sites', (req, res) => {
  const sites = [
    { id: "raj", name: "Dassam Falls", lat: 23.54, lon: 85.36, model: "/assets/models/dassam.glb", description: "Waterfall near Ranchi" },
    { id: "betla", name: "Betla National Park", lat: 24.21, lon: 84.26, model: "/assets/models/betla.glb", description: "Wildlife & safari" }
  ];
  res.json(sites);
});

// Serve static public files (frontend)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----------------- REALTIME: Chat & Transport -----------------
io.on('connection', (socket) => {
  console.log('WS client connected', socket.id);

  // Chat channel
  socket.on('chat:message', async (msg) => {
    // msg: { userId, text, language }
    // For demo: simple echo + AI response
    let reply = { text: `Echo: ${msg.text}` };
    if (hasOpenAI) {
      try {
        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: msg.text }],
          max_tokens: 300
        });
        reply.text = resp.choices[0].message.content;
      } catch (e) {
        reply.text = "AI error: " + e.message;
      }
    }
    socket.emit('chat:reply', { reply: reply.text, language: msg.language || 'en' });
  });

  // Transport updates: clients can subscribe/publish
  socket.on('transport:update', async (update) => {
    // update: { vehicleId, lat, lon, heading }
    await db.read();
    db.data.transports.push({ id: nanoid(), ...update, ts: Date.now() });
    await db.write();
    // broadcast to all clients
    io.emit('transport:broadcast', update);
  });

  socket.on('disconnect', () => console.log('WS disconnect', socket.id));
});

// Start
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
