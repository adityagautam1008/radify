import { NextApiRequest, NextApiResponse } from 'next';
import https from 'https';

export const config = {
  api: {
    responseLimit: false,
    externalResolver: true,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string;
  if (!id) return res.status(400).send('Missing id');

  try {
    // Dynamic import absolutely prevents Webpack from crashing during the Vercel build phase!
    const ytdl = (await import('@distube/ytdl-core')).default;
    
    const url = `https://www.youtube.com/watch?v=${id}`;
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });

    if (!format || !format.url) {
      return res.status(404).send('Audio format not found');
    }

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        ...(req.headers.range ? { 'Range': req.headers.range } : {})
      }
    };

    // Forward the stream request directly to googlevideo.com, preserving Range headers!
    https.get(format.url, options, (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      
      // Copy necessary headers for seeking (Content-Range, Content-Length, Content-Type, Accept-Ranges)
      if (proxyRes.headers['content-range']) res.setHeader('Content-Range', proxyRes.headers['content-range']);
      if (proxyRes.headers['content-length']) res.setHeader('Content-Length', proxyRes.headers['content-length']);
      if (proxyRes.headers['content-type']) res.setHeader('Content-Type', proxyRes.headers['content-type']);
      if (proxyRes.headers['accept-ranges']) res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
      
      // Pipe the exact byte chunk to the browser
      proxyRes.pipe(res);
    }).on('error', (err) => {
      console.error('Proxy Error:', err);
      if (!res.headersSent) res.status(500).send('Proxy error');
    });

  } catch (error: any) {
    console.error('YTDL Error:', error);
    if (!res.headersSent) res.status(500).send(error.message);
  }
}
