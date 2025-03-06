const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const UserUrl = require('../models/UserUrl'); // For saved URL retrieval
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User'); // Added to fetch user details

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
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

// GET /dashboard: List tasks for the logged-in user
router.get('/dashboard', requireLogin, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.session.userId });
    const user = await User.findById(req.session.userId); // Fetch the user object
    res.render('dashboard', { tasks, user });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// GET /tasks/new: Render "Create New Task" view with saved URLs
router.get('/tasks/new', requireLogin, async (req, res) => {
  try {
    const urls = await UserUrl.find({ user: req.session.userId });
    res.render('new_task', { error: null, userUrls: urls });
  } catch (err) {
    console.error(err);
    res.render('new_task', { error: 'Error loading saved URLs.', userUrls: [] });
  }
});

// POST /tasks/new: Create a new task (extracts priority from form)
router.post('/tasks/new', requireLogin, upload.single('file'), async (req, res) => {
  const { title, message, scheduledTime, ntfyUrlSelect, ntfyUrlOther, recurrence, priority } = req.body;
  const recurring = req.body.recurring === 'on';
  // Determine final Ntfy URL based on dropdown selection
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
      recurrence: recurring ? recurrence : undefined,
      priority: priority ? Number(priority) : 3  // Default priority is 3 if not provided
    });
    await task.save();
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    const urls = await UserUrl.find({ user: req.session.userId });
    res.render('new_task', { error: 'Error creating task.', userUrls: urls });
  }
});

// GET /tasks/:id/edit: Render "Edit Task" view with saved URLs
router.get('/tasks/:id/edit', requireLogin, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.session.userId, status: 'pending' });
    if (!task) return res.redirect('/dashboard');
    const urls = await UserUrl.find({ user: req.session.userId });
    res.render('edit_task', { task, error: null, userUrls: urls });
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
  }
});

// POST /tasks/:id/edit: Update an existing task (including priority)
router.post('/tasks/:id/edit', requireLogin, upload.single('file'), async (req, res) => {
  const { title, message, scheduledTime, ntfyUrlSelect, ntfyUrlOther, recurrence, priority } = req.body;
  const recurring = req.body.recurring === 'on';
  const ntfyUrl = ntfyUrlSelect === 'other' ? ntfyUrlOther : ntfyUrlSelect;
  let filePath = null;
  if (req.file) {
    filePath = '/uploads/' + req.file.filename;
  }
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.session.userId, status: 'pending' });
    if (!task) return res.redirect('/dashboard');
    task.title = title;
    task.message = message;
    task.scheduledTime = scheduledTime ? new Date(scheduledTime) : new Date();
    task.ntfyUrl = ntfyUrl;
    task.recurring = recurring;
    task.recurrence = recurring ? recurrence : undefined;
    task.priority = priority ? Number(priority) : task.priority;
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

// POST /tasks/:id/delete: Delete a task
router.post('/tasks/:id/delete', requireLogin, async (req, res) => {
  try {
    await Task.deleteOne({ _id: req.params.id, user: req.session.userId });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
  }
});

module.exports = router;
