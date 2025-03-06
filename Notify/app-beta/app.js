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
  .then(async () => {
    console.log('MongoDB connected');

    // Create default admin account if it doesn't exist
    const User = require('./models/User');
    const adminEmail = 'notify@admin.com';
    const adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      const newAdmin = new User({
         email: adminEmail,
         password: 'Chang3Me',
         role: 'admin'
      });
      await newAdmin.save();
      console.log('Default admin account created: notify@admin.com / Chang3Me');
    } else {
      console.log('Default admin account already exists.');
    }
  })
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

// Admin routes
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);

// Error route for unauthorized access to admin pages
app.get('/error', (req, res) => {
  res.render('error', { message: "Oops, you can't access this page" });
});

// Scheduler: check for pending tasks every minute
const Task = require('./models/Task');

async function processTask(task) {
  try {
    // Use default priority "3" if task.priority is undefined
    const prio = task.priority !== undefined ? task.priority.toString() : "3";
    let headers = {
      'Priority': prio,
      'Title': task.title
    };

    if (task.file) {
      // If file attached, send via PUT per ntfy docs
      const filePath = path.join(__dirname, 'public', task.file);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const filename = path.basename(filePath);
        const contentType = mime.lookup(filePath) || 'application/octet-stream';
        
        // Add file-specific headers
        headers['Filename'] = filename;
        headers['Content-Type'] = contentType;
        if (task.message) {
          headers['Message'] = task.message;
        }
        
        await axios.put(task.ntfyUrl, fileBuffer, { headers });
        
        // Delete file after sending
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        });
      } else {
        console.error(`File not found: ${filePath}`);
      }
    } else {
      // No file attached – send plain text via POST
      headers['Content-Type'] = 'text/plain';
      await axios.post(task.ntfyUrl, task.message, { headers });
    }
    
    // Recurring task logic:
    if (task.recurring) {
      let nextTime = new Date(task.scheduledTime);
      switch (task.recurrence) {
        case 'hourly':
          nextTime.setHours(nextTime.getHours() + 1);
          break;
        case 'daily':
          nextTime.setDate(nextTime.getDate() + 1);
          break;
        case 'weekly':
          nextTime.setDate(nextTime.getDate() + 7);
          break;
        case 'monthly':
          nextTime.setMonth(nextTime.getMonth() + 1);
          break;
        default:
          nextTime.setHours(nextTime.getHours() + 1);
      }
      task.scheduledTime = nextTime;
      // Keep status "pending" for recurring tasks so they remain editable
      await task.save();
      console.log(`Recurring task ${task._id} sent and rescheduled for ${nextTime}`);
    } else {
      task.status = 'sent';
      await task.save();
      console.log(`Task ${task._id} sent.`);
    }
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
