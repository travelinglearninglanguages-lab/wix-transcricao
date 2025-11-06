require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const admin = require('firebase-admin');

// Inicializa Firebase Admin com variáveis de ambiente
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

// Rota de verificação
app.get('/', (req, res) => {
  res.send('API está ativa');
});

// Rota principal para transcrição
app.post('/transcrever', async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).send("ID do vídeo não fornecido");

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Extrai o áudio usando youtube-dl
  exec(`youtube-dl -x --audio-format mp3 -o audio.mp3 ${videoUrl}`, async (error) => {
    if (error) {
      console.error("Erro ao baixar áudio:", error);
      return res.status(500).send("Erro ao baixar áudio");
    }

    try {
      // Faz upload do áudio para Firebase Storage
      await bucket.upload('audio.mp3', {
        destination: `audios/${videoId}.mp3`,
        public: true,
        metadata: {
          contentType: 'audio/mpeg',
        },
      });

      // Obtém URL pública do arquivo
      const file = bucket.file(`audios/${videoId}.mp3`);
      const [metadata] = await file.getMetadata();
      const audioUrl = metadata.mediaLink;

      // Envia para AssemblyAI
      const response = await axios.post('https://api.assemblyai.com/v2/transcript', {
        audio_url: audioUrl,
      }, {
        headers: {
          authorization: process.env.ASSEMBLYAI_API,
          'content-type': 'application/json',
        },
      });

      res.send({ transcriptId: response.data.id });
    } catch (err) {
      console.error("Erro no processamento:", err);
      res.status(500).send("Erro ao processar transcrição");
    }
  });
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

