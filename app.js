// Passenger entry point for cPanel/Yegara hosting
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '3000';

console.log('Starting AbeHotel standalone server...');
require('./server.js');
