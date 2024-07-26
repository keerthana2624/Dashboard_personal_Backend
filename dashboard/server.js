

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config(); // Import environment variables

const app = express();
const port = process.env.PORT || 5000; // Use PORT from environment variables



// Set up middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000', // Allow requests from this origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization','x-student-email']
}));
app.use(bodyParser.json());
app.use('/images', express.static(path.join(__dirname, 'images')));

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Registration endpoint
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

// Login endpoint
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

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM admins WHERE email = $1 AND password = $2', [email, password]);
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

// Fetch courses
app.get('/api/courses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: 'Failed to fetch courses. Please try again later.', details: err.message });
  }
});

// Submit application
app.post('/api/apply', async (req, res) => {
  const { courseId, personalDetails, educationalBackground, statementOfPurpose, applicantEmail } = req.body;
  const referenceNumber = `REF${Math.floor(Math.random() * 1000000)}`;

  console.log('Received application data:', { courseId, personalDetails, educationalBackground, statementOfPurpose, applicantEmail });

  if (!applicantEmail) {
    return res.status(400).json({ error: 'Applicant email is required.' });
  }

  try {
    await pool.query(
      'INSERT INTO applications (course_id, personal_details, educational_background, statement_of_purpose, applicant_email, reference_number, submitted_at, status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)',
      [courseId, personalDetails, educationalBackground, statementOfPurpose, applicantEmail, referenceNumber, 'pending']
    );

    // Send email confirmation
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: "keerthanamummy2002@msitprogram.net",
        pass: "Keerthi$@$058",
      },
    });

    const mailOptions = {
      from: "keerthanamummy2002@msitprogram.net",
      to: applicantEmail,
      subject: 'Application Confirmation',
      text: `Thank you for your application! Your reference number is ${referenceNumber}.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send confirmation email.', details: error.message });
      } else {
        console.log('Email sent:', info.response);
        res.status(200).json({ message: 'Application submitted and confirmation email sent.' });
      }
    });

  } catch (err) {
    console.error('Error submitting application:', err);
    res.status(500).json({ error: 'Failed to submit application. Please try again later.', details: err.message });
  }
});

// Fetch pending applications
app.get('/api/admin/pending-applications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applications WHERE status = $1', ['pending']);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending applications:', err);
    res.status(500).json({ error: 'Failed to fetch pending applications. Please try again later.', details: err.message });
  }
});

// Fetch approved applications
app.get('/api/admin/approved-applications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applications WHERE status = $1', ['approved']);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching approved applications:', err);
    res.status(500).json({ error: 'Failed to fetch approved applications. Please try again later.', details: err.message });
  }
});

// Handle application (approve/reject)
app.post('/api/admin/handle-application', async (req, res) => {
  const { applicationId, applicantEmail, action } = req.body;
  const status = action === 'approve' ? 'approved' : 'rejected';
  const subject = action === 'approve' ? 'Application Approved' : 'Application Rejected';
  const text = action === 'approve' ? 'Congratulations! Your application has been approved.' : 'We regret to inform you that your application has been rejected.';

  try {
    await pool.query('UPDATE applications SET status = $1 WHERE id = $2', [status, applicationId]);

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: "keerthanamummy2002@msitprogram.net",
        pass: "Keerthi$@$058",
      },
    });

    const mailOptions = {
      from:"keerthanamummy2002@msitprogram.net",
      to: applicantEmail,
      subject,
      text,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending approval email:', error);
        res.status(500).json({ error: 'Failed to send approval email.', details: error.message });
      } else {
        console.log('Approval email sent:', info.response);
        res.status(200).json({ message: 'Application status updated and email sent.' });
      }
    });

  } catch (err) {
    console.error('Error updating application status:', err);
    res.status(500).json({ error: 'Failed to update application status. Please try again later.', details: err.message });
  }
});



// Fetch applications for the logged-in student
app.get('/api/applications', async (req, res) => {
  const studentEmail = req.headers['x-student-email']; // Get the email from the request headers
  console.log(studentEmail);

  if (!studentEmail) {
    return res.status(400).json({ error: 'Student email is required' });
  }

  try {
    // Fetch applications for the specific student
    const query = 'SELECT * FROM applications WHERE applicant_email = $1';
    const result = await pool.query(query, [studentEmail]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications. Please try again later.', details: err.message });
  }
});


// Start server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please use a different port.`);
    process.exit(1);
  } else {
    console.error('Server error:', error);
  }
});


// new updated code




