const mongoose = require('mongoose');
const { Schema } = mongoose;
const Milestone = require('./milestone');

const goalSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    targetDate: { type: String, required: true },
    milestones: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Milestone'
        }
    ],
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Goal', goalSchema);