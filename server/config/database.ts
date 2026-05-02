import mongoose from "mongoose"
import "../../lib/dns-fix"


let isConnected = false

const connectDB = async () => {
  console.log("JSON Storage Mode: Database connection skipped for Express server.");
}

export default connectDB
