import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.post('/api/generate', async (req, res) => {
    const { business_description, design_type, count = 5 } = req.body;

    if (!business_description) {
      return res.status(400).json({ error: 'Business description is required' });
    }

    const results: any[] = [];
    const targetCount = count;

    // Parallel Fast Fallback Logic for Image Generation
    const fetchImages = async () => {
      const promises: Promise<void>[] = [];

      // Base Prompts
      const baseLogo = `Professional logo design for "${business_description}", minimalist, modern, green and navy blue, clean vector style.`;
      const baseFlyer = `Modern marketing flyer for "${business_description}", bold headline, call-to-action, business promotion design, green and navy blue theme, clean layout.`;
      const basePrompt = design_type === 'logo' ? baseLogo : baseFlyer;

      // 1. Specific Background Requirements (Remaining to reach 3 white, 2 transparent total)
      // Frontend already generates 2 white and 1 transparent.
      // We need 1 more white and 1 more transparent here.
      
      // 1 more White Background
      const whitePrompt = `${basePrompt} Isolated on a solid pure white background. High contrast.`;
      promises.push((async () => {
        try {
          const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(whitePrompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
          results.push({
            url: url,
            title: `${design_type === 'logo' ? 'Logo' : 'Flyer'} (White BG)`,
            description: `Clean design on white background for ${business_description}`,
            source: 'Pollinations AI'
          });
        } catch (e) {
          console.error('White BG generation failed');
        }
      })());

      // 1 more Transparent Background
      const transPrompt = `${basePrompt} Isolated on a transparent background, alpha channel, high quality, vector style.`;
      promises.push((async () => {
        try {
          const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(transPrompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
          results.push({
            url: url,
            title: `${design_type === 'logo' ? 'Logo' : 'Flyer'} (Transparent)`,
            description: `Design isolated for transparency for ${business_description}`,
            source: 'Pollinations AI'
          });
        } catch (e) {
          console.error('Transparent BG generation failed');
        }
      })());

      // 2. Standard Fallback Prompts (Remaining 3)
      const standardPrompt = `${basePrompt} Professional branding.`;
      
      // Stability AI (Standard)
      if (process.env.STABILITY_API_KEY) {
        promises.push((async () => {
          try {
            const response = await axios.post(
              'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
              {
                text_prompts: [{ text: standardPrompt, weight: 1 }],
                cfg_scale: 7, height: 1024, width: 1024, samples: 1, steps: 30,
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
                },
                timeout: 15000,
              }
            );
            if (response.data.artifacts && response.data.artifacts[0]) {
              results.push({
                url: `data:image/png;base64,${response.data.artifacts[0].base64}`,
                title: `${design_type === 'logo' ? 'Logo' : 'Flyer'} Concept`,
                description: `High-quality AI generated ${design_type} for ${business_description}`,
                source: 'Stability AI'
              });
            }
          } catch (e) {
            console.error('Stability AI standard failed');
          }
        })());
      }

      // Pollinations AI (Standard)
      for (let i = 0; i < 2; i++) {
        promises.push((async () => {
          try {
            const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(standardPrompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
            results.push({
              url: url,
              title: `${design_type === 'logo' ? 'Logo' : 'Flyer'} Concept`,
              description: `Fast AI generated ${design_type} for ${business_description}`,
              source: 'Pollinations AI'
            });
          } catch (e) {
            console.error('Pollinations AI standard failed');
          }
        })());
      }

      // Pexels API (Stock Fallback)
      if (process.env.PEXELS_API_KEY) {
        promises.push((async () => {
          try {
            const query = `${business_description} ${design_type} professional`;
            const response = await axios.get(
              `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=2`,
              {
                headers: { Authorization: process.env.PEXELS_API_KEY },
                timeout: 10000,
              }
            );
            if (response.data.photos) {
              response.data.photos.forEach((photo: any) => {
                results.push({
                  url: photo.src.large2x,
                  title: `${design_type === 'logo' ? 'Logo' : 'Flyer'} (Stock)`,
                  description: `Professional stock image for ${business_description}`,
                  source: 'Pexels'
                });
              });
            }
          } catch (e) {
            console.error('Pexels API failed');
          }
        })());
      }

      await Promise.allSettled(promises);
    };

    await fetchImages();

    // Ensure exactly the requested count
    let finalResults = results.slice(0, targetCount);
    while (finalResults.length < targetCount) {
      const index = finalResults.length + 1;
      finalResults.push({
        url: `https://picsum.photos/seed/${business_description}-fallback-${index}/1024/1024`,
        title: `Fallback Concept ${index}`,
        description: `Visual inspiration for ${business_description}`,
        source: 'Placeholder'
      });
    }

    res.json(finalResults);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
