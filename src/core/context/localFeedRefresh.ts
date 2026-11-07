export interface LocalFeedRefreshOptions<TDaily = unknown, TDiscovery = unknown, TWeather = unknown, TNetwork = unknown> {
  loadDaily: () => Promise<TDaily>;
  loadDiscovery: () => Promise<TDiscovery>;
  onFeed: (result: { daily: TDaily; discovery: TDiscovery }) => void;
  loadWeather?: () => Promise<TWeather> | TWeather;
  onWeather?: (weather: TWeather | null) => void;
  isCurrent?: () => boolean;
  loadNetworkDiscovery?: () => Promise<TNetwork>;
  onNetworkDiscovery?: (networkResult: TNetwork) => void;
}

export async function refreshLocalEdition<TDaily = unknown, TDiscovery = unknown, TWeather = unknown, TNetwork = unknown>(
  options: LocalFeedRefreshOptions<TDaily, TDiscovery, TWeather, TNetwork>
): Promise<void> {
  const {
    loadDaily,
    loadDiscovery,
    onFeed,
    loadWeather,
    onWeather,
    isCurrent = () => true,
    loadNetworkDiscovery,
    onNetworkDiscovery
  } = options;

  if (!isCurrent()) {
    return;
  }

  if (loadWeather && onWeather) {
    let wp: Promise<TWeather>;
    try {
      wp = Promise.resolve(loadWeather());
    } catch (e) {
      wp = Promise.reject(e);
    }
    wp.then(weather => {
      if (isCurrent()) {
        onWeather(weather);
      }
    }).catch(() => {
      if (isCurrent()) {
        onWeather(null);
      }
    });
  }

  const [daily, discovery] = await Promise.all([
    loadDaily(),
    loadDiscovery()
  ]);

  if (!isCurrent()) {
    return;
  }

  onFeed({ daily, discovery });

  if (loadNetworkDiscovery && onNetworkDiscovery) {
    try {
      const netRes = await loadNetworkDiscovery();
      if (isCurrent()) {
        onNetworkDiscovery(netRes);
      }
    } catch {
      // Graceful fallback
    }
  }
}
