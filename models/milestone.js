const mongoose = require('mongoose');
const { Schema } = mongoose;

const MilestoneSchema = new Schema({
    description: { type: String, required: true },
    dueDate: { type: String },
    tasks: {
        type: Schema.Types.ObjectId,
        ref: 'Task'
    }
});

module.exports = mongoose.model('Milestone', MilestoneSchema);