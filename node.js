const express = require('express');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const app = express();

app.use(express.json());

// Rota de verificação para Render
app.get('/', (req, res) => {
  res.send('API está ativa');
});

// Rota principal para transcrição
app.post('/transcrever', async (req, res) => {
  const videoId = req.body.videoId;
  if (!videoId) return res.status(400).send("ID do vídeo não fornecido");

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Extrai o áudio usando youtube-dl
  exec(`youtube-dl -x --audio-format mp3 -o audio.mp3 ${videoUrl}`, async (error) => {
    if (error) {
      console.error("Erro ao baixar áudio:", error);
      return res.status(500).send("Erro ao baixar áudio");
    }

    // Aqui você deve hospedar o arquivo e obter um link público real
    const audioUrl = 'https://seuservidor.com/audio.mp3'; // substitua com link real

    try {
      const response = await axios.post('https://api.assemblyai.com/v2/transcript', {
        audio_url: audioUrl
      }, {
        headers: {
          authorization: process.env.ASSEMBLYAI_API,
          'content-type': 'application/json'
        }
      });

      res.send({ transcriptId: response.data.id });
    } catch (err) {
      console.error("Erro ao enviar para AssemblyAI:", err);
      res.status(500).send("Erro ao enviar para AssemblyAI");
    }
  });
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
