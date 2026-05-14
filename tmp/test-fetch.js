const http = require('http');

async function testApi() {
  try {
    // Generate an admin token or just simulate the GET if we can
    // Wait, we don't have a token. Can we see the logs of the running server?
    console.log("We need to check the orders in DB.");
  } catch(e) {
    console.error(e);
  }
}
testApi();
