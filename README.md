# RIDE - Vehicle Sharing Platform

## Overview
RIDE is a modern, full-stack web application designed to facilitate seamless vehicle sharing and ride-matching experiences. Users can offer rides, find rides, and connect with others for shared journeys, making travel more efficient, affordable, and eco-friendly.

## Features
- **User Authentication & Registration:**
  - Secure signup and login using email, password, and username.
  - Passwords are hashed using bcrypt for security.
  - Profile creation with image upload and mobile number.
- **Dashboard:**
  - Plan journeys by searching for available rides or offering a new ride.
  - Add intermediate stops to journeys.
  - View and manage ride offers and requests.
  - Responsive, modern UI with theme toggling and animated backgrounds.
- **Ride Matching:**
  - Find rides based on source, destination, and date.
  - Offer rides and receive requests from other users.
  - View matched ride details and request to join rides.
- **Notifications:**
  - Real-time notifications for ride requests and responses using Socket.IO.
- **History:**
  - View history of rides offered, rides taken, and their statuses.
- **Profile Management:**
  - Edit profile details and update profile picture.

## Tech Stack
- **Backend:**
  - Node.js, Express.js
  - PostgreSQL (with `pg` and `connect-pg-simple` for session storage)
  - Passport.js for authentication (local strategy)
  - Socket.IO for real-time features
  - bcrypt for password hashing
  - express-fileupload for profile image uploads
- **Frontend:**
  - EJS templating engine
  - HTML5, CSS3 (custom, modular stylesheets)
  - JavaScript (client-side validation, UI effects)
  - Responsive and modern design with animations
- **Other:**
  - Google Maps Places Autocomplete for location inputs
  - Flash messages for user feedback

## Folder Structure
```
Ride/
  ├── index.js                # Main server file
  ├── package.json            # Project metadata and dependencies
  ├── public/                 # Static assets (CSS, JS, images)
  ├── uploads/                # Uploaded profile images
  ├── views/                  # EJS templates for UI
  └── README.md               # Project documentation
```

## Getting Started
### Prerequisites
- Node.js (v14+ recommended)
- PostgreSQL database

### Installation
1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd Ride
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Database:**
   - Create a PostgreSQL database named `Ride`.
   - Update the database credentials in `index.js` if needed.
   - Required tables: `login_details`, `profile_details`, `notifications`, `confirmed_offers`, etc.
4. **Run the application:**
   ```bash
   node index.js
   ```
5. **Access the app:**
   - Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage
- **Sign Up:** Create an account with your email and password, then complete your profile.
- **Login:** Access your dashboard to find or offer rides.
- **Offer a Ride:** Enter journey details, add stops, and submit your offer.
- **Find a Ride:** Search for available rides matching your route and date.
- **Request a Ride:** Send a request to join a ride; receive notifications for responses.
- **View History:** Track your past rides and requests.
- **Edit Profile:** Update your personal information and profile picture.

## Contributing
Contributions are welcome! Please open issues or submit pull requests for improvements or bug fixes.

## License
This project is licensed under the ISC License.

## Acknowledgements
- [Express.js](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Passport.js](http://www.passportjs.org/)
- [Socket.IO](https://socket.io/)
- [EJS](https://ejs.co/)
- [Google Maps Platform](https://developers.google.com/maps)


# Environment variables for RIDE project

# PostgreSQL Database
DB_USER=Your_username
DB_PASSWORD=Your_password
DB_HOST=localhost
DB_PORT=you_port
DB_NAME=Your_db_name

# Session secret
SESSION_SECRET=Your_Secret_key

# Google Maps API Key
# GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
