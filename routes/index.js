const express = require('express');
const router = express.Router();
const path = require('path');

// Route for fetching all movies
router.get('/movies', async (req, res) => {
  try {
    const movies = await req.db('basics').select('*'); // Query the 'basics' table
    res.json(movies);
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).send('Error fetching movies');
  }
});

router.get('/movies/search', async (req, res) => {
  const { title, year, page = 1, perPage = 100 } = req.query;

  try {
    // Validate the year format if provided
    if (year && !/^\d{4}$/.test(year)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid year format. Format must be yyyy.',
      });
    }

    // Build the base query dynamically
    let query = req.db('basics').select(
      'primaryTitle as Title',      // Correct column for title
      'startYear as Year',          // Correct column for year
      'tconst as imdbID',           // Correct column for IMDb ID
      'titleType as Type'           // Correct column for type
    );

    // Add filters based on query parameters
    if (title) query = query.where('primaryTitle', 'like', `%${title}%`);
    if (year) query = query.where('startYear', year);

    // Get the total number of results (without pagination)
    const total = await req.db('basics')
      .where((builder) => {
        if (title) builder.where('primaryTitle', 'like', `%${title}%`);
        if (year) builder.where('startYear', year);
      })
      .count('* as count')
      .first()
      .then((result) => result.count);

    // Calculate pagination details
    const lastPage = Math.ceil(total / perPage); // Last page number
    const offset = (page - 1) * perPage; // Starting offset for the current page

    // Apply pagination to the query
    query = query.limit(perPage).offset(offset);

    // Fetch paginated data
    const movies = await query;

    // Construct the response object
    res.json({
      data: movies,
      pagination: {
        total: total,
        lastPage: lastPage,
        perPage: parseInt(perPage, 10),
        currentPage: parseInt(page, 10),
        from: offset + 1,
        to: offset + movies.length,
      },
    });
  } catch (error) {
    console.error('Error searching for movies:', error);
    res.status(500).json({
      error: true,
      message: 'Error searching for movies',
    });
  }
});

router.get('/movies/data/:imdbID', async (req, res) => {
  const { imdbID } = req.params;

  // Check for query parameters
  if (Object.keys(req.query).length > 0) {
    return res.status(400).json({
      error: true,
      message: `Invalid query parameters: ${Object.keys(req.query).join(', ')}. Query parameters are not permitted.`,
    });
  }

  try {
    // Fetch the movie details from the basics table
    const movie = await req.db('basics')
      .select(
        'primaryTitle as Title',
        'startYear as Year',
        'runtimeMinutes as Runtime',
        'genres as Genre',
        'tconst'
      )
      .where('tconst', imdbID)
      .first();

    if (!movie) {
      return res.status(404).json({
        error: true,
        message: 'Movie not found.',
      });
    }

    // Fetch the ratings from the ratings table
    const ratings = await req.db('ratings')
      .select('averageRating', 'numVotes')
      .where('tconst', imdbID)
      .first();

    const formattedRatings = ratings
      ? [
          {
            Source: 'Internet Movie Database',
            Value: `${ratings.averageRating}/10`,
          },
        ]
      : [];

    // Fetch the directors and writers from the crew table
    const crew = await req.db('crew')
      .select('directors', 'writers')
      .where('tconst', imdbID)
      .first();

    let directors = [];
    let writers = [];

    if (crew) {
      // Fetch director names
      if (crew.directors) {
        const directorIds = crew.directors.split(',');
        directors = await req.db('names')
          .select('primaryName')
          .whereIn('nconst', directorIds)
          .then((rows) => rows.map((row) => row.primaryName));
      }

      // Fetch writer names
      if (crew.writers) {
        const writerIds = crew.writers.split(',');
        writers = await req.db('names')
          .select('primaryName')
          .whereIn('nconst', writerIds)
          .then((rows) => rows.map((row) => row.primaryName));
      }
    }

    // Fetch actors from the principals table
    const actors = await req.db('principals')
      .join('names', 'principals.nconst', 'names.nconst')
      .select('names.primaryName')
      .where('principals.tconst', imdbID)
      .andWhere('principals.category', 'actor')
      .orderBy('principals.ordering') // Order by the ordering field
      .limit(4) // Assuming you want only the top 4 actors
      .then((rows) => rows.map((row) => row.primaryName));

    // Construct the response
    const response = {
      Title: movie.Title,
      Year: movie.Year,
      Runtime: `${movie.Runtime} min`,
      Genre: movie.Genre,
      Director: directors.join(', ') || '',
      Writer: writers.join(', ') || '',
      Actors: actors.join(', ') || '',
      Ratings: formattedRatings,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching movie data:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching movie data.',
    });
  }
});

module.exports = router;
