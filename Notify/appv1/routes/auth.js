const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/signup', (req, res) => {
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

router.get('/login', (req, res) => {
   res.render('login', { error: null });
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

module.exports = router;

