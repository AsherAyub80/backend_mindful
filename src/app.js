const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const moodRoutes = require('./routes/mood.routes');
const mealRoutes = require('./routes/meal.routes');
const restaurantRoutes = require('./routes/restaurant.routes');
const postRoutes = require('./routes/post.routes');
const uploadRoutes = require('./routes/upload.routes');
const adminRoutes = require('./routes/admin.routes');
const { registerSwagger } = require('./docs/swagger');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

function parseEnvList(value) {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const isProduction = process.env.NODE_ENV === 'production';
const defaultOrigins = isProduction
  ? [
      process.env.APP_URL || 'https://mindfulmeals.app',
      process.env.ADMIN_URL || 'https://admin.mindfulmeals.app',
    ]
  : ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:5174'];

const allowedOrigins = new Set([
  ...defaultOrigins,
  ...parseEnvList(process.env.CORS_ORIGINS),
]);

const allowedOriginPatterns = parseEnvList(process.env.CORS_ORIGIN_REGEX)
  .map((pattern) => {
    try {
      return new RegExp(pattern);
    } catch (_) {
      console.warn(`Ignoring invalid CORS regex: ${pattern}`);
      return null;
    }
  })
  .filter(Boolean);

const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true';

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.has(origin)) {
    return true;
  }

  if (allowVercelPreviews && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
    return true;
  }

  return allowedOriginPatterns.some((pattern) => pattern.test(origin));
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MindfulMeals API',
    version: '3.1.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/v1/auth', authRoutes);
app.use('/v1/users', userRoutes);
app.use('/v1/moods', moodRoutes);
app.use('/v1/meals', mealRoutes);
app.use('/v1/restaurants', restaurantRoutes);
app.use('/v1/posts', postRoutes);
app.use('/v1/uploads', uploadRoutes);
app.use('/v1/admin', adminRoutes);

registerSwagger(app);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

app.use(errorHandler);

module.exports = app;
