// Passenger entry point for cPanel/Yegara hosting
// The Next.js standalone build creates its own server.js — just require it.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('./server.js');
