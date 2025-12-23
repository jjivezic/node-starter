# Hyper Server

Node.js REST API server with JWT authentication and MySQL database.

## Features

- 🔐 JWT Token Authentication
- 🗄️ MySQL Database Integration
- 🛣️ RESTful API Routes
- 🎯 MVC Architecture (Controllers, Managers)
- 🔒 Authentication Middleware
- ✅ Input Validation

## Project Structure

```
server/
├── database/
│   ├── config.js                # Sequelize configuration
│   ├── connection.js            # Database connection
│   ├── models/
│   │   ├── index.js             # Models index
│   │   └── User.js              # User model
│   ├── migrations/
│   │   └── 20251222000001-create-users-table.js
│   └── seeders/
│       └── 20251222000001-demo-users.js
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── controller.js    # Auth endpoints
│   │   │   ├── manager.js       # Auth business logic
│   │   │   └── routes.js        # Auth routes
│   │   └── users/
│   │       ├── controller.js    # User endpoints
│   │       ├── manager.js       # User business logic
│   │       └── routes.js        # User routes
│   ├── middleware/
│   │   └── authMiddleware.js    # JWT verification
│   ├── routes/
│   │   └── index.js             # Main router
│   └── server.js                # Express app entry point
├── .env.example
├── .sequelizerc                 # Sequelize CLI config
├── .gitignore
├── package.json
└── README.md
```

## Installation

1. Clone the repository
2. Install dependencies:
```bash
4. Update `.env` with your database credentials and JWT secret

5. Run database migrations:
```bash
npm run db:migrate
```

6. (Optional) Seed demo data:
```bash
npm run db:seed
```.env.example .env
```

4. Update `.env` with your database credentials and JWT secret

5. Create database and tables:
```bash
mysql -u root -p < database/schema.sql
```

## Usage

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

Server will run on `http://localhost:3000` (or your configured PORT)

## API Endpoints

### Authentication

#### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Verify Token
```
GET /api/auth/verify
Authorization: Bearer <token>
```

### Users (Protected Routes)

All user routes require authentication token in header:
```
Authorization: Bearer <your_jwt_token>
```

#### Get All Users
```
GET /api/users
```

#### Get Current User Profile
```
GET /api/users/profile
```

#### Get User by ID
```
GET /api/users/:id
```

#### Update User
```
PUT /api/users/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

#### Delete User
```
DELETE /api/users/:id
```

### Health Check
```
GET /api/health
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `DB_HOST` - MySQL host
- `DB_USER` - MySQL username
## Technologies

- **Express.js** - Web framework
- **Sequelize** - ORM for MySQL
- **MySQL2** - Database driver
- **JWT** - Token authentication
- **Bcrypt** - Password hashing
- **CORS** - Cross-origin resource sharing
- **Dotenv** - Environment configuration

## Database Commands

### Migrations
```bash
# Run all pending migrations
npm run db:migrate

# Undo last migration
npm run db:migrate:undo

# Create new migration
npx sequelize-cli migration:generate --name migration-name
```

### Seeders
```bash
# Run all seeders
npm run db:seed

# Undo all seeders
npm run db:seed:undo

# Create new seeder
npx sequelize-cli seed:generate --name seeder-name
```

### Reset Database
```bash
# Undo migrations, re-run them, and seed
npm run db:reset
```
- **MySQL2** - Database driver
- **JWT** - Token authentication
- **Bcrypt** - Password hashing
- **CORS** - Cross-origin resource sharing
- **Dotenv** - Environment configuration
