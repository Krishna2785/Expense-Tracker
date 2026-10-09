// server/models/User.js
// Mongoose schema and model for application users.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the blueprint for what each User document in MongoDB must look like
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      trim: true,
      lowercase: true, // Automatically converts email to lowercase to prevent duplicates like Test@mail.com vs test@mail.com
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
  },
  {
    // Automatically creates 'createdAt' and 'updatedAt' timestamps for each user
    timestamps: true,
  }
);

/**
 * Mongoose Pre-save Middleware (Hook).
 * Runs automatically BEFORE a user document is saved to MongoDB.
 * If the password was modified (e.g. registration or password change),
 * we hash it using bcrypt with salt rounds of 10.
 */
userSchema.pre('save', async function () {
  // Only hash the password if it has been modified or is newly created
  if (!this.isModified('password')) {
    return;
  }

  // Generate a salt (random data added to password before hashing)
  const salt = await bcrypt.genSalt(10);
  // Hash the plain-text password with the salt
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Custom Instance Method: matchPassword
 * Compares an entered plain-text password with the hashed password stored in the database.
 * Returns true if passwords match, false otherwise.
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
