const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.post('/register', [
    // Validation
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  async (req, res) => {
    const { email, password } = req.body;

    // Check for missing fields BEFORE validation
    if (!email || !password) {
      return res.status(400).json({
        error: true,
        message: 'Request body incomplete, both email and password are required',
      });
    }

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: true,
        message: 'Validation failed',
        details: errors.array(),
      });
    }

    try {
      // Check if user already exists
      const userExists = await req.db('users').select('*').where('email', email).first();
      if (userExists) {
        return res.status(409).json({
          error: true,
          message: 'User already exists',
        });
      }

      // Hash the password and save the user
      const hashedPassword = await bcrypt.hash(password, 10);
      await req.db('users').insert({ email, hash: hashedPassword });

      res.status(201).json({
        message: 'User created',
      });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({
        error: true,
        message: 'Error registering user',
      });
    }
  }
);

router.post(
  '/login',
  [
    // Validation rules
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  async (req, res) => {
    const { email, password } = req.body;

    // Check for missing fields BEFORE validation
    if (!email || !password) {
      return res.status(400).json({
        error: true,
        message: 'Request body incomplete, both email and password are required',
      });
    }

    // Run validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: true,
        message: 'Validation failed',
        details: errors.array(),
      });
    }

    try {
      // Check if user exists
      const user = await req.db('users').select('*').where('email', email).first();
      if (!user) {
        return res.status(401).json({
          error: true,
          message: 'Incorrect email or password',
        });
      }

      // Verify the password
      const match = await bcrypt.compare(password, user.hash);
      if (!match) {
        return res.status(401).json({
          error: true,
          message: 'Incorrect email or password',
        });
      }

      // Generate JWT token
      const expires_in = 60 * 60 * 24; // 24 hours
      const exp = Math.floor(Date.now() / 1000) + expires_in;
      const token = jwt.sign({ email: user.email, exp }, process.env.JWT_SECRET);

      res.status(200).json({
        token,
        token_type: 'Bearer',
        expires_in,
      });
    } catch (error) {
      console.error('Error logging in user:', error);
      res.status(500).json({
        error: true,
        message: 'Error logging in user',
      });
    }
  }
);


module.exports = router;
