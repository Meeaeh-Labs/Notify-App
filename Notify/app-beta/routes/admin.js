const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Setting = require('../models/Setting'); // New: import the Setting model
const bcrypt = require('bcryptjs');

// Middleware to ensure the user is an admin
function isAdmin(req, res, next) {
  if (req.session.userId) {
    // Retrieve the user from the DB to check their role
    User.findById(req.session.userId, (err, user) => {
      if (err || !user || user.role !== 'admin') {
        return res.redirect('/error');
      }
      // Attach the logged-in admin to req for later use
      req.user = user;
      next();
    });
  } else {
    return res.redirect('/login');
  }
}

// Protect all routes under /admin
router.use(isAdmin);

// GET /admin/dashboard - List all users and fetch settings
router.get('/dashboard', async (req, res) => {
  try {
    const users = await User.find({});
    let setting = await Setting.findOne({});
    if (!setting) {
      // Create default setting if not present
      setting = new Setting({ disableSignup: false });
      await setting.save();
    }
    // Pass session and currentUser to the view along with the setting
    res.render('admin_dashboard', { users, session: req.session, currentUser: req.user, setting });
  } catch (err) {
    res.redirect('/error');
  }
});

// POST /admin/settings - Update the signup setting
router.post('/settings', async (req, res) => {
  try {
    const { disableSignup } = req.body; // checkbox returns "on" if checked
    let setting = await Setting.findOne({});
    if (!setting) {
      setting = new Setting();
    }
    setting.disableSignup = (disableSignup === 'on');
    await setting.save();
    res.redirect('/admin/dashboard');
  } catch (err) {
    res.redirect('/error');
  }
});

// GET /admin/create - Show form to create a new user
router.get('/create', (req, res) => {
  res.render('create_user', { error: null });
});

// POST /admin/create - Create a new user (admin can choose role)
router.post('/create', async (req, res) => {
  const { email, password, role } = req.body;
  try {
    // Only allow valid roles; if an invalid role is submitted, default to 'user'
    const validRole = (role === 'admin') ? 'admin' : 'user';
    const newUser = new User({ email, password, role: validRole });
    await newUser.save();
    res.redirect('/admin/dashboard');
  } catch (err) {
    res.render('create_user', { error: 'Error creating user.' });
  }
});

// POST /admin/users/:id/delete - Delete a user
router.post('/users/:id/delete', async (req, res) => {
  try {
    // Prevent an admin from deleting their own account
    if (req.session.userId === req.params.id) {
      return res.redirect('/error');
    }
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
  } catch (err) {
    res.redirect('/error');
  }
});

// POST /admin/users/:id/change-password - Change a user's password
router.post('/users/:id/change-password', async (req, res) => {
  const { newPassword } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.redirect('/error');
    user.password = newPassword; // The pre-save hook will hash this
    await user.save();
    res.redirect('/admin/dashboard');
  } catch (err) {
    res.redirect('/error');
  }
});

// POST /admin/users/:id/change-role - Change a user's role
router.post('/users/:id/change-role', async (req, res) => {
  const { newRole } = req.body; // expected to be 'user' or 'admin'
  try {
    // Prevent an admin from changing their own role
    if (req.session.userId === req.params.id) {
      return res.redirect('/error');
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.redirect('/error');
    user.role = (newRole === 'admin') ? 'admin' : 'user';
    await user.save();
    res.redirect('/admin/dashboard');
  } catch (err) {
    res.redirect('/error');
  }
});

module.exports = router;
