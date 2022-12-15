const express = require("express");
const port = process.env.PORT || 3001;
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
// app.use(express.json());

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

try {
  mongoose.connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("database connected successfully");
} catch (error) {
  console.log(error);
  console.log("database connection failed");
}

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

async function deleteFile(id) {
  try {
    const response = await drive.files.delete({
      fileId: id,
    });
    console.log(response.data, response.status);
  } catch (error) {
    console.log(error.message);
  }
}

//deleteFile();

app.post("/api/deneme", async (req, res) => {
  console.log("deneme route hit");
  res.json("reached to backend");
});

app.post("/api/saveVideoQr", async (req, res) => {
  let idToSearchFor = req.body.qrparams;
  console.log("savevideoQr route hit");

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

      QRCode.findByIdAndUpdate(
        idToSearchFor,
        {
          video_ID: response.data.id,
          video_URL: url,
          user_email: req.body["form[user_email]"],
          user_name: req.body["form[user_name]"],
          contentType: response.data.mimeType,
        },
        function (err, doc) {
          if (err) {
            console.log(err);
          } else {
            console.log("Updated QrCode:", doc);
          }
        }
      );

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
  // let idToSearchFor = +req.body.qrparams;
  let id = req.body.qrparams;
  console.log("receiveparams route hit");
  console.log("id:", id);

  if (id.length === 24) {
    try {
      QRCode.findById(id, function (err, doc) {
        if (!doc) {
          res.json("nonexistent");
        }
        if (doc?.video_URL) {
          res.json(doc?.video_URL);
        }
        if (doc && !doc?.video_URL) {
          res.json("empty");
        }
        if (err) {
          console.log(err);
        }
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.json("nonexistent");
  }
});

app.get("/api/getQRCodes", async (req, res) => {
  let codes = await QRCode.find({ video_URL: { $exists: false } });
  let codesIDS = codes.map((item) => item.qrCode_ID);
  let codeObj = { codes, codesIDS };
  res.json(codeObj);
});

app.get("/api/getUsedQRCodes", async (req, res) => {
  let codes = await QRCode.find({ video_URL: { $exists: true } });
  res.json(codes);
});

app.post("/api/createQR", async (req, res) => {
  let amount = req.body.amount;
  for (let i = 0; i < amount; i++) {
    generateEmptyQrCode();
  }
  res.json(`${amount} new QR Codes generated!`);
});

app.post("/api/deleteQR", async (req, res) => {
  let sendedId = req.body.ID;
  console.log("sendedId:", sendedId);
  QRCode.findOne({ qrCode_ID: sendedId }, async function (err, doc) {
    if (doc) {
      console.log("the qr:", doc);
      QRCode.findByIdAndDelete(doc._id, function (err, doc) {
        if (err) {
          console.log(err);
          res.json("Something went wrong, could not delete QR Code");
        } else {
          console.log("Deleted:", doc);
          res.json("QR Code deleted, refresh the page to see the effect");
        }
      });
    } else {
      console.log(err);
    }
  });
});

app.post("/api/deleteUsedQR", async (req, res) => {
  let sendedId = req.body.ID;
  console.log("sendedId:", sendedId);
  QRCode.findOne({ qrCode_ID: sendedId }, async function (err, doc) {
    if (doc) {
      deleteFile(doc.video_ID);
      console.log("the qr:", doc);
      QRCode.findByIdAndDelete(doc._id, function (err, doc) {
        if (err) {
          console.log(err);
          res.json("Something went wrong, could not delete QR Code");
        } else {
          console.log("Deleted:", doc);
          res.json("QR Code deleted, refresh the page to see the effect");
        }
      });
    } else {
      console.log(err);
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}!`);
});
