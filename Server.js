const express = require("express");
const ytdl = require("ytdl-core");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public")); // Serve frontend

app.get("/download", async (req, res) => {
  const videoUrl = req.query.url;

  if (!ytdl.validateURL(videoUrl)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    const info = await ytdl.getInfo(videoUrl);
    const format = ytdl.chooseFormat(info.formats, { quality: "highest" });

    res.header("Content-Disposition", `attachment; filename="video.mp4"`);
    ytdl(videoUrl, { format }).pipe(res);
  } catch (error) {
    res.status(500).json({ error: "Failed to process video" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
