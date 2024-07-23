const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config(); // Import environment variables

const app = express();
const port = 5000;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Configure CORS to allow requests from specific origins
app.use(cors({
  origin: ['http://localhost:3005', 'http://localhost:3006'], // Add all relevant origins here
}));

app.use(bodyParser.json());
app.use('/images', express.static(path.join(__dirname, 'images')));

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('INSERT INTO students (email, password) VALUES ($1, $2) RETURNING *', [email, password]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Registration failed. Please try again later.', details: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM students WHERE email = $1 AND password = $2', [email, password]);
    if (result.rows.length > 0) {
      res.json({ token: 'dummy-jwt-token', user: result.rows[0] });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Login failed. Please try again later.', details: err.message });
  }
});

app.get('/api/courses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: 'Failed to fetch courses. Please try again later.', details: err.message });
  }
});

app.post('/api/apply', async (req, res) => {
  const { courseId, personalDetails, educationalBackground, statementOfPurpose, applicantEmail } = req.body;
  const referenceNumber = `REF${Math.floor(Math.random() * 1000000)}`;

  console.log('Received application data:', { courseId, personalDetails, educationalBackground, statementOfPurpose, applicantEmail });

  if (!applicantEmail) {
    return res.status(400).json({ error: 'Applicant email is required.' });
  }

  try {
    await pool.query(
      'INSERT INTO applications (course_id, personal_details, educational_background, statement_of_purpose, applicant_email, reference_number, submitted_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
      [courseId, personalDetails, educationalBackground, statementOfPurpose, applicantEmail, referenceNumber]
    );
    
  } catch (err) {
    console.error('Error submitting application:', err);
    res.status(500).json({ error: 'Failed to submit application. Please try again later.', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
