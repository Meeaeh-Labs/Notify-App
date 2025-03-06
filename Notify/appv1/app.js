const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('./config/config');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const mime = require('mime-types');

const app = express();

// Connect to MongoDB
mongoose.connect(config.mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false
}));

// Routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const userUrlsRoutes = require('./routes/userUrls');

app.use(authRoutes);
app.use(taskRoutes);
app.use(userUrlsRoutes);

// Scheduler: check for pending tasks every minute
const Task = require('./models/Task');

async function processTask(task) {
  try {
    if (task.file) {
      // Send file attachments using PUT, per ntfy docs
      const filePath = path.join(__dirname, 'public', task.file);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const filename = path.basename(filePath);
        const contentType = mime.lookup(filePath) || 'application/octet-stream';
        
        // Build headers as shown in ntfy docs
        const headers = {
          'Filename': filename,
          'Title': task.title,
          'Content-Type': contentType
        };
        // Optionally, include a Message header if provided
        if (task.message) {
          headers['Message'] = task.message;
        }
        
        // Use PUT to send the file directly
        await axios.put(task.ntfyUrl, fileBuffer, { headers });
        
        // Delete the file after successful send
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        });
      } else {
        console.error(`File not found: ${filePath}`);
      }
    } else {
      // No file attached – send plain text notification
      const messageBody = task.message;
      const headers = {
        'Title': task.title,
        'Content-Type': 'text/plain'
      };
      await axios.post(task.ntfyUrl, messageBody, { headers });
    }
    // Mark task as sent and save.
    task.status = 'sent';
    await task.save();
    console.log(`Task ${task._id} sent.`);
  } catch (err) {
    console.error(`Error sending task ${task._id}:`, err.message);
  }
}

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const tasks = await Task.find({ status: 'pending', scheduledTime: { $lte: now } });
  tasks.forEach(task => {
    processTask(task);
  });
});

// Daily cleanup: Delete tasks sent over 30 days ago.
cron.schedule('0 0 * * *', async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const result = await Task.deleteMany({
      status: 'sent',
      createdAt: { $lte: cutoff }
    });
    console.log(`Cleanup: Deleted ${result.deletedCount} sent tasks older than 30 days.`);
  } catch (err) {
    console.error('Error cleaning up tasks:', err.message);
  }
});

// Home route redirect
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
