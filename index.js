const express = require("express");
const app = express();
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");
cors = require("cors");
// var randomstring = require("randomstring");
require("dotenv").config();
const { DateTime } = require("luxon");
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(cors());

app.use(fileUpload());

(QRCode = require("./models/QRCodes")), (mongoose = require("mongoose"));

const { google } = require("googleapis");

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

mongoose.connect(
  process.env.DB_URL ||
    "mongodb://https://qrcode-api.onrender.com:27017/QRCode",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

async function generateEmptyQrCode() {
  let dt = DateTime.now();
  let dateToPass =
    dt.day.toString() + "/" + dt.month.toString() + "/" + dt.year.toString();
  await QRCode.create({
    qrCode_ID: "1",
    createdAt: dateToPass,
  });
}

//generateEmptyQrCode();

async function deleteFile() {
  try {
    const response = await drive.files.delete({
      fileId: "1EYYhYWkz7jqmDWougtn5bqhk7KiD_12T",
    });
    console.log(response.data, response.status);
  } catch (error) {
    console.log(error.message);
  }
}

//deleteFile();

app.post("/api/saveVideoQr", async (req, res) => {
  let idToSearchFor = +req.body.qrparams;

  if (req.files === null || req.files === undefined) {
    return res.status(400).json({ msg: "No file uploaded" });
  }
  console.log("email data sent from the form:", req.body["form[user_email]"]);

  const file = req.files.file;
  console.log("file:", file);

  const filePath = path.join(__dirname, file.name);

  async function uploadFile() {
    try {
      const response = await drive.files.create({
        requestBody: {
          name: file.name,
          mimeType: "video/mp4",
        },
        media: {
          mimeType: "video/mp4",
          body: fs.createReadStream(filePath),
        },
      });
      console.log(response.data);
      const url = await generatePublicUrl(response.data.id);
      console.log("url:", url);
      let dt = DateTime.now();
      let dateToPass =
        dt.day.toString() +
        "/" +
        dt.month.toString() +
        "/" +
        dt.year.toString();

      // Burası create değil, update olucak çünkü zaten qr kodlar admin dashboard'undan yaratılacak
      // yaratılan qr code'larda sadece qrcodeID ve createdAt olacak, diğer bütün veriler
      // o qr code'a birşey yüklenip, form doldurulup gönderildiği zaman, findByIdAndUpdate metodu kullanılarak
      // o qrcode'a eklenecek.

      // Finding the qr code with the params sent from the frontend, then using that document's id to run
      // findbyidandupdate method to fill in the other fields with data provided by user, on the frontend.

      QRCode.find({ qrCode_ID: idToSearchFor }, async function (err, docs) {
        if (err) {
          console.log(err);
        } else {
          await QRCode.findByIdAndUpdate(
            docs[0]._id,
            {
              video_ID: response.data.id,
              video_URL: url,
              user_email: req.body["form[user_email]"],
              user_name: req.body["form[user_name]"],
              contentType: response.data.mimeType,
            },
            function (err, docs) {
              if (err) {
                console.log(err);
              } else {
                console.log("Updated QrCode:", docs);
              }
            }
          );
        }
      });

      fs.unlink(file.name, function (err, file) {
        if (err) {
          console.log(err);
        }
        console.log("deleted from directory");
      });
    } catch (error) {
      console.log("catch block");
      console.log(error);
    }
  }

  async function generatePublicUrl(passedId) {
    try {
      const fileId = passedId;
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      const result = await drive.files.get({
        fileId: fileId,
        fields: "webViewLink, webContentLink",
      });

      console.log(result.data);
      return result.data.webViewLink;
    } catch (error) {
      console.log(error.message);
    }
  }

  file.mv(filePath, (err) => {
    if (err) {
      console.log(err);
    } else {
      uploadFile();
      res.json("hey");
    }
  });
});

app.post("/api/receiveParams", async (req, res) => {
  let idToSearchFor = +req.body.qrparams;
  console.log("id:", idToSearchFor);

  QRCode.find({ qrCode_ID: idToSearchFor }, function (err, docs) {
    if (docs.length === 0) {
      res.json("nonexistent");
    }
    if (docs[0]?.video_URL) {
      res.json(docs[0]?.video_URL);
    }
    if (docs.length > 0 && !docs[0]?.video_URL) {
      res.json("empty");
    }
  });
});

app.listen(3001, () => {
  console.log("Server running on port 3001!");
});
