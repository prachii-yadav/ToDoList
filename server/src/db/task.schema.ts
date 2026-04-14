import { Schema, model, Document } from 'mongoose';
import { TaskPriority, TaskStatus } from '../types/task.types';

/**
 * MongoDB document shape. Uses an explicit UUID `id` field instead of ObjectId `_id`
 * so API responses stay consistent and Memento can restore tasks via Task.fromData().
 */
export interface ITaskDocument extends Document {
  id:          string;
  description: string;
  status:      TaskStatus;
  priority:    TaskPriority;
  tags:        string[];
  dueDate:     Date | null;
  createdAt:   Date;
  updatedAt:   Date;
}

const taskSchema = new Schema<ITaskDocument>(
  {
    // UUID is the primary identifier — _id is still created by Mongoose but stripped from responses.
    id: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    description: {
      type:     String,
      required: true,
      trim:     true,
    },

    status: {
      type:    String,
      enum:    Object.values(TaskStatus),
      default: TaskStatus.PENDING,
    },

    priority: {
      type:    String,
      enum:    Object.values(TaskPriority),
      default: TaskPriority.MEDIUM,
    },

    tags: {
      type:    [String],
      default: [],
    },

    dueDate: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true, // updatedAt is overridden in repository.save() to preserve Memento timestamps

    // Strip _id and __v from JSON output
    toJSON: {
      versionKey: false,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['_id'];
        return ret;
      },
    },
  }
);

export const TaskModel = model<ITaskDocument>('Task', taskSchema);
