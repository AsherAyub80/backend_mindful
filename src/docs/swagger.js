const swaggerUi = require('swagger-ui-express');

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

function jsonContent(schema, example) {
  const content = { 'application/json': { schema } };
  if (example !== undefined) {
    content['application/json'].example = example;
  }
  return { content };
}

function jsonRequestBody(schema, required = true, example) {
  return {
    required,
    ...jsonContent(schema, example),
  };
}

function multipartRequestBody(schema, required = true) {
  return {
    required,
    content: {
      'multipart/form-data': {
        schema,
      },
    },
  };
}

function response(description, schema, example) {
  return {
    description,
    ...(schema ? jsonContent(schema, example) : {}),
  };
}

function param(name, location, schema, required = false, description) {
  return { name, in: location, schema, required, description };
}

function boolQuery(name, description) {
  return param(name, 'query', { type: 'boolean' }, false, description);
}

function intQuery(name, description, defaultValue) {
  const schema = { type: 'integer' };
  if (defaultValue !== undefined) schema.default = defaultValue;
  return param(name, 'query', schema, false, description);
}

const secure = [{ bearerAuth: [] }];
const moodEnum = ['Calm', 'Energized', 'Comfort', 'Focus', 'Happy'];
const postTypeEnum = ['recipe', 'dining'];
const userRoleEnum = ['user', 'admin', 'moderator'];
const userStatusEnum = ['active', 'inactive', 'suspended'];

function createOpenApiSpec(baseUrl) {
  const normalizedBaseUrl = String(baseUrl || '').replace(/\/+$/, '');

  return {
    openapi: '3.0.3',
    info: {
      title: 'MindfulMeals API',
      version: '3.1.0',
      description: 'Swagger documentation for the MindfulMeals backend. Use the Authorize button with a JWT access token returned by `/v1/auth/login` or `/v1/auth/register`.',
    },
    servers: [
      {
        url: normalizedBaseUrl,
        description: 'Current server',
      },
    ],
    tags: [
      { name: 'System', description: 'Health checks and service metadata' },
      { name: 'Auth', description: 'Registration, login, refresh, and logout' },
      { name: 'Users', description: 'User profile, preferences, and follows' },
      { name: 'Moods', description: 'Mood logging and AI insights' },
      { name: 'Meals', description: 'Meal discovery, saving, and AI suggestions' },
      { name: 'Restaurants', description: 'Restaurant discovery and experiences' },
      { name: 'Posts', description: 'Community feed, likes, and comments' },
      { name: 'Uploads', description: 'Supabase-backed image uploads' },
      { name: 'Admin', description: 'Admin dashboard and moderation routes' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste the JWT access token here. Swagger will send it as `Authorization: Bearer <token>`.',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string', nullable: true },
          },
          required: ['error'],
        },
        ValidationErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Validation failed' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
                required: ['field', 'message'],
              },
            },
          },
          required: ['error', 'details'],
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            service: { type: 'string', example: 'MindfulMeals API' },
            version: { type: 'string', example: '3.1.0' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['status', 'service', 'version', 'timestamp'],
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            handle: { type: 'string' },
            avatar_url: { type: 'string', format: 'uri', nullable: true },
            bio: { type: 'string', nullable: true },
            streak_count: { type: 'integer' },
            role: { type: 'string', enum: userRoleEnum, nullable: true },
            status: { type: 'string', enum: userStatusEnum, nullable: true },
            created_at: { type: 'string', format: 'date-time', nullable: true },
          },
          required: ['id', 'name', 'handle'],
        },
        PublicUser: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            handle: { type: 'string' },
            avatar_url: { type: 'string', format: 'uri', nullable: true },
            bio: { type: 'string', nullable: true },
            streak_count: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time', nullable: true },
          },
          required: ['id', 'name', 'handle'],
        },
        UserPreferences: {
          type: 'object',
          properties: {
            user_id: { type: 'string', format: 'uuid' },
            dietary_tags: { type: 'array', items: { type: 'string' } },
            allergy_tags: { type: 'array', items: { type: 'string' } },
            goal_tags: { type: 'array', items: { type: 'string' } },
            calorie_target: { type: 'integer', nullable: true },
            notifications_on: { type: 'boolean' },
            updated_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        MoodIntent: {
          type: 'object',
          properties: {
            intent: { type: 'string' },
            nutrientsFocus: { type: 'array', items: { type: 'string' } },
            foodsToEmphasize: { type: 'array', items: { type: 'string' } },
            foodsToAvoid: { type: 'array', items: { type: 'string' } },
            cuisineStyles: { type: 'array', items: { type: 'string' } },
            ambienceNeeds: { type: 'string' },
            mealTone: { type: 'string' },
          },
          additionalProperties: true,
        },
        MoodInsights: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            dominantMood: { type: 'string' },
            moodTrend: { type: 'string' },
            insight: { type: 'string' },
            recommendation: { type: 'string' },
            affirmation: { type: 'string' },
            hasInsights: { type: 'boolean' },
            logCount: { type: 'integer' },
            message: { type: 'string' },
          },
          additionalProperties: true,
        },
        MoodLog: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            mood: { type: 'string', enum: moodEnum },
            mood_score: { type: 'number', nullable: true },
            context: { type: 'string', enum: ['cook', 'dining'], nullable: true },
            logged_at: { type: 'string', format: 'date-time', nullable: true },
          },
          required: ['mood'],
        },
        MealIngredient: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', nullable: true },
            name: { type: 'string' },
            quantity: { type: 'string', nullable: true },
            sort_order: { type: 'integer', nullable: true },
          },
          required: ['name'],
        },
        MealStep: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', nullable: true },
            step_number: { type: 'integer' },
            instruction: { type: 'string' },
          },
          required: ['step_number', 'instruction'],
        },
        MealSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            calories: { type: 'number', nullable: true },
            prep_time_min: { type: 'number', nullable: true },
            cook_time_min: { type: 'number', nullable: true },
            mood_tags: { type: 'array', items: { type: 'string' } },
            dietary_tags: { type: 'array', items: { type: 'string' } },
            emoji: { type: 'string', nullable: true },
            image_url: { type: 'string', format: 'uri', nullable: true },
          },
          required: ['id', 'title'],
        },
        MealDetail: {
          allOf: [
            ref('MealSummary'),
            {
              type: 'object',
              properties: {
                protein_g: { type: 'number', nullable: true },
                carbs_g: { type: 'number', nullable: true },
                fat_g: { type: 'number', nullable: true },
                is_published: { type: 'boolean', nullable: true },
                meal_ingredients: {
                  type: 'array',
                  items: ref('MealIngredient'),
                },
                meal_steps: {
                  type: 'array',
                  items: ref('MealStep'),
                },
              },
            },
          ],
        },
        AIRecommendedMeal: {
          allOf: [
            ref('MealSummary'),
            {
              type: 'object',
              properties: {
                ai_score: { type: 'number' },
                mood_alignment: { type: 'string' },
                quick_tip: { type: 'string' },
              },
            },
          ],
        },
        Restaurant: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            cuisine_tags: { type: 'array', items: { type: 'string' } },
            mood_tags: { type: 'array', items: { type: 'string' } },
            description: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            lat: { type: 'number', nullable: true },
            lng: { type: 'number', nullable: true },
            rating: { type: 'number', nullable: true },
            price_range: { type: 'integer', nullable: true },
            emoji: { type: 'string', nullable: true },
            image_url: { type: 'string', format: 'uri', nullable: true },
            menu_highlights: { type: 'array', items: { type: 'string' } },
            is_active: { type: 'boolean', nullable: true },
          },
          required: ['id', 'name'],
        },
        AIRestaurant: {
          allOf: [
            ref('Restaurant'),
            {
              type: 'object',
              properties: {
                distance_km: { type: 'number' },
                ai_score: { type: 'number' },
                mood_alignment: { type: 'string' },
                matches_mood: { type: 'boolean' },
              },
            },
          ],
        },
        PostAuthor: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            handle: { type: 'string' },
            avatar_url: { type: 'string', format: 'uri', nullable: true },
          },
          required: ['id', 'name', 'handle'],
        },
        Post: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            post_type: { type: 'string', enum: postTypeEnum },
            note: { type: 'string', nullable: true },
            mood_before: { type: 'string', nullable: true },
            mood_after: { type: 'string', nullable: true },
            ordered_items: { type: 'string', nullable: true },
            image_url: { type: 'string', format: 'uri', nullable: true },
            like_count: { type: 'integer', nullable: true },
            comment_count: { type: 'integer', nullable: true },
            save_count: { type: 'integer', nullable: true },
            is_public: { type: 'boolean', nullable: true },
            is_flagged: { type: 'boolean', nullable: true },
            liked: { type: 'boolean', nullable: true },
            saved: { type: 'boolean', nullable: true },
            created_at: { type: 'string', format: 'date-time', nullable: true },
            users: ref('PostAuthor'),
            meals: ref('MealSummary'),
            restaurants: ref('Restaurant'),
          },
        },
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            body: { type: 'string' },
            parent_id: { type: 'string', format: 'uuid', nullable: true },
            created_at: { type: 'string', format: 'date-time', nullable: true },
            users: ref('PostAuthor'),
          },
          required: ['id', 'body'],
        },
        UploadResult: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
            path: { type: 'string' },
            bucket: { type: 'string' },
          },
          required: ['url', 'path', 'bucket'],
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: ref('User'),
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
          required: ['user', 'accessToken', 'refreshToken'],
        },
        RefreshResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
          required: ['accessToken', 'refreshToken'],
        },
        MealRecommendationsResponse: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: ref('AIRecommendedMeal'),
            },
            intent: ref('MoodIntent'),
            mood: { type: 'string', enum: moodEnum },
          },
          required: ['recommendations', 'mood'],
        },
        RestaurantRecommendationsResponse: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: ref('AIRestaurant'),
            },
            intent: ref('MoodIntent'),
            mood: { type: 'string', enum: moodEnum },
            message: { type: 'string', nullable: true },
          },
          required: ['recommendations', 'mood'],
        },
        AdminStatsResponse: {
          type: 'object',
          properties: {
            stats: {
              type: 'object',
              properties: {
                totalUsers: { type: 'integer' },
                totalPosts: { type: 'integer' },
                totalMeals: { type: 'integer' },
                totalRestaurants: { type: 'integer' },
                flaggedPosts: { type: 'integer' },
              },
            },
            userGrowth: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  month: { type: 'string' },
                  users: { type: 'integer' },
                },
              },
            },
            moodDistribution: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: { type: 'integer' },
                },
              },
            },
          },
          required: ['stats', 'userGrowth', 'moodDistribution'],
        },
        AdminUsersResponse: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              items: {
                allOf: [
                  ref('User'),
                  {
                    type: 'object',
                    properties: {
                      posts: { type: 'integer' },
                    },
                  },
                ],
              },
            },
            total: { type: 'integer' },
          },
          required: ['users', 'total'],
        },
        AdminMealsResponse: {
          type: 'object',
          properties: {
            meals: {
              type: 'array',
              items: {
                allOf: [
                  ref('MealDetail'),
                  {
                    type: 'object',
                    properties: {
                      saves: { type: 'integer' },
                    },
                  },
                ],
              },
            },
            total: { type: 'integer' },
          },
          required: ['meals', 'total'],
        },
        AdminRestaurantsResponse: {
          type: 'object',
          properties: {
            restaurants: {
              type: 'array',
              items: {
                allOf: [
                  ref('Restaurant'),
                  {
                    type: 'object',
                    properties: {
                      experiences: { type: 'integer' },
                    },
                  },
                ],
              },
            },
            total: { type: 'integer' },
          },
          required: ['restaurants', 'total'],
        },
        AdminPostsResponse: {
          type: 'object',
          properties: {
            posts: {
              type: 'array',
              items: ref('Post'),
            },
            total: { type: 'integer' },
          },
          required: ['posts', 'total'],
        },
        AdminAnalyticsResponse: {
          type: 'object',
          properties: {
            moodLogs: { type: 'integer' },
            moodBreakdown: {
              type: 'object',
              additionalProperties: { type: 'integer' },
            },
            weeklyTrends: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: {
                  oneOf: [{ type: 'string' }, { type: 'integer' }],
                },
              },
            },
          },
          required: ['moodLogs', 'moodBreakdown', 'weeklyTrends'],
        },
        AdminAIStatusResponse: {
          type: 'object',
          properties: {
            services: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
          required: ['services'],
        },
        AdminSettingsResponse: {
          type: 'object',
          properties: {
            settings: {
              type: 'object',
              additionalProperties: true,
            },
          },
          required: ['settings'],
        },
        RegisterRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 2, maxLength: 100 },
            handle: { type: 'string', minLength: 3, maxLength: 30, example: 'mindful_user' },
          },
          required: ['email', 'password', 'name', 'handle'],
        },
        LoginRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
          required: ['email', 'password'],
        },
        RefreshRequest: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
          },
          required: ['refreshToken'],
        },
        LogoutRequest: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        UserUpdateRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 100 },
            bio: { type: 'string', maxLength: 300 },
            avatar_url: { type: 'string', format: 'uri' },
          },
        },
        UserPreferencesUpdateRequest: {
          type: 'object',
          properties: {
            dietary_tags: { type: 'array', items: { type: 'string' } },
            allergy_tags: { type: 'array', items: { type: 'string' } },
            goal_tags: { type: 'array', items: { type: 'string' } },
            calorie_target: { type: 'number', minimum: 500, maximum: 5000 },
            notifications_on: { type: 'boolean' },
          },
        },
        MoodLogRequest: {
          type: 'object',
          properties: {
            mood: { type: 'string', enum: moodEnum },
            mood_score: { type: 'number', minimum: 1, maximum: 10 },
            context: { type: 'string', enum: ['cook', 'dining'] },
          },
          required: ['mood'],
        },
        AIMealSuggestRequest: {
          type: 'object',
          properties: {
            mood: { type: 'string', enum: moodEnum },
            limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
          },
          required: ['mood'],
        },
        MealSearchRequest: {
          type: 'object',
          properties: {
            query: { type: 'string', minLength: 3, maxLength: 200 },
          },
          required: ['query'],
        },
        CreatePostRequest: {
          type: 'object',
          properties: {
            post_type: { type: 'string', enum: postTypeEnum },
            meal_id: { type: 'string', format: 'uuid', nullable: true },
            restaurant_id: { type: 'string', format: 'uuid', nullable: true },
            note: { type: 'string', maxLength: 500 },
            image_url: { type: 'string', format: 'uri', nullable: true },
            mood_before: { type: 'string', maxLength: 50 },
            mood_after: { type: 'string', maxLength: 50 },
            ordered_items: { type: 'string', maxLength: 300 },
            is_public: { type: 'boolean', default: true },
            image: { type: 'string', format: 'binary' },
          },
          required: ['post_type'],
        },
        CreateCommentRequest: {
          type: 'object',
          properties: {
            body: { type: 'string', minLength: 1, maxLength: 500 },
            parent_id: { type: 'string', format: 'uuid', nullable: true },
          },
          required: ['body'],
        },
        DeleteImageRequest: {
          type: 'object',
          properties: {
            bucket: { type: 'string' },
            path: { type: 'string' },
          },
          required: ['bucket', 'path'],
        },
        AdminUserUpdateRequest: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: userRoleEnum },
            status: { type: 'string', enum: userStatusEnum },
            name: { type: 'string', minLength: 2, maxLength: 100 },
          },
        },
        AdminMealCreateRequest: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 2, maxLength: 200 },
            description: { type: 'string' },
            emoji: { type: 'string', maxLength: 10 },
            prep_time_min: { type: 'number' },
            cook_time_min: { type: 'number' },
            calories: { type: 'number' },
            protein_g: { type: 'number' },
            carbs_g: { type: 'number' },
            fat_g: { type: 'number' },
            mood_tags: { type: 'array', items: { type: 'string' } },
            dietary_tags: { type: 'array', items: { type: 'string' } },
            image_url: { type: 'string', format: 'uri' },
            is_published: { type: 'boolean', default: true },
            ingredients: {
              type: 'array',
              items: ref('MealIngredient'),
            },
            steps: {
              type: 'array',
              items: ref('MealStep'),
            },
          },
          required: ['title'],
        },
        AdminMealUpdateRequest: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 2, maxLength: 200 },
            description: { type: 'string' },
            emoji: { type: 'string', maxLength: 10 },
            prep_time_min: { type: 'number' },
            calories: { type: 'number' },
            mood_tags: { type: 'array', items: { type: 'string' } },
            dietary_tags: { type: 'array', items: { type: 'string' } },
            is_published: { type: 'boolean' },
            image_url: { type: 'string', format: 'uri' },
          },
        },
        AdminRestaurantCreateRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 200 },
            cuisine_tags: { type: 'array', items: { type: 'string' } },
            mood_tags: { type: 'array', items: { type: 'string' } },
            description: { type: 'string' },
            address: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            rating: { type: 'number', minimum: 0, maximum: 5 },
            price_range: { type: 'integer', minimum: 1, maximum: 4, default: 2 },
            emoji: { type: 'string', maxLength: 10 },
            image_url: { type: 'string', format: 'uri' },
            menu_highlights: { type: 'array', items: { type: 'string' } },
            is_active: { type: 'boolean', default: true },
          },
          required: ['name'],
        },
        AdminRestaurantUpdateRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 200 },
            cuisine_tags: { type: 'array', items: { type: 'string' } },
            mood_tags: { type: 'array', items: { type: 'string' } },
            description: { type: 'string' },
            address: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            rating: { type: 'number', minimum: 0, maximum: 5 },
            price_range: { type: 'integer', minimum: 1, maximum: 4 },
            emoji: { type: 'string', maxLength: 10 },
            menu_highlights: { type: 'array', items: { type: 'string' } },
            is_active: { type: 'boolean' },
          },
        },
        ModeratePostRequest: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['approve', 'hide', 'flag', 'unflag'] },
          },
          required: ['action'],
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          responses: {
            200: response('API is healthy', ref('HealthResponse')),
          },
        },
      },
      '/v1/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          requestBody: jsonRequestBody(ref('RegisterRequest')),
          responses: {
            201: response('User created', ref('AuthResponse')),
            400: response('Validation or uniqueness error', ref('ValidationErrorResponse')),
          },
        },
      },
      '/v1/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login with email and password',
          requestBody: jsonRequestBody(ref('LoginRequest')),
          responses: {
            200: response('Authenticated user', ref('AuthResponse')),
            401: response('Invalid credentials', ref('ErrorResponse')),
          },
        },
      },
      '/v1/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Rotate refresh token and issue a new access token',
          requestBody: jsonRequestBody(ref('RefreshRequest')),
          responses: {
            200: response('New token pair', ref('RefreshResponse')),
            401: response('Refresh token is invalid or expired', ref('ErrorResponse')),
          },
        },
      },
      '/v1/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout and revoke a refresh token',
          requestBody: jsonRequestBody(ref('LogoutRequest'), false),
          responses: {
            200: response('Logout completed', {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
              required: ['message'],
            }),
          },
        },
      },
      '/v1/users/me': {
        get: {
          tags: ['Users'],
          summary: 'Get the current user profile',
          security: secure,
          responses: {
            200: response('Current user', {
              type: 'object',
              properties: { user: ref('User') },
              required: ['user'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
        patch: {
          tags: ['Users'],
          summary: 'Update the current user profile',
          security: secure,
          requestBody: jsonRequestBody(ref('UserUpdateRequest')),
          responses: {
            200: response('Updated profile', {
              type: 'object',
              properties: { user: ref('User') },
              required: ['user'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/users/me/preferences': {
        get: {
          tags: ['Users'],
          summary: 'Get the current user preferences',
          security: secure,
          responses: {
            200: response('Preference record', {
              type: 'object',
              properties: { preferences: ref('UserPreferences') },
              required: ['preferences'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
        put: {
          tags: ['Users'],
          summary: 'Create or update the current user preferences',
          security: secure,
          requestBody: jsonRequestBody(ref('UserPreferencesUpdateRequest')),
          responses: {
            200: response('Updated preferences', {
              type: 'object',
              properties: { preferences: ref('UserPreferences') },
              required: ['preferences'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/users/{handle}': {
        get: {
          tags: ['Users'],
          summary: 'Get a public user profile by handle',
          parameters: [
            param('handle', 'path', { type: 'string' }, true, 'Public user handle'),
          ],
          responses: {
            200: response('Public profile', {
              type: 'object',
              properties: { user: ref('PublicUser') },
              required: ['user'],
            }),
            404: response('User not found', ref('ErrorResponse')),
          },
        },
      },
      '/v1/users/{id}/follow': {
        post: {
          tags: ['Users'],
          summary: 'Follow another user',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'User ID to follow'),
          ],
          responses: {
            200: response('User followed', {
              type: 'object',
              properties: { following: { type: 'boolean', example: true } },
              required: ['following'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
        delete: {
          tags: ['Users'],
          summary: 'Unfollow another user',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'User ID to unfollow'),
          ],
          responses: {
            200: response('User unfollowed', {
              type: 'object',
              properties: { following: { type: 'boolean', example: false } },
              required: ['following'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/moods': {
        post: {
          tags: ['Moods'],
          summary: 'Log a mood entry',
          security: secure,
          requestBody: jsonRequestBody(ref('MoodLogRequest')),
          responses: {
            201: response('Mood logged with AI intent', {
              type: 'object',
              properties: {
                log: ref('MoodLog'),
                intent: ref('MoodIntent'),
              },
              required: ['log', 'intent'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/moods/history': {
        get: {
          tags: ['Moods'],
          summary: 'Get mood history for the current user',
          security: secure,
          parameters: [
            intQuery('days', 'Number of days to include', 30),
          ],
          responses: {
            200: response('Mood history', {
              type: 'object',
              properties: {
                logs: {
                  type: 'array',
                  items: ref('MoodLog'),
                },
              },
              required: ['logs'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/moods/insights': {
        get: {
          tags: ['Moods'],
          summary: 'Get weekly AI-generated mood insights',
          security: secure,
          responses: {
            200: response('Insight summary', {
              type: 'object',
              properties: { insights: ref('MoodInsights') },
              required: ['insights'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/meals': {
        get: {
          tags: ['Meals'],
          summary: 'List published meals with filters',
          security: secure,
          parameters: [
            param('mood', 'query', { type: 'string' }, false, 'Filter by a mood tag'),
            param('dietary', 'query', { type: 'string' }, false, 'Filter by a dietary tag'),
            intQuery('page', 'Page number', 1),
            intQuery('limit', 'Page size', 20),
          ],
          responses: {
            200: response('Meal list', {
              type: 'object',
              properties: {
                meals: { type: 'array', items: ref('MealSummary') },
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
              },
              required: ['meals', 'total', 'page', 'limit'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/meals/saved': {
        get: {
          tags: ['Meals'],
          summary: 'Get the current user saved meals',
          security: secure,
          responses: {
            200: response('Saved meals', {
              type: 'object',
              properties: {
                meals: { type: 'array', items: ref('MealSummary') },
              },
              required: ['meals'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/meals/{id}': {
        get: {
          tags: ['Meals'],
          summary: 'Get one meal with full detail',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Meal ID'),
          ],
          responses: {
            200: response('Meal detail', {
              type: 'object',
              properties: { meal: ref('MealDetail') },
              required: ['meal'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            404: response('Meal not found', ref('ErrorResponse')),
          },
        },
      },
      '/v1/meals/ai-suggest': {
        post: {
          tags: ['Meals'],
          summary: 'Get AI-ranked meal suggestions for a mood',
          security: secure,
          requestBody: jsonRequestBody(ref('AIMealSuggestRequest')),
          responses: {
            200: response('AI meal suggestions', ref('MealRecommendationsResponse')),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/meals/search': {
        post: {
          tags: ['Meals'],
          summary: 'Search meals with natural language',
          security: secure,
          requestBody: jsonRequestBody(ref('MealSearchRequest')),
          responses: {
            200: response('Search results', {
              type: 'object',
              properties: {
                meals: { type: 'array', items: ref('MealSummary') },
                filters: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
              required: ['meals', 'filters'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/meals/{id}/save': {
        post: {
          tags: ['Meals'],
          summary: 'Save a meal',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Meal ID'),
          ],
          responses: {
            200: response('Meal saved', {
              type: 'object',
              properties: { saved: { type: 'boolean', example: true } },
              required: ['saved'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
        delete: {
          tags: ['Meals'],
          summary: 'Remove a saved meal',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Meal ID'),
          ],
          responses: {
            200: response('Meal removed from saved list', {
              type: 'object',
              properties: { saved: { type: 'boolean', example: false } },
              required: ['saved'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/restaurants/nearby': {
        get: {
          tags: ['Restaurants'],
          summary: 'Get nearby restaurant recommendations',
          security: secure,
          parameters: [
            param('lat', 'query', { type: 'number', minimum: -90, maximum: 90 }, true, 'Latitude'),
            param('lng', 'query', { type: 'number', minimum: -180, maximum: 180 }, true, 'Longitude'),
            param('mood', 'query', { type: 'string', enum: moodEnum }, false, 'Optional mood to influence ranking'),
            param('radius', 'query', { type: 'number', minimum: 0.5, maximum: 10, default: 2 }, false, 'Search radius in kilometers'),
          ],
          responses: {
            200: response('Restaurant recommendations', ref('RestaurantRecommendationsResponse')),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/restaurants/{id}': {
        get: {
          tags: ['Restaurants'],
          summary: 'Get one restaurant by ID',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Restaurant ID'),
          ],
          responses: {
            200: response('Restaurant detail', {
              type: 'object',
              properties: { restaurant: ref('Restaurant') },
              required: ['restaurant'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            404: response('Restaurant not found', ref('ErrorResponse')),
          },
        },
      },
      '/v1/restaurants/{id}/experiences': {
        get: {
          tags: ['Restaurants'],
          summary: 'Get public dining posts for a restaurant',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Restaurant ID'),
          ],
          responses: {
            200: response('Experience posts', {
              type: 'object',
              properties: {
                posts: { type: 'array', items: ref('Post') },
              },
              required: ['posts'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/posts/feed': {
        get: {
          tags: ['Posts'],
          summary: 'Get the community feed',
          security: secure,
          parameters: [
            param('type', 'query', { type: 'string', enum: ['all', ...postTypeEnum], default: 'all' }, false, 'Feed type'),
            param('cursor', 'query', { type: 'string', format: 'date-time' }, false, 'Pagination cursor based on created_at'),
            intQuery('limit', 'Maximum number of posts', 20),
          ],
          responses: {
            200: response('Community feed', {
              type: 'object',
              properties: {
                posts: { type: 'array', items: ref('Post') },
                nextCursor: { type: 'string', format: 'date-time', nullable: true },
              },
              required: ['posts'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/posts': {
        post: {
          tags: ['Posts'],
          summary: 'Create a community post',
          description: 'Send as multipart/form-data when uploading an image file. You may either upload `image` or pass an existing `image_url`.',
          security: secure,
          requestBody: multipartRequestBody(ref('CreatePostRequest')),
          responses: {
            201: response('Created post', {
              type: 'object',
              properties: { post: ref('Post') },
              required: ['post'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/posts/{id}/like': {
        post: {
          tags: ['Posts'],
          summary: 'Like a post',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Post ID'),
          ],
          responses: {
            200: response('Like registered', {
              type: 'object',
              properties: { liked: { type: 'boolean', example: true } },
              required: ['liked'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
        delete: {
          tags: ['Posts'],
          summary: 'Remove a like from a post',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Post ID'),
          ],
          responses: {
            200: response('Like removed', {
              type: 'object',
              properties: { liked: { type: 'boolean', example: false } },
              required: ['liked'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/posts/{id}/comments': {
        get: {
          tags: ['Posts'],
          summary: 'Get comments for a post',
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Post ID'),
          ],
          responses: {
            200: response('Comments', {
              type: 'object',
              properties: {
                comments: { type: 'array', items: ref('Comment') },
              },
              required: ['comments'],
            }),
          },
        },
        post: {
          tags: ['Posts'],
          summary: 'Add a comment to a post',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Post ID'),
          ],
          requestBody: jsonRequestBody(ref('CreateCommentRequest')),
          responses: {
            201: response('Comment created', {
              type: 'object',
              properties: { comment: ref('Comment') },
              required: ['comment'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
      },
      '/v1/uploads/image': {
        post: {
          tags: ['Uploads'],
          summary: 'Upload an image to Supabase Storage',
          security: secure,
          parameters: [
            param('type', 'query', { type: 'string', enum: ['post', 'recipe', 'profile'], default: 'post' }, false, 'Upload type'),
          ],
          requestBody: multipartRequestBody({
            type: 'object',
            properties: {
              image: { type: 'string', format: 'binary' },
            },
            required: ['image'],
          }),
          responses: {
            200: response('Uploaded image details', ref('UploadResult')),
            400: response('Missing file or invalid type', ref('ErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
          },
        },
        delete: {
          tags: ['Uploads'],
          summary: 'Delete an uploaded image',
          security: secure,
          requestBody: jsonRequestBody(ref('DeleteImageRequest')),
          responses: {
            200: response('Image deleted', {
              type: 'object',
              properties: { deleted: { type: 'boolean', example: true } },
              required: ['deleted'],
            }),
            400: response('bucket and path are required', ref('ErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Cannot delete another user image', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/stats': {
        get: {
          tags: ['Admin'],
          summary: 'Get admin dashboard stats',
          security: secure,
          responses: {
            200: response('Dashboard metrics', ref('AdminStatsResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/users': {
        get: {
          tags: ['Admin'],
          summary: 'List users for admin management',
          security: secure,
          parameters: [
            param('search', 'query', { type: 'string' }, false, 'Search name, email, or handle'),
            param('status', 'query', { type: 'string', enum: userStatusEnum }, false, 'Filter by user status'),
            param('role', 'query', { type: 'string', enum: userRoleEnum }, false, 'Filter by user role'),
            intQuery('page', 'Page number', 1),
            intQuery('limit', 'Page size', 50),
          ],
          responses: {
            200: response('User list', ref('AdminUsersResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/users/{id}': {
        patch: {
          tags: ['Admin'],
          summary: 'Update a user as admin',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'User ID'),
          ],
          requestBody: jsonRequestBody(ref('AdminUserUpdateRequest')),
          responses: {
            200: response('Updated user', {
              type: 'object',
              properties: { user: ref('User') },
              required: ['user'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
        delete: {
          tags: ['Admin'],
          summary: 'Delete a user as admin',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'User ID'),
          ],
          responses: {
            200: response('User deleted', {
              type: 'object',
              properties: { deleted: { type: 'boolean', example: true } },
              required: ['deleted'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/meals': {
        get: {
          tags: ['Admin'],
          summary: 'List meals for admin management',
          security: secure,
          parameters: [
            param('search', 'query', { type: 'string' }, false, 'Search by title'),
            param('mood', 'query', { type: 'string' }, false, 'Filter by mood tag'),
            boolQuery('published', 'Filter by published state'),
            intQuery('page', 'Page number', 1),
            intQuery('limit', 'Page size', 50),
          ],
          responses: {
            200: response('Meal list', ref('AdminMealsResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
        post: {
          tags: ['Admin'],
          summary: 'Create a meal as admin',
          security: secure,
          requestBody: jsonRequestBody(ref('AdminMealCreateRequest')),
          responses: {
            201: response('Created meal', {
              type: 'object',
              properties: { meal: ref('MealDetail') },
              required: ['meal'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/meals/{id}': {
        patch: {
          tags: ['Admin'],
          summary: 'Update a meal as admin',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Meal ID'),
          ],
          requestBody: jsonRequestBody(ref('AdminMealUpdateRequest')),
          responses: {
            200: response('Updated meal', {
              type: 'object',
              properties: { meal: ref('MealDetail') },
              required: ['meal'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
        delete: {
          tags: ['Admin'],
          summary: 'Delete a meal as admin',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Meal ID'),
          ],
          responses: {
            200: response('Meal deleted', {
              type: 'object',
              properties: { deleted: { type: 'boolean', example: true } },
              required: ['deleted'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/restaurants': {
        get: {
          tags: ['Admin'],
          summary: 'List restaurants for admin management',
          security: secure,
          parameters: [
            param('search', 'query', { type: 'string' }, false, 'Search by restaurant name'),
            param('mood', 'query', { type: 'string' }, false, 'Filter by mood tag'),
            boolQuery('active', 'Filter by active state'),
            intQuery('page', 'Page number', 1),
            intQuery('limit', 'Page size', 50),
          ],
          responses: {
            200: response('Restaurant list', ref('AdminRestaurantsResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
        post: {
          tags: ['Admin'],
          summary: 'Create a restaurant as admin',
          security: secure,
          requestBody: jsonRequestBody(ref('AdminRestaurantCreateRequest')),
          responses: {
            201: response('Created restaurant', {
              type: 'object',
              properties: { restaurant: ref('Restaurant') },
              required: ['restaurant'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/restaurants/{id}': {
        patch: {
          tags: ['Admin'],
          summary: 'Update a restaurant as admin',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Restaurant ID'),
          ],
          requestBody: jsonRequestBody(ref('AdminRestaurantUpdateRequest')),
          responses: {
            200: response('Updated restaurant', {
              type: 'object',
              properties: { restaurant: ref('Restaurant') },
              required: ['restaurant'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
        delete: {
          tags: ['Admin'],
          summary: 'Delete a restaurant as admin',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Restaurant ID'),
          ],
          responses: {
            200: response('Restaurant deleted', {
              type: 'object',
              properties: { deleted: { type: 'boolean', example: true } },
              required: ['deleted'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/posts': {
        get: {
          tags: ['Admin'],
          summary: 'List posts for moderation',
          security: secure,
          parameters: [
            boolQuery('flagged', 'Filter flagged posts'),
            param('status', 'query', { type: 'string', enum: ['hidden', 'published'] }, false, 'Filter by visibility state'),
            intQuery('page', 'Page number', 1),
            intQuery('limit', 'Page size', 50),
          ],
          responses: {
            200: response('Posts for moderation', ref('AdminPostsResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/posts/{id}/moderate': {
        patch: {
          tags: ['Admin'],
          summary: 'Moderate a post',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Post ID'),
          ],
          requestBody: jsonRequestBody(ref('ModeratePostRequest')),
          responses: {
            200: response('Moderated post', {
              type: 'object',
              properties: {
                post: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    is_public: { type: 'boolean' },
                    is_flagged: { type: 'boolean' },
                  },
                },
              },
              required: ['post'],
            }),
            400: response('Validation error', ref('ValidationErrorResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/posts/{id}': {
        delete: {
          tags: ['Admin'],
          summary: 'Delete a post as admin',
          security: secure,
          parameters: [
            param('id', 'path', { type: 'string', format: 'uuid' }, true, 'Post ID'),
          ],
          responses: {
            200: response('Post deleted', {
              type: 'object',
              properties: { deleted: { type: 'boolean', example: true } },
              required: ['deleted'],
            }),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/analytics/overview': {
        get: {
          tags: ['Admin'],
          summary: 'Get mood analytics overview',
          security: secure,
          parameters: [
            intQuery('days', 'Number of days to include', 30),
          ],
          responses: {
            200: response('Analytics snapshot', ref('AdminAnalyticsResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/ai-status': {
        get: {
          tags: ['Admin'],
          summary: 'Check AI and infrastructure status',
          security: secure,
          responses: {
            200: response('Service status', ref('AdminAIStatusResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
      '/v1/admin/settings': {
        get: {
          tags: ['Admin'],
          summary: 'Get admin-facing runtime settings',
          security: secure,
          responses: {
            200: response('Settings summary', ref('AdminSettingsResponse')),
            401: response('Missing or invalid token', ref('ErrorResponse')),
            403: response('Admin access required', ref('ErrorResponse')),
          },
        },
      },
    },
  };
}

function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto ? String(forwardedProto).split(',')[0].trim() : req.protocol;
  return `${protocol}://${req.get('host')}`;
}

function relaxSwaggerHeaders(req, res, next) {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('Content-Security-Policy-Report-Only');
  next();
}

function registerSwagger(app) {
  app.get('/api-docs.json', (req, res) => {
    res.json(createOpenApiSpec(getBaseUrl(req)));
  });

  app.use('/api-docs', relaxSwaggerHeaders, swaggerUi.serve);
  app.get(
    '/api-docs',
    relaxSwaggerHeaders,
    swaggerUi.setup(null, {
      customSiteTitle: 'MindfulMeals API Docs',
      explorer: true,
      swaggerOptions: {
        url: '/api-docs.json',
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
      },
    })
  );

  app.get('/docs', (req, res) => {
    res.redirect('/api-docs');
  });
}

module.exports = { registerSwagger, createOpenApiSpec };
