import express from "express";
import fileUpload from "express-fileupload";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import bodyParser from "body-parser";
import pg from "pg";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import connectPgSimple from "connect-pg-simple";
import flash from "connect-flash";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pgPool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const PgSession = connectPgSimple(session);

app.use(session({
  store: new PgSession({
    pool: pgPool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
  },
}));
const server = http.createServer(app);
const io = new SocketIOServer(server); // attach Socket.IO

app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());
app.use(fileUpload());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}
app.use(flash());
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
  });
  
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const userRes = await pgPool.query("SELECT * FROM profile_details WHERE username = $1", [username]);
    if (userRes.rows.length === 0) return done(null, false);
    const email = userRes.rows[0].email;
    const loginRes = await pgPool.query("SELECT * FROM login_details WHERE email = $1", [email]);
    const user = loginRes.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return done(null, false);
    return done(null, { username, email });
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.username);
});

passport.deserializeUser(async (username, done) => {
  try {
    const res = await pgPool.query("SELECT * FROM profile_details WHERE username = $1", [username]);
    
    if (res.rows.length === 0) {
      // User not found — invalidate session
      return done(null, false);
    }

    done(null, res.rows[0]);
  } catch (err) {
    done(err);
  }
});

const userSockets = new Map();

function getUsernameFromSocket(socket) {
  for (const [username, s] of userSockets.entries()) {
    if (s === socket) return username;
  }
  return null;
}


io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("register", (username) => {
    userSockets.set(username, socket);
    console.log(`Registered socket for user: ${username}`);
  });

  socket.on("disconnect", () => {
    for (const [username, s] of userSockets.entries()) {
      if (s === socket) {
        userSockets.delete(username);
        console.log(`Socket removed for user: ${username}`);
        break;
      }
    }
  });

  socket.on("ride-response", async (data) => {
    const { requester, status, date } = data;
    const offerer = getUsernameFromSocket(socket);
    const requesterSocket = userSockets.get(requester);
  
    try {
      // 1️⃣ Update notifications table
      await pgPool.query(
        `UPDATE notifications 
         SET offerer_status = TRUE, requester_status = FALSE, offerer_response = $4
         WHERE offerer_name = $1 AND requester_name = $2 AND ride_date = $3`,
        [offerer, requester, date, status]
      );
  
      // 2️⃣ Fetch confirmed_offers row
      const res = await pgPool.query(
        `SELECT requester_names, requester_statuses, requester_from_locations, requester_to_locations 
         FROM confirmed_offers 
         WHERE offerer_name = $1 AND ride_date = $2`,
        [offerer, date]
      );
  
      if (!res.rows.length) {
        console.log("No confirmed offer found.");
        return;
      }
  
      const row = res.rows[0];
      const index = row.requester_names.indexOf(requester);
  
      const from = index >= 0 ? row.requester_from_locations[index] : null;
      const to = index >= 0 ? row.requester_to_locations[index] : null;
  
      if (index >= 0) {
        // 3️⃣ Update the specific requester_statuses value
        row.requester_statuses[index] = status;
  
        await pgPool.query(
          `UPDATE confirmed_offers
           SET requester_statuses = $1
           WHERE offerer_name = $2 AND ride_date = $3`,
          [row.requester_statuses, offerer, date]
        );
      }
  
      // 4️⃣ Notify requester in real-time (if online)
      if (requesterSocket) {
        requesterSocket.emit("ride-response", {
          status,
          offerer,
          from,
          to,
          date,
        });
      }
  
      console.log(`Offerer ${offerer} ${status} request from ${requester} (${from} ➜ ${to}) on ${date}`);
  
    } catch (err) {
      console.error("Error in ride-response socket:", err);
    }
  });
  
  
  
});

function getCityFromAddress(address) {
  const addressParts = address.split(',').map(part => part.trim());
  return addressParts.length > 0 ? addressParts[0] : null;
}

app.get("/notifications/unseen", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Username is required" });

  try {
    const result = await pgPool.query(
      `SELECT *
       FROM notifications
       WHERE (requester_name = $1 AND requester_status = false)
          OR (offerer_name = $1 AND offerer_status = false)
       ORDER BY created_at DESC`,
      [username]
    );

    res.json({ notifications: result.rows });
    console.log("Fetched unseen:", result.rows);
  } catch (err) {
    console.error("Error fetching unseen notifications:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/notifications/unseen-count", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    const result = await pgPool.query(
      `SELECT COUNT(*) FROM notifications 
       WHERE (requester_name = $1 AND requester_status = false) 
          OR (offerer_name = $1 AND offerer_status = false)`,
      [username]
    );

    const count = parseInt(result.rows[0].count, 10);
    res.json({ count });
  } catch (err) {
    console.error("Error fetching unseen notifications count:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/mark-notifications-read", async (req, res) => {
  const { username, offererResponse } = req.body;
  console.log("Received offererResponse:", offererResponse);

  try {
    const result = await pgPool.query(
      `SELECT offerer_name, requester_name, ride_date
       FROM notifications
       WHERE offerer_name = $1 OR requester_name = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No matching notifications found." });
    }

    for (const notification of result.rows) {
      const { offerer_name, requester_name, ride_date } = notification;

      if (offerer_name === username) {
        // 1️⃣ Update notifications table
        await pgPool.query(
          `UPDATE notifications 
           SET offerer_status = TRUE, requester_status = FALSE, offerer_response = $4
           WHERE offerer_name = $1 AND requester_name = $2 AND ride_date = $3`,
          [offerer_name, requester_name, ride_date, offererResponse]
        );

        // 2️⃣ Update confirmed_offers table
        await pgPool.query(
          `UPDATE confirmed_offers
           SET requester_statuses = array_replace(requester_statuses, 'pending', $1)
           WHERE offerer_name = $2 AND ride_date = $3 AND $4 = ANY(requester_names)`,
          [offererResponse, offerer_name, ride_date, requester_name]
        );

      } else if (requester_name === username) {
        // If requester, just mark as seen
        await pgPool.query(
          `UPDATE notifications 
           SET requester_status = TRUE
           WHERE offerer_name = $1 AND requester_name = $2 AND ride_date = $3`,
          [offerer_name, requester_name, ride_date]
        );
      }
    }

    res.json({ message: "Notifications and confirmed offers updated." });

  } catch (err) {
    console.error("Error marking notifications as read:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});



app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/dashboard");
  }
  res.render("home.ejs");
});

app.get("/signup", (req, res) => res.render("signup.ejs"));

app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const existing = await pgPool.query("SELECT email FROM login_details WHERE email=$1", [email]);
  if (existing.rows.length > 0) return res.render("signup.ejs", { Message: "User already exists!" });
  const hashed = await bcrypt.hash(password, 10);
  await pgPool.query("INSERT INTO login_details(email, password) VALUES($1, $2)", [email, hashed]);
  req.session.email = email;
  res.redirect("/register");
});
app.get("/dashboard-header",async(req,res)=>{
  res.render("dashboard-header",{username:req.user.username});
});
app.get("/register", (req, res) => res.render("register.ejs", { Email_default: req.session.email }));

app.post("/register", async (req, res) => {
  try {
    const email = req.session.email;
    const uname = req.body['uname'];
    const phoneno = req.body['phoneno'];
    let pic_src = null;
    if (req.files?.profileImage) {
      const imageFile = req.files.profileImage;
      const imagePath = "./uploads/" + Date.now() + path.extname(imageFile.name);
      await imageFile.mv(imagePath);
      pic_src = imagePath.replace("./", "/");
    }
    const result = await pgPool.query("SELECT username FROM profile_details WHERE username=$1", [uname]);
    if (result.rows.length > 0) return res.render("register.ejs", { Message: "Username already exists!" });
    await pgPool.query("INSERT INTO profile_details(username, mobile_number, pic_src, email) VALUES ($1, $2, $3, $4)", [uname, phoneno, pic_src, email]);
    res.redirect("/login");
  } catch (err) {
    res.status(500).send("Error during registration.");
  }
});

app.get("/login", (req, res) => res.render("login.ejs"));

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return res.status(500).send("Internal Error");
    if (!user) return res.render("login.ejs", { Message: "Invalid username or password" });
    req.logIn(user, (err) => {
      if (err) return res.status(500).send("Login Error");
      return res.redirect("/dashboard");
    });
  })(req, res, next);
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

app.get("/dashboard", ensureAuthenticated, (req, res) => {
  res.render("dashboard.ejs", {
    username: req.user.username,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    activePage: 'home'
  });
});

app.post("/dashboard", ensureAuthenticated, async (req, res) => {
  const { from, to, date, start_time, end_time, vehicle_type, capacity, intermediate_location, mode } = req.body;
  const username = req.user.username;
  const intermediate_locations = Array.isArray(intermediate_location)
    ? intermediate_location
    : (intermediate_location ? [intermediate_location] : []);

  const intermediateCities = intermediate_locations
    .filter(loc => typeof loc === 'string' && loc.trim() !== '')
    .map(loc => getCity(loc));

  try {
    const getCity = (address) => address.split(',')[0].trim();

    const fromCity = getCity(from);
    const toCity = getCity(to);

    if (mode === 'offer') {
      // Offering a ride
      await pgPool.query(
        `INSERT INTO offer_ride(username, from_loc, to_loc, ride_date, start_time, end_time, intermediate_locations, vehicle_type, capacity) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [username, fromCity, toCity, date, start_time, end_time, JSON.stringify(intermediateCities), vehicle_type, capacity]
      );
      console.log("Ride added successfully");
      req.flash('success_msg', 'Your ride has been submitted successfully!');
      return res.redirect("/dashboard");
    } else {
      // Finding a ride
      await pgPool.query(
        `INSERT INTO find_ride(username, from_loc, to_loc, ride_date) 
         VALUES ($1, $2, $3, $4)`,
        [username, fromCity, toCity, date]
      );
        const result = await pgPool.query(
          `SELECT o.*, p.mobile_number FROM offer_ride o
           JOIN profile_details p ON o.username = p.username
           WHERE o.ride_date = $1 
           AND o.username != $4
           AND (
             (o.from_loc = $2 OR o.intermediate_locations::jsonb @> to_jsonb($2::text))
             OR
             (o.to_loc = $3 OR o.intermediate_locations::jsonb @> to_jsonb($3::text))
           )`,
          [date, fromCity, toCity, username] // <-- add `username` to prevent self-matching
        );

      const matches = result.rows;

      if (matches.length === 0) {
        console.log("No matching rides found.");
      }

      req.session.matchData = {
        from: fromCity,
        to: toCity,
        date,
        matched_results: matches,
        username: req.user.username,
      };
      return res.redirect("/matched_details");
    }
  } catch (err) {
    console.error("Dashboard error:", err);
    console.log("Ride processing error.");
    return res.redirect("/dashboard");
  }
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
});

app.get("/editprofile",async(req,res)=>{
    res.render("editprofile.ejs",{default_email:req.user.email,default_name:req.user.username});
});

app.post("/editprofile", async (req, res) => {
  try {
    const { password } = req.body;
    let hashedPassword = null;

    if (password && password.trim() !== '') {
      const saltRounds = 10;
      hashedPassword = await bcrypt.hash(password, saltRounds);

      // Update password in the database
      await pgPool.query(
        `UPDATE login_details SET password = $1 WHERE email = $2`,
        [hashedPassword, req.user.email]
      );
    }

    res.redirect("/dashboard");

  } catch (err) {
    console.error("Error updating password:", err);
    res.status(500).send("Something went wrong while updating password.");
  }
});

// Route to handle ride request
app.post("/request-ride", async (req, res) => {
  const {
    offerer_name,
    requester_name,
    requester_from,
    requester_to,
    from_location,
    to_location,
    ride_date,
  } = req.body;

  try {
    const confirmed = await pgPool.query(
      "SELECT * FROM confirmed_offers WHERE offerer_name = $1 AND ride_date = $2",
      [offerer_name, ride_date]
    );

    // Get offer capacity
    const capacityResult = await pgPool.query(
      "SELECT capacity FROM offer_ride WHERE username = $1 AND ride_date = $2 ",
      [offerer_name, ride_date]
    );

    const capacity = capacityResult.rows[0]?.capacity || 0;
    const existingRequesters = confirmed.rows[0]?.requester_names || [];
    const existingFroms = confirmed.rows[0]?.requester_from_locations || [];
    const existingTos = confirmed.rows[0]?.requester_to_locations || [];
    let isDuplicate = false;
    for (let i = 0; i < existingRequesters.length; i++) {
      if (
        existingRequesters[i] === requester_name &&
        existingFroms[i] === requester_from &&
        existingTos[i] === requester_to
      ) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) {
      console.log("You have already requested for this ride and route.");
      req.flash('error_msg', 'You have already requested for this ride and route.');
      return res.redirect("/matched_details");
    }
    if (existingRequesters.length >= capacity) {
      console.log("Ride is full.");
      return res.redirect("/matched_details");
    }

    if (confirmed.rowCount === 0) {
      // First request: create a new confirmed_offers row
      await pgPool.query(`
        INSERT INTO confirmed_offers (
          offerer_name,
          from_location,
          to_location,
          ride_date,
          requester_names,
          requester_from_locations,
          requester_to_locations,
          requester_statuses
        ) VALUES ($1, $2, $3, $4, ARRAY[$5], ARRAY[$6], ARRAY[$7], ARRAY['pending'])
      `, [offerer_name, from_location, to_location, ride_date,
          requester_name, requester_from, requester_to]);
    } 
    
    else {
      // Append to existing confirmed_offers
      await pgPool.query(`
        UPDATE confirmed_offers
        SET
          requester_names = array_append(requester_names, $1),
          requester_from_locations = array_append(requester_from_locations, $2),
          requester_to_locations = array_append(requester_to_locations, $3),
          requester_statuses = array_append(requester_statuses, 'pending')
        WHERE offerer_name = $4 AND ride_date = $5
      `, [requester_name, requester_from, requester_to, offerer_name, ride_date]);
    }
    const def_status='pending';
    await pgPool.query(
      `INSERT INTO notifications 
        (offerer_name, offerer_from, offerer_to, 
         requester_name, requester_from, requester_to, 
         ride_date, offerer_status, requester_status,offerer_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, TRUE,$8)`,
      [offerer_name, from_location, to_location, requester_name, requester_from, requester_to, ride_date,def_status]
    );
    

    // Optional: send notification to offerer (you can use sockets or alerts on dashboard)
    const socket1 = userSockets.get(offerer_name);
    if (socket1) {
      socket1.emit("ride-requested", {
        requester: requester_name,
        from: requester_from,
        to: requester_to,
        date: ride_date,
      });
    }
    const socket2=userSockets.get(requester_name);
    if(socket2){
      socket2.emit("ride-response", {
        offerer: offerer_name,
        from: requester_from,
        to: requester_to,
        date: ride_date,
      });
    }
    console.log("Ride requested successfully!");
    req.flash('success_msg', 'Ride requested successfully!');
    return res.redirect("/matched_details");
  } catch (err) {
    console.error("Error confirming request:", err);
    res.status(500).send("Something went wrong.");
  }
});

app.get("/matched_details", ensureAuthenticated, (req, res) => {
  const data = req.session.matchData;
  console.log("IN /matched_details", data);
  if (!data || !data.matched_results) {
    return res.redirect("/dashboard");
  }
  res.render("matched_details.ejs", { ...data, username: req.user.username, activePage: 'matched_details' });
});

app.get("/history", async (req, res) => {
  const user = req.user.username;

  const confirmedOffersAsOfferer = await pgPool.query(`
    SELECT offerer_name, from_location, to_location, ride_date, requester_names, requester_from_locations, requester_to_locations, requester_statuses
    FROM confirmed_offers
    WHERE offerer_name = $1
  `, [user]);

  const confirmedOffersAsRequester = await pgPool.query(`
    SELECT offerer_name, from_location, to_location, requester_names, requester_from_locations, requester_to_locations, requester_statuses, ride_date
    FROM confirmed_offers
    WHERE $1 = ANY(requester_names)
  `, [user]);

  res.render("history.ejs", {
    confirmedOffersAsOfferer: confirmedOffersAsOfferer.rows,
    confirmedOffersAsRequester: confirmedOffersAsRequester.rows,
    currentUser: user,
    activePage: 'history'
  });
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
