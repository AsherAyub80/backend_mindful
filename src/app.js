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

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        process.env.APP_URL || 'https://mindfulmeals.app',
        process.env.ADMIN_URL || 'https://admin.mindfulmeals.app',
      ]
    : ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:5174', '*'],
  credentials: true,
}));
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
