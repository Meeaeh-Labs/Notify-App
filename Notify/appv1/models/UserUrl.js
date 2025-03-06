const mongoose = require('mongoose');

const UserUrlSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  url: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('UserUrl', UserUrlSchema);
