const express = require ("express");
const cors = require ("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require ('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.AI_API_KEY)
const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://quizlytics.vercel.app",
  ],
}));
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = `${process.env.URI}`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const database = client.db("quizlyticsDb");
    const userHistoryCollection = database.collection("quizHistory");
    const userAiHistoryCollection = database.collection("aiQuizHistory");
    const manualQuizCollection = database.collection("manualQuiz");
    const feedbackCollection = database.collection("feedback")
    const userLinkHistoryCollection = database.collection("linkQuizHistory")

    // Link Quiz History
    app.post("/linkQuiz", async(req, res)=>{
      const userHistoryLinkByLink = req.body;
      // console.log(userHistoryLinkByLink);
      const result = await userLinkHistoryCollection.insertOne(userHistoryLinkByLink);
      res.send(result)
    })

    app.get("/linkHistoryByUser", async(req, res)=>{
      const user = req.query.email;
      const query = {
        userEmail: user
      }
      const result = await userLinkHistoryCollection.find(query).toArray();
      res.send(result)
    })

    // Ai Quiz History
    app.post("/saveAiQuiz", async(req, res)=>{
      const userHistoryAi = req.body;
      const result = await userAiHistoryCollection.insertOne(userHistoryAi);
      res.send(result)
    })

    app.get("/historyByUserAi", async(req, res)=>{
      const user = req.query.email;
      const qTitle = req.query.qTitle;
      const query = {
        userEmail: user,
        quizTitle: qTitle
      }
      const result = await userAiHistoryCollection.find(query).toArray();
      res.send(result);
    })

    // Custom Quiz History
    app.post("/saveHistory", async(req, res)=>{
        const userHistory = req.body;
        const result = await userHistoryCollection.insertOne(userHistory);
        res.send(result)
    })


    app.get("/leaderboard", async(req, res)=>{
      const key = req.query.qKey;
      const query = {
        quizStartKey: key
      }
      const options = {projection: {
        _id:1,
        quizStartKey: 1,
        questions: 0,
        answers: 0,
        userName: 1,
        userEmail: 1,
        userImg: 1,
        marks: 1
      }}
      const result = await userHistoryCollection.find().sort({marks: -1}).limit(5).toArray();
      res.send(result)
    })


    app.get("/historyByKey", async(req, res)=>{
      const key = req.query.qKey;
      const user = req.query.email
      const query = {
        quizStartKey: key,
        userEmail: user
      }
      const result = await userHistoryCollection.find(query).toArray();
      res.send(result)
    })

    app.get("/userHistory", async(req, res)=>{
      const user = req.query?.email;
      const query = {
        userEmail : user
      }
      // console.log(user);
      const result = await userHistoryCollection.find(query).toArray();
      res.send(result)
    })

    // Custom Quiz
    app.post("/saveManualQuiz", async(req, res)=>{
      const quizSet = req.body;
      // console.log(quizSet);
      const result = await manualQuizCollection.insertOne(quizSet);
      res.send(result);
    })

    app.get("/allCustomQuiz", async(req, res)=>{
      const result = await manualQuizCollection.find().toArray();
      res.send(result)
    })

    app.get("/getCustomQuizByKey", async(req, res)=>{
      const key = req.query.qKey;
      const query = {
        quizStartKey: key
      }
      const result = await manualQuizCollection.find(query).toArray();
      res.send(result)
    })

    app.delete("/deleteCustomQuiz", async(req, res)=>{
      const key = req.query.qKey;
      const query = {
        quizStartKey: key
      }
      const result = await manualQuizCollection.deleteOne(query);
      res.send(result)
    })

    // Feedback
    app.post("/feedback", async(req, res)=>{
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      res.send(result)
    })

    app.get("/all-feedback", async(req, res)=>{
      const allFeedback = await feedbackCollection.find().toArray();
      res.send(allFeedback)
    })



    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get("/quiz", async(req, res)=>{
    const category = req.query?.category;
    const skill = req.query?.skill
    const model = genAI.getGenerativeModel({model: "gemini-pro"});


const prompt = `
Generate a JSON array of exactly 10 unique multiple-choice questions based on the topic "${category}". Each question should be designed for a learner at the "${skill}" level and can feature formats like "fill in the blanks", "find the true statement", or similar types.

Each question object must meet the following criteria:
1. The question is labeled as "question" and is a string.
2. There are exactly four answer options stored in an array labeled as "options". Only one option should be correct.
3. The index of the correct answer (from the options array) is labeled as "correct_answer", stored as a string representing the index position (0, 1, 2, or 3).
4. Each question must have a unique identifier, labeled as "id", which is a string containing the index number (e.g., "1", "2", "3").
5. Include an explanation for the correct answer, labeled as "explain", stored as a string.

The output should be only the JSON array without any additional commentary or headings.
`;



    
    const result = await model.generateContent(prompt);


    const response = await result.response;

    const text = await response.text();
    
    const cleanedText = text.replace(/\\\"/g, '"')          // Removes escaped quotes
    .replace(/```json/g, '')                                // Removes '```json' code block markers
    .replace(/```/g, '')                                    // Removes any other triple backticks
    .replace(/`/g, '')                                      // Removes single backticks
    .trim();
    const jsonResult = JSON.parse(cleanedText);
    res.json(jsonResult); 
})


app.get("/testByLink", async(req, res)=>{
  const link = req.query.link
  const model = genAI.getGenerativeModel({model: "gemini-pro"});
  const prompt = `
Generate a JSON array of maximum unique multiple-choice questions possible based on the article of provided "${link}". Each question should feature formats like "fill in the blanks", "find the true statement", or similar types.

Each question object must meet the following criteria:
1. The question is labeled as "question" and is a string.
2. There are exactly four answer options stored in an array labeled as "options". Only one option should be correct.
3. The index of the correct answer (from the options array) is labeled as "correct_answer", stored as a string representing the index position (0, 1, 2, or 3).
4. Each question must have a unique identifier, labeled as "id", which is a string containing the index number (e.g., "1", "2", "3").
5. Include an explanation for the correct answer, labeled as "explain", stored as a string.

The output should be only the JSON array without any additional commentary or headings.
`

// console.log(prompt);

const result = await model.generateContent(prompt);


const response = await result.response;

const text = await response.text();

const cleanedText = text.replace(/\\\"/g, '"')          // Removes escaped quotes
.replace(/```json/g, '')                                // Removes '```json' code block markers
.replace(/```/g, '')                                    // Removes any other triple backticks
.replace(/`/g, '')                                      // Removes single backticks
.trim();
const jsonResult = JSON.parse(cleanedText);
res.json(jsonResult); 
})


app.get("/", (req, res)=>{
    res.send("Updated Quiz server is running")
})

app.listen(port, ()=>{
    console.log(`Listening to the port: ${port}`)
})