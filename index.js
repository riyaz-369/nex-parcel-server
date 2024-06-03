const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
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
    const usersCollection = client.db("nexParcel").collection("users");
    const bookingsCollection = client.db("nexParcel").collection("bookings");

    // USER RELATED APIS
    app.post("/users", async (req, res) => {
      const users = req.body;
      const filter = { email: users?.email };
      const exist = await usersCollection.findOne(filter);
      if (exist) return res.send({ message: "Already exist" });
      const options = { upsert: true };
      const result = await usersCollection.insertOne(users, options);
      res.send(result);
    });

    // PARCEL BOOKING RELATED APIS
    app.get("/bookings/:email", async (req, res) => {
      const email = req.params.email;
      const result = await bookingsCollection.find({ email }).toArray();
      res.send(result);
    });
    app.post("/bookings", async (req, res) => {
      const bookingData = req.body;
      console.log(bookingData);
      const result = await bookingsCollection.insertOne(bookingData);
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
