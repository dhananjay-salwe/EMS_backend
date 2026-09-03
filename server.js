require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/locations', require('./routes/locationRoutes'));
app.use('/api/votes', require('./routes/voteRoutes'));

app.use('/api/operators', require('./routes/operatorRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));

app.use('/api/parties', require('./routes/partyRoutes'));
app.use('/api/admins', require('./routes/adminRoutes'));

app.use('/api/candidates', require('./routes/candidateRoutes'));

app.use('/api/ward-reports', require('./routes/wardReportRoutes'));


// Keep-Alive / Health Check Route for UptimeRobot
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is awake', 
    timestamp: new Date().toISOString() 
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Production Server running on port ${port}`);
});