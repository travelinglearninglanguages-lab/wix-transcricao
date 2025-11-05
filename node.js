const express = require('express');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());

app.post('/transcrever', async (req, res) => {
  const videoId = req.body.videoId;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Extrai o áudio com youtube-dl
  exec(`youtube-dl -x --audio-format mp3 -o audio.mp3 ${videoUrl}`, async (error) => {
    if (error) return res.status(500).send("Erro ao baixar áudio");

    // Hospede o arquivo (ex: Firebase, S3) e obtenha o link público
    const audioUrl = 'https://seuservidor.com/audio.mp3'; // substitua com link real

    // Envia para AssemblyAI
    const response = await axios.post('https://api.assemblyai.com/v2/transcript', {
      audio_url: audioUrl
    }, {
      headers: { authorization: 'SUA_API_KEY' }
    });

    res.send({ transcriptId: response.data.id });
  });
});
