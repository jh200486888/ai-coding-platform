const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db/database');
const postsRouter = require('./routes/posts');
const authRouter = require('./routes/auth');
const uploadRouter = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/posts', postsRouter);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRouter);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Init DB and start server
initDB();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
