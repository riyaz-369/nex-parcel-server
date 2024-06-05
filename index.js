const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

    // GET ALL USERS
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
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

    // MAKE DELIVERYMEN A USER
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const userRole = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: userRole.role,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // PARCEL BOOKING RELATED APIS
    app.get("/bookings/:email", async (req, res) => {
      const email = req.params.email;
      const result = await bookingsCollection.find({ email }).toArray();
      res.send(result);
    });

    // GET ALL BOOKING PARCEL FOR ADMIN
    app.get("/bookings", async (req, res) => {
      const bookings = await bookingsCollection.find().toArray();
      res.send(bookings);
    });

    // GET BOOKING STATISTICS
    app.get("/stats", async (req, res) => {
      const count = await bookingsCollection.estimatedDocumentCount();
      const parcelStatus = await bookingsCollection
        .find(
          { status: "delivered" },
          {
            projection: {
              _id: 0,
              status: 1,
            },
          }
        )
        .toArray();
      const users = await usersCollection.estimatedDocumentCount();
      res.send({ count, parcelStatus, users });
    });

    // POST A BOOKING
    app.post("/bookings", async (req, res) => {
      const bookingData = req.body;
      console.log(bookingData);
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await bookingsCollection.findOne(filter);
      res.send(result);
    });

    // UPDATE A BOOKING
    app.put("/bookings/:id", async (req, res) => {
      const updateData = req.body;
      const id = req.params.id;
      console.log(id);
      console.log(updateData);
      const filter = { _id: new ObjectId(id) };
      console.log(filter);
      const updateDoc = {
        $set: {
          ...updateData,
        },
      };
      const result = await bookingsCollection.updateOne(filter, updateDoc);
      console.log(result);
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
