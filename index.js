const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const app = express();

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
    app.get("/users", async (req, res) => {
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
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // GET ALL DELIVERY MEN FROM USERS COLLECTION
    app.get("/deliverymen", async (req, res) => {
      const filter = { role: "Delivery Men" };
      const result = await usersCollection.find(filter).toArray();
      res.send(result);
    });

    // MAKE A USER DELIVERYMEN OR ADMIN
    app.patch("/users/:email", async (req, res) => {
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
    app.put("/user/:email", async (req, res) => {
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
    });

    // PARCEL BOOKING RELATED APIS
    app.get("/bookings/:email", async (req, res) => {
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
    app.get("/bookings", async (req, res) => {
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

    // POST A BOOKING
    app.post("/bookings", async (req, res) => {
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await bookingsCollection.findOne(filter);
      res.send(result);
    });

    //  STATISTICS
    app.get("/statistics", async (req, res) => {
      const bookedParcel = await bookingsCollection.estimatedDocumentCount();
      const parcelDelivered = await bookingsCollection
        .find({ status: "delivered" }, { projection: { status: 1, _id: 0 } })
        .toArray();
      const users = await usersCollection.estimatedDocumentCount();
      const bookings = await bookingsCollection.find().toArray();

      const bookingsByDate = bookings.reduce((acc, booking) => {
        const date = new Date(booking.booking_date).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const barChartData = Object.keys(bookingsByDate);
      const barChartSeriesData = Object.values(bookingsByDate);

      res.send({
        bookedParcel,
        parcelDelivered,
        users,
        barChartData,
        barChartSeriesData,
      });
    });

    // UPDATE A BOOKING
    app.put("/bookings/:id", async (req, res) => {
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

    // Delete a booking
    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(filter);
      res.send(result);
    });

    // GET ALL MY DELIVERY LIST
    app.get("/delivery-lists/:id", async (req, res) => {
      const id = req.params.id;
      const myDeliveries = await bookingsCollection
        .find({ deliverymen_id: id })
        .toArray();
      res.send(myDeliveries);
    });

    // POST USERS REVIEW
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
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
