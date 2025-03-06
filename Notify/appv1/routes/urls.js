const express = require('express');
const router = express.Router();
const NtfyUrl = require('../models/NtfyUrl');
const { requireLogin } = require('../middleware/auth');

// Get all saved URLs for the logged-in user
router.get('/urls', requireLogin, async (req, res) => {
    try {
        const urls = await NtfyUrl.find({ user: req.session.userId });
        res.json(urls);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching URLs' });
    }
});

// Add a new Ntfy URL
router.post('/urls/add', requireLogin, async (req, res) => {
    try {
        const urlCount = await NtfyUrl.countDocuments({ user: req.session.userId });

        if (urlCount >= 50) {
            return res.status(400).json({ error: 'URL limit reached (50 max).' });
        }

        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required.' });

        const newUrl = new NtfyUrl({ user: req.session.userId, url });
        await newUrl.save();
        res.json({ message: 'URL saved successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error saving URL' });
    }
});

// Delete a saved URL
router.post
