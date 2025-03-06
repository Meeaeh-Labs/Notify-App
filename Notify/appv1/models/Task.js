// models/Task.js
const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
   title: { type: String, required: true },
   message: { type: String },
   file: { type: String },
   scheduledTime: { type: Date, required: true },
   ntfyUrl: { type: String, required: true },
   status: { type: String, enum: ['pending', 'sent', 'canceled'], default: 'pending' },
   recurring: { type: Boolean, default: false },
   // Only required when recurring is true.
   recurrence: { 
      type: String, 
      enum: ['hourly', 'daily', 'weekly', 'monthly'],
      required: function() { return this.recurring; }
   }
}, { timestamps: true });

module.exports = mongoose.model('Task', TaskSchema);
