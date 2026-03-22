const express    = require("express");
const router     = express.Router();
const codeController = require("../controllers/codeController");

router.post("/run",    codeController.runCode);    // Run button
router.post("/submit", codeController.submitCode); // Submit button

module.exports = router;