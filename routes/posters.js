const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth'); 

// Configure multer for file uploads
const upload = multer({ dest: 'res/posters/' });

// Route: Get a poster by imdbID
router.get('/:imdbID', authenticateToken, async (req, res) => {
  const { imdbID } = req.params;

  try {
    // Validate query parameters
    if (Object.keys(req.query).length > 0) {
      return res.status(400).json({
        error: true,
        message: `Invalid query parameters: ${Object.keys(req.query).join(', ')}. Query parameters are not permitted.`,
      });
    }

    // Fetch the poster path from the database
    const poster = await req.db('posters').where({ imdbID }).first();

    // If no record is found in the database
    if (!poster) {
      return res.status(404).json({
        error: true,
        message: `Poster not found for the given imdbID: ${imdbID}.`,
      });
    }

    // Resolve the full path of the poster
    const posterPath = path.resolve(poster.posterPath);

    // Check if the file exists
    if (!fs.existsSync(posterPath)) {
      return res.status(404).json({
        error: true,
        message: `Poster file not found on the server at path: ${posterPath}.`,
      });
    }

    // Serve the poster file
    res.sendFile(posterPath);
  } catch (error) {
    console.error('Unexpected error:', error);

    res.status(500).json({
      error: true,
      message: 'An unexpected error occurred while fetching the poster.',
    });
  }
});

// Route: Add a poster for a specific imdbID
router.post('/add/:imdbID', authenticateToken, upload.single('poster'), async (req, res) => {
  const { imdbID } = req.params;

  try {
    // Validate query parameters
    if (Object.keys(req.query).length > 0) {
      return res.status(400).json({
        error: true,
        message: 'Invalid query parameters. Query parameters are not permitted.',
      });
    }

    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: 'No file uploaded. Please upload a valid poster.',
      });
    }

    // Define the poster directory and file path
    const posterDir = path.join(__dirname, '..', 'res', 'posters');
    const filePath = path.join(posterDir, `${imdbID}.png`);

    // Ensure the posters directory exists
    if (!fs.existsSync(posterDir)) {
      fs.mkdirSync(posterDir, { recursive: true });
    }

    // Move the uploaded file to the target location
    fs.renameSync(req.file.path, filePath);

    // Insert metadata into the database
    await req.db('posters').insert({
      imdbID: imdbID,
      posterPath: filePath, // Save the relative path or full path based on your preference
    });

    // Respond with success
    res.status(201).json({
      error: false,
      message: 'Poster uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading poster:', error);

    if (error.code === 'ENOENT') {
      return res.status(500).json({
        error: true,
        message: `ENOENT: no such file or directory, open '${error.path}'`,
      });
    }

    res.status(500).json({
      error: true,
      message: 'An unexpected error occurred while uploading the poster.',
    });
  }
});

module.exports = router;
