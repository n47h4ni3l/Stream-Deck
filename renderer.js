<!DOCTYPE html><html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stream Deck Launcher</title>
  <style>
    body {
      background-color: #1b1f2b;
      color: #c7d5e0;
      font-family: 'Segoe UI', sans-serif;
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    h1 {
      color: #c7bfff;
      margin-bottom: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 20px;
      width: 100%;
      max-width: 800px;
    }
    .tile {
      background-color: #2b2f3b;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 15px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .tile:hover {
      transform: scale(1.05);
      background-color: #3a3f4f;
    }
    .tile img {
      width: 64px;
      height: 64px;
    }
  </style>
</head>
<body>
  <h1>🎮 Stream Deck</h1>
  <div class="grid" id="services"></div>  <script>
    const services = [
      { name: 'Netflix', icon: 'service_icons/netflix.png', url: 'https://www.netflix.com' },
      { name: 'YouTube', icon: 'service_icons/youtube.png', url: 'https://www.youtube.com' },
      { name: 'Disney+', icon: 'service_icons/disneyplus.png', url: 'https://www.disneyplus.com' },
      { name: 'Prime Video', icon: 'service_icons/prime.png', url: 'https://www.primevideo.com' },
      { name: 'Crunchyroll', icon: 'service_icons/crunchyroll.png', url: 'https://www.crunchyroll.com' },
      { name: 'Hulu', icon: 'service_icons/hulu.png', url: 'https://www.hulu.com' },
      { name: 'Binge', icon: 'service_icons/binge.png', url: 'https://binge.com.au' },
      { name: 'Stan', icon: 'service_icons/stan.png', url: 'https://www.stan.com.au' },
      { name: 'Paramount+', icon: 'service_icons/paramountplus.png', url: 'https://www.paramountplus.com' },
      { name: 'Peacock', icon: 'service_icons/peacock.png', url: 'https://www.peacocktv.com' },
      { name: 'Tubi', icon: 'service_icons/tubi.png', url: 'https://www.tubitv.com' },
      { name: 'Pluto TV', icon: 'service_icons/plutotv.png', url: 'https://pluto.tv' },
      { name: 'Kayo', icon: 'service_icons/kayo.png', url: 'https://kayosports.com.au' },
      { name: 'BBC iPlayer', icon: 'service_icons/bbc-iplayer.png', url: 'https://www.bbc.co.uk/iplayer' },
      { name: 'Max', icon: 'service_icons/max.png', url: 'https://www.max.com' },
      { name: 'Apple TV+', icon: 'service_icons/apple-tv-plus.png', url: 'https://tv.apple.com' }
    ];

    const container = document.getElementById('services');

    services.forEach(service => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.innerHTML = `<img src="${service.icon}" alt="${service.name}">`;
      tile.addEventListener('click', () => {
        window.electronAPI.launchService(service.url);
      });
      container.appendChild(tile);
    });
  </script></body>
</html>