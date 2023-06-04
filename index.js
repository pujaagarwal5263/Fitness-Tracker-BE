const express = require("express");
const session = require("express-session");
const { google } = require("googleapis");
const path = require("path");
const crypto = require('crypto');
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const credentials = require("./creds.json");

const { client_secret, client_id, redirect_uris } = credentials.web;
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

const SCOPES = [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.blood_glucose.read",
    "https://www.googleapis.com/auth/fitness.blood_pressure.read",
    "https://www.googleapis.com/auth/fitness.heart_rate.read",
    "https://www.googleapis.com/auth/fitness.body.read",
    "https://www.googleapis.com/auth/fitness.body.read",
    "https://www.googleapis.com/auth/fitness.sleep.read",
    "https://www.googleapis.com/auth/fitness.body.read",
    "https://www.googleapis.com/auth/fitness.reproductive_health.read"
  ];
const secretKey = crypto.randomBytes(32).toString('hex');

const app = express();
app.use(cors({
    origin: 'http://localhost:3000', // Replace with the actual origin of your React app
  }));

app.use(
    session({
      secret: secretKey,
      resave: false,
      saveUninitialized: true,
    })
  );

  // Proxy route for Google OAuth
// app.use(
//     "/auth/google",
//     createProxyMiddleware({
//       target: "https://accounts.google.com",
//       changeOrigin: true,
//       pathRewrite: {
//         "^/auth/google": "/o/oauth2/v2/auth",
//       },
//     })
//   );

app.get("/auth/google", (req, res) => {
    console.log("hittttt!!!!")

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  res.json({ authUrl });
  //res.redirect(authUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    req.session.tokens = tokens;
    res.redirect("http://localhost:3000/dashboard");

   // res.redirect("/fetch-data");
  } catch (error) {
    console.error("Error retrieving access token:", error);
    res.redirect("/error");
  }
});

app.get("/fetch-data", async (req, res) => {
    try {
      const fitness = google.fitness({
        version: "v1",
        auth: oAuth2Client,
      });
  
      const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      const startTimeMillis = Date.now() - sevenDaysInMillis; // Start time is 7 days ago
      const endTimeMillis = Date.now() + (24 * 60 * 60 * 1000); // End time is the current time
  
      const response = await fitness.users.dataset.aggregate({
        userId: "me",
        requestBody: {
          aggregateBy: [
            {
              dataTypeName: "com.google.step_count.delta",
            },
            {
              dataTypeName: "com.google.blood_glucose",
            },
            {
              dataTypeName: "com.google.blood_pressure",
            },
            {
              dataTypeName: "com.google.heart_rate.bpm",
            },
            {
              dataTypeName: "com.google.weight",
            },
            {
                dataTypeName: "com.google.height"
            },
            {
                dataTypeName:"com.google.sleep.segment"
            },
            {
                dataTypeName:"com.google.body.fat.percentage"
            },
            {
                dataTypeName:"com.google.menstruation"
            }
          ],
          bucketByTime: { durationMillis: 86400000 }, // Aggregate data in daily buckets
          startTimeMillis,
          endTimeMillis,
        },
      });
  
      const fitnessData = response.data.bucket;
      fitnessData.map((data)=>{
        const date = new Date(parseInt(data.startTimeMillis));
        console.log("Date:", date.toDateString());
        const datasetMap= data.dataset;
        datasetMap.map((mydataset)=>{
            const point = mydataset.point;
           // console.log(mydataset.dataSourceId)
            if (point && point.length > 0) {
                const value = point[0].value;
            switch(mydataset.dataSourceId){
                case "derived:com.google.step_count.delta:com.google.android.gms:aggregated":
                    console.log("Step count:", value[0]?.intVal);
                    break;
                case "derived:com.google.blood_glucose.summary:com.google.android.gms:aggregated":
                    console.log("Blood glucose:",mydataset.point[0]?.value)
                    break;
                case "derived:com.google.blood_pressure.summary:com.google.android.gms:aggregated":
                    console.log("Blood pressure:",mydataset.point[0]?.value)
                    break;
                case "derived:com.google.heart_rate.summary:com.google.android.gms:aggregated":
                    console.log("Heart rate:",mydataset.point[0]?.value)
                    break;
                case "derived:com.google.weight.summary:com.google.android.gms:aggregated":
                    console.log("Weight:",value[0]?.fpVal)
                    break;
                case "derived:com.google.height.summary:com.google.android.gms:aggregated":
                    console.log("Height:",value[0]?.fpVal)
                    break;
                case "derived:com.google.sleep.segment:com.google.android.gms:merged":
                    console.log("Sleep:",mydataset.point[0]?.value)
                    break;
                case "derived:com.google.body.fat.percentage.summary:com.google.android.gms:aggregated":
                    console.log("Body Fat:",mydataset.point[0]?.value)
                    break;
                case "derived:com.google.menstruation:com.google.android.gms:aggregated":
                    console.log("Menstrual:",mydataset.point[0]?.value)
                    break;
                default:
                    break;
            }
            }else {
                console.log(`No data available`);
              }
        })
        console.log("-----------------------")
       // console.log(datasetMap[0].point[0]?.value)
      })
  
     // res.send("Fitness data fetched successfully!");
     res.send(fitnessData)
    } catch (error) {
      console.error("Error fetching fitness data:", error);
      res.redirect("/error");
    }
  });  


app.listen(8000, () => {
  console.log("service listening at 8000");
});
