require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const admin = require('firebase-admin');

// Inicializa Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.GOOGLE_PROJECT_ID,
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const app = express();
app.use(cors());
app.use(express.json());

const bucket = admin.storage().bucket();

// 🟢 Rota de verificação
app.get('/', (req, res) => {
  res.send('API está ativa');
});

// 🔍 Rota para buscar vídeo por frase
app.post('/buscar-video', async (req, res) => {
  const { query } = req.body;
  const apiKey = process.env.YOUTUBE_API_KEY;

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 1,
        key: apiKey
      }
    });

    const item = response.data.items[0];
    const videoId = item.id.videoId;
    const title = item.snippet.title;

    res.send({ videoId, title });
  } catch (err) {
    console.error('Erro ao buscar vídeo:', err);
    res.status(500).send('Erro ao buscar vídeo');
  }
});

// 🎙️ Rota para transcrição com suporte a múltiplos idiomas
app.post('/transcrever', async (req, res) => {
  const { videoId, idioma } = req.body;
  if (!videoId) return res.status(400).send("ID do vídeo não fornecido");

  // Idiomas suportados oficialmente
  const supportedLanguages = ['pt-br', 'es', 'en'];
  const languageCode = supportedLanguages.includes(idioma) ? idioma : 'pt-br';

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  exec(`youtube-dl -x --audio-format mp3 -o audio.mp3 ${videoUrl}`, async (error) => {
    if (error) {
      console.error("Erro ao baixar áudio:", error);
      return res.status(500).send("Erro ao baixar áudio");
    }

    try {
      await bucket.upload('audio.mp3', {
        destination: `audios/${videoId}.mp3`,
        public: true,
        metadata: {
          contentType: 'audio/mpeg',
        },
      });

      const file = bucket.file(`audios/${videoId}.mp3`);
      const [metadata] = await file.getMetadata();
      const audioUrl = metadata.mediaLink;

      const response = await axios.post('https://api.assemblyai.com/v2/transcript', {
        audio_url: audioUrl,
        language_code: languageCode,
        punctuate: true,
        format_text: true,
        word_boost: ['dicción', 'pronunciación', 'ejercicio', 'dicção', 'pronúncia', 'exercício'],
        boost_param: 'high',
        model: 'latest_conformer'
      }, {
        headers: {
          authorization: process.env.ASSEMBLYAI_API,
          'content-type': 'application/json',
        },
      });

      res.send({ transcriptId: response.data.id, idiomaUsado: languageCode });
    } catch (err) {
      console.error("Erro no processamento:", err);
      res.status(500).send("Erro ao processar transcrição");
    }
  });
});

// 🚀 Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

