const express = require("express");
const { addKeyboardContents } = require("../controllers/ipCheckController");

module.exports = (db) => {

  const router = express.Router();

  router.post("/setInfo", (req, res) => addKeyboardContents(req, res, db));
  
  return router;
  
};