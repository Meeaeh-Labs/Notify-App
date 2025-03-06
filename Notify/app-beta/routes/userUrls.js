const express = require('express');
const router = express.Router();
const UserUrl = require('../models/UserUrl');

function requireLogin(req, res, next) {
   if (!req.session.userId) {
      return res.redirect('/login');
   }
   next();
}

router.get('/user-urls', requireLogin, async (req, res) => {
   const userUrls = await UserUrl.find({ user: req.session.userId });
   res.render('user_urls', { userUrls, error: null });
});

router.post('/user-urls', requireLogin, async (req, res) => {
   const { url } = req.body;
   if (!url) {
      const userUrls = await UserUrl.find({ user: req.session.userId });
      return res.render('user_urls', { userUrls, error: 'URL is required.' });
   }
   try {
      const newUserUrl = new UserUrl({
         user: req.session.userId,
         url
      });
      await newUserUrl.save();
      res.redirect('/user-urls');
   } catch (err) {
      console.error(err);
      const userUrls = await UserUrl.find({ user: req.session.userId });
      res.render('user_urls', { userUrls, error: 'Error saving URL.' });
   }
});

router.post('/user-urls/:id/delete', requireLogin, async (req, res) => {
   try {
      await UserUrl.deleteOne({ _id: req.params.id, user: req.session.userId });
      res.redirect('/user-urls');
   } catch (err) {
      console.error(err);
      const userUrls = await UserUrl.find({ user: req.session.userId });
      res.render('user_urls', { userUrls, error: 'Error deleting URL.' });
   }
});

module.exports = router;
