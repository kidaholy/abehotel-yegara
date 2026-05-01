// This file is the entry point for Phusion Passenger on Yegara/cPanel.
// It loads the standalone Next.js server.

const path = require('path');

// Set the port to what Passenger expects (it usually passes it via an environment variable or a socket)
process.env.PORT = process.env.PORT || 3000;
process.env.NODE_ENV = 'production';

// Import the standalone server
// In the standalone build, server.js is the main entry point
require('./server.js');
