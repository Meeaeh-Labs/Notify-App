const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Middleware to ensure the user is logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

// Updated GET /signup - Check if signup is disabled via settings
router.get('/signup', async (req, res) => {
   const Setting = require('../models/Setting');
   let setting = await Setting.findOne({}) || { disableSignup: false };
   if (setting.disableSignup) {
      return res.redirect('/error');
   }
   res.render('signup', { error: null });
});

router.post('/signup', async (req, res) => {
   const { email, password } = req.body;
   try {
      let user = await User.findOne({ email });
      if (user) {
         return res.render('signup', { error: 'Email already exists.' });
      }
      user = new User({ email, password });
      await user.save();
      req.session.userId = user._id;
      res.redirect('/dashboard');
   } catch (err) {
      console.error(err);
      res.render('signup', { error: 'Error creating account.' });
   }
});

// NEW: GET /login - Render the login view with the disableSignup setting
router.get('/login', async (req, res) => {
   const Setting = require('../models/Setting');
   let setting = await Setting.findOne({}) || { disableSignup: false };
   res.render('login', { error: null, disableSignup: setting.disableSignup });
});

router.post('/login', async (req, res) => {
   const { email, password } = req.body;
   try {
      const user = await User.findOne({ email });
      if (!user) {
         return res.render('login', { error: 'Invalid email or password.' });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
         return res.render('login', { error: 'Invalid email or password.' });
      }
      req.session.userId = user._id;
      res.redirect('/dashboard');
   } catch (err) {
      console.error(err);
      res.render('login', { error: 'Error logging in.' });
   }
});

router.get('/logout', (req, res) => {
   req.session.destroy();
   res.redirect('/login');
});

// NEW: GET /change-password - Render the change password form
router.get('/change-password', requireLogin, (req, res) => {
  res.render('change_password', { error: null });
});

// NEW: POST /change-password - Process the change password form
router.post('/change-password', requireLogin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.redirect('/login');
    }

    // Check if the current password is correct
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.render('change_password', { error: 'Current password is incorrect.' });
    }

    // Update the user’s password
    user.password = newPassword; // The pre-save hook in User.js will hash this
    await user.save();

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('change_password', { error: 'Error updating password.' });
  }
});

module.exports = router;
