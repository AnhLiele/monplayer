const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const port = 3000;
const baseUrl = 'https://truyenqqno.com';

async function scrapeHomepage() {
  // Fallback static data để test nhanh (thay bằng scrape thật sau)
  return [
    {
      id: 'ma-phap-su-hac-am-tro-ve-de-nhap-ngu-13899',
      name: 'Ma Pháp Sư Hắc Ám Trở Về Để Nhập Ngũ',
      description: 'Tóm tắt truyện...',
      image: { url: 'https://via.placeholder.com/200x300?text=MaPhapSu', type: 'cover' },
      label: { position: 'top-left', color: '#067bcb', text_color: '#fff', text: 'Chương 50' }
    },
    // Thêm 14 item mẫu khác nếu cần
    { id: 'truyen-2', name: 'Truyện 2', description: '', image: { url: 'https://via.placeholder.com/200x300?text=Truyen2', type: 'cover' }, label: { position: 'top-left', color: '#067bcb', text_color: '#fff', text: 'Chương 1' } }
  ];
}

async function scrapeDetailWithPuppeteer(slug) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/600.1.4');
    await page.setExtraHTTPHeaders({ 'Referer': baseUrl });

    const detailUrl = `${baseUrl}/truyen-tranh/${slug}`;
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 10000 });

    // Chờ chapter list load (dựa trên selector phổ biến)
    await page.waitForSelector('.chapter-list, .list-chap, [class*="chapter"], ul.chapters', { timeout: 5000 }).catch(() => {});

    // Lấy chapters từ DOM
    const chaptersData = await page.evaluate(() => {
      const chapters = [];
      const chapterElements = document.querySelectorAll('.chapter-list li a, .list-chap a, [class*="chapter"] a, ul.chapters li a');
      chapterElements.forEach((el, index) => {
        const name = el.textContent.trim() || `Chương ${index + 1}`;
        const href = el.getAttribute('href') || '';
        const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
        if (name) {
          chapters.push({ name, url: fullUrl, number: index + 1 });
        }
      });
      return chapters.reverse(); // Mới nhất trước
    });

    console.log(`Puppeteer loaded ${chaptersData.length} chapters for ${slug}`);
    await browser.close();
    return { chapters: chaptersData };

  } catch (error) {
    console.error('Puppeteer Error:', error.message);
    await browser.close();
    return { chapters: [] };
  }
}

// Root endpoint
app.get('/', async (req, res) => {
  const recent = await scrapeHomepage();
  const channels = recent.map(item => ({
    ...item,
    type: 'directory',
    display: 'text-below',
    enable_detail: true,
    remote_data: { url: `/channel-detail?uid=${item.id}` },
    share: { url: `${baseUrl}/truyen-tranh/${item.id}` }
  }));

  res.json({
    id: 'truyenqqno-source',
    name: 'TruyenQQNo',
    url: `http://localhost:${port}`,
    color: '#2c283d',
    description: 'Nguồn truyện tranh từ TruyenQQNo.com',
    image: { url: 'https://via.placeholder.com/512x512?text=TQQ', type: 'cover' },
    grid_number: 3,
    groups: [{
      id: 'latest',
      name: 'Mới cập nhật',
      display: 'slider',
      grid_number: 1,
      channels: channels.slice(0, 10)
    }],
    sorts: [
      { text: 'Mới nhất', type: 'radio', url: `http://localhost:${port}?sort=new` },
      { text: 'Action', type: 'radio', url: `http://localhost:${port}?genre=action` }
    ],
    load_more: { remote_data: { url: `http://localhost:${port}/load-more?p=2` } },
    search: { url: `http://localhost:${port}/search`, search_key: 'k' }
  });
});

// Detail endpoint
app.get('/channel-detail', async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: 'No uid' });

  const detail = await scrapeDetailWithPuppeteer(uid);

  // Tên truyện (fallback)
  let title = uid.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  res.json({
    id: uid,
    name: title,
    type: "directory",
    display: "grid",
    grid_number: 3,
    contents: detail.chapters.map((chap, index) => ({
      id: `chap-${chap.number || index + 1}`,
      name: chap.name,
      image: { 
        url: `https://via.placeholder.com/200x300/4a5568/ffffff?text=${encodeURIComponent(chap.name.substring(0, 15))}`, 
        type: "cover" 
      },
      streams: [{
        id: `stream-${chap.number || index + 1}`,
        name: chap.name,
        url: chap.url,
        type: "webview",
        headers: {
          'Referer': 'https://truyenqqno.com/',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
        }
      }]
    }))
  });
});

// Fake routes
app.get('/load-more', (req, res) => res.json({ channels: [] }));
app.get('/search', (req, res) => res.json({ items: [] }));

// Thay cho: app.listen(port, () => { ... })
const handler = app;

module.exports = handler;