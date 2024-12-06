const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const options = require('./knexfile.js');
const knex = require('knex')(options);
require('dotenv').config();
const cors = require('cors');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const postersRouter = require('./routes/posters');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Test if mysql2 is loaded
try {
  require('mysql2');
  console.log('mysql2 is loaded correctly.');
} catch (err) {
  console.error('Error loading mysql2:', err);
}

app.use(logger('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Attach Knex instance to req BEFORE defining routes
app.use((req, res, next) => {
  req.db = knex; // Attach Knex instance to the request object
  next();
});

// Define routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/posters', postersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
