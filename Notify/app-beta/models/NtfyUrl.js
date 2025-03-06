const mongoose = require('mongoose');

const NtfyUrlSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    url: { type: String, required: true, unique: false }
}, { timestamps: true });

module.exports = mongoose.model('NtfyUrl', NtfyUrlSchema);
