const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  disableSignup: { type: Boolean, default: false }
});

module.exports = mongoose.model('Setting', SettingSchema);
