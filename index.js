const express = require("express");
const cors = require("cors");
const requestIp = require("request-ip");
const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");
const apiRoutes = require("./routes/apiRoutes");
const firebaseConfig = require("./models/firebaseConfig");

const app = express();
const port = process.env.PORT || 4000;

app.set("trust proxy", true);

// Enable CORS for all requests
app.use(cors());

// Middleware to extract client's IP
app.use(requestIp.mw());

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.static("public"));
try {
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp);
  console.log("Firebase initialized successfully");
  app.use(apiRoutes(db));
} catch (error) {
  console.error("Error initializing Firebase:", error);
}
// Routes

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});