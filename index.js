const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://nex-parcel.web.app",
      "https://nex-parcel.firebaseapp.com",
    ],
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.308otot.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("nexParcel");

    const usersCollection = database.collection("users");
    const bookingsCollection = database.collection("bookings");
    const reviewsCollection = database.collection("reviews");

    // JWT APIS
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // VERIFY TOKEN MIDDLEWARES
    const verifyToken = (req, res, next) => {
      const token = req.headers.authorization;
      console.log("Inside verify", token);

      if (!token)
        return res.status(401).send({ message: "unauthorized access" });

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err)
          return res.status(401).send({ message: "unauthorized access" });
        req.decoded = decoded;
        next();
      });
    };

    // VERIFY ADMIN MIDDLEWARE
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // VERIFY DELIVERYMEN MIDDLEWARE
    const verifyDeliverymen = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });
      const isDeliverymen = user?.role === "Delivery Men";
      if (!isDeliverymen) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // USER RELATED APIS
    app.post("/users", async (req, res) => {
      const users = req.body;
      const filter = { email: users?.email };
      const exist = await usersCollection.findOne(filter);
      if (exist) return res.send({ message: "This email already in used." });
      const result = await usersCollection.insertOne(users);
      res.send(result);
    });

    // GET ALL USERS
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const { page, size } = req.query;
      const pageNum = parseInt(page);
      const dataSize = parseInt(size);

      const count = await usersCollection.countDocuments();
      const users = await usersCollection
        .find()
        .skip((pageNum - 1) * dataSize)
        .limit(dataSize)
        .toArray();
      res.send({ users, count });
    });

    // GET A USER
    app.get("/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });

    // GET ALL DELIVERY MEN FROM USERS COLLECTION
    app.get("/deliverymen", async (req, res) => {
      const filter = { role: "Delivery Men" };
      const result = await usersCollection.find(filter).toArray();
      res.send(result);
    });

    // MAKE A USER DELIVERYMEN OR ADMIN
    app.patch("/users/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const userInfo = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...userInfo,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // UPDATE ONE NO OF DELIVERED PARCEL
    app.put(
      "/user/:email",
      verifyToken,
      verifyDeliverymen,
      async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const options = { upsert: true };
        const updateDoc = {
          $inc: { no_of_delivered_parcel: 1 },
        };
        const result = await usersCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      }
    );

    // PARCEL BOOKING RELATED APIS

    // POST A BOOKING
    app.post("/bookings", verifyToken, async (req, res) => {
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    // GET BOOKING PARCEL FOR SPECIFIC USER
    app.get("/bookings/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const filter = req.query.filter;
      let query = { email: email };
      if (filter) {
        query.status = filter;
      }
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // GET ALL BOOKING PARCEL FOR ADMIN
    app.get("/bookings", verifyToken, verifyAdmin, async (req, res) => {
      const fromDate = req.query.fromDate;
      const toDate = req.query.toDate;

      let query = {};
      if (fromDate && toDate) {
        query.requested_delivery_date = {
          $gte: fromDate,
          $lte: toDate,
        };
      }
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    // GET A SINGLE BOOKING FOR UPDATE
    app.get("/booking/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await bookingsCollection.findOne(filter);
      res.send(result);
    });

    //  STATISTICS FOR ADMIN
    app.get("/statistics", verifyToken, verifyAdmin, async (req, res) => {
      const bookings = await bookingsCollection.find().toArray();

      const bookingsByDate = bookings.reduce((acc, booking) => {
        const date = new Date(booking.booking_date).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const barChartData = Object.keys(bookingsByDate);
      const barChartSeriesData = Object.values(bookingsByDate);

      res.send({ barChartData, barChartSeriesData });
    });

    // STATISTICS FOR HOMEPAGE
    app.get("/home-stats", async (req, res) => {
      const bookedParcel = await bookingsCollection.estimatedDocumentCount();
      const parcelDelivered = await bookingsCollection
        .find({ status: "delivered" }, { projection: { status: 1, _id: 0 } })
        .toArray();
      const users = await usersCollection.estimatedDocumentCount();

      res.send({ bookedParcel, parcelDelivered, users });
    });

    // UPDATE A BOOKING
    app.put("/bookings/:id", verifyToken, async (req, res) => {
      const updateData = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...updateData,
        },
      };
      const result = await bookingsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // DELETE A BOOKING
    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(filter);
      res.send(result);
    });

    // POST USERS REVIEW
    app.post("/reviews", verifyToken, async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    // GET ALL MY DELIVERY LIST
    app.get(
      "/delivery-lists/:id",
      verifyToken,
      verifyDeliverymen,
      async (req, res) => {
        const id = req.params.id;
        const myDeliveries = await bookingsCollection
          .find({ deliverymen_id: id })
          .toArray();
        res.send(myDeliveries);
      }
    );

    // PAYMENT API
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseFloat(price * 100);

      const paymentIntents = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({ clientSecret: paymentIntents.client_secret });
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("NexParcel Server is running");
});

app.listen(port, () => {
  console.log(`server running on port ${port}`);
});
