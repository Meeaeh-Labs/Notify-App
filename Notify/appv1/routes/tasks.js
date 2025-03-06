// routes/tasks.js
const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const UserUrl = require('../models/UserUrl');  // Import the saved URLs model
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
   destination: function (req, file, cb) {
      cb(null, uploadDir);
   },
   filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
   }
});

const upload = multer({ 
   storage: storage,
   limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

function requireLogin(req, res, next) {
   if (!req.session.userId) {
      return res.redirect('/login');
   }
   next();
}

// Dashboard: list tasks for logged-in user
router.get('/dashboard', requireLogin, async (req, res) => {
   const tasks = await Task.find({ user: req.session.userId });
   res.render('dashboard', { tasks });
});

// Form to create a new task
router.get('/tasks/new', requireLogin, async (req, res) => {
   // Query the saved URLs for the logged in user
   const urls = await UserUrl.find({ user: req.session.userId });
   res.render('new_task', { error: null, userUrls: urls });
});

// Handle new task creation
router.post('/tasks/new', requireLogin, upload.single('file'), async (req, res) => {
   const { title, message, scheduledTime, ntfyUrlSelect, ntfyUrlOther, recurrence } = req.body;
   const recurring = req.body.recurring === 'on';
   // Determine final ntfyUrl based on dropdown selection
   const ntfyUrl = ntfyUrlSelect === 'other' ? ntfyUrlOther : ntfyUrlSelect;
   
   let filePath = null;
   if (req.file) {
      filePath = '/uploads/' + req.file.filename;
   }
   try {
      const task = new Task({
         user: req.session.userId,
         title,
         message,
         scheduledTime: scheduledTime ? new Date(scheduledTime) : new Date(),
         ntfyUrl,
         file: filePath,
         recurring,
         recurrence: recurring ? recurrence : undefined
      });
      await task.save();
      res.redirect('/dashboard');
   } catch (err) {
      console.error(err);
      // Query saved URLs again in case of error
      const urls = await UserUrl.find({ user: req.session.userId });
      res.render('new_task', { error: 'Error creating task.', userUrls: urls });
   }
});

// Form to edit an existing pending task
router.get('/tasks/:id/edit', requireLogin, async (req, res) => {
   try {
      const task = await Task.findOne({ _id: req.params.id, user: req.session.userId, status: 'pending' });
      if (!task) {
         return res.redirect('/dashboard');
      }
      // Query saved URLs for the dropdown.
      const urls = await UserUrl.find({ user: req.session.userId });
      res.render('edit_task', { task, error: null, userUrls: urls });
   } catch (err) {
      console.error(err);
      res.redirect('/dashboard');
   }
});

// Handle task updates
router.post('/tasks/:id/edit', requireLogin, upload.single('file'), async (req, res) => {
   const { title, message, scheduledTime, ntfyUrlSelect, ntfyUrlOther, recurrence } = req.body;
   const recurring = req.body.recurring === 'on';
   const ntfyUrl = ntfyUrlSelect === 'other' ? ntfyUrlOther : ntfyUrlSelect;
   
   let filePath = null;
   if (req.file) {
      filePath = '/uploads/' + req.file.filename;
   }
   try {
      const task = await Task.findOne({ _id: req.params.id, user: req.session.userId, status: 'pending' });
      if (!task) {
         return res.redirect('/dashboard');
      }
      task.title = title;
      task.message = message;
      task.scheduledTime = scheduledTime ? new Date(scheduledTime) : new Date();
      task.ntfyUrl = ntfyUrl;
      task.recurring = recurring;
      task.recurrence = recurring ? recurrence : undefined;
      if (filePath) {
         task.file = filePath;
      }
      await task.save();
      res.redirect('/dashboard');
   } catch (err) {
      console.error(err);
      const urls = await UserUrl.find({ user: req.session.userId });
      res.render('edit_task', { task, error: 'Error updating task.', userUrls: urls });
   }
});

module.exports = router;
