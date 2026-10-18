export interface LocalFeedRefreshOptions<TDaily = unknown, TDiscovery = unknown, TWeather = unknown> {
  loadDaily: () => Promise<TDaily>;
  loadDiscovery: () => Promise<TDiscovery>;
  onFeed: (result: { daily: TDaily; discovery: TDiscovery }) => void;
  loadWeather?: () => Promise<TWeather> | TWeather;
  onWeather?: (weather: TWeather | null) => void;
  isCurrent?: () => boolean;
}

export async function refreshLocalEdition<TDaily = unknown, TDiscovery = unknown, TWeather = unknown>(
  options: LocalFeedRefreshOptions<TDaily, TDiscovery, TWeather>
): Promise<void> {
  const { loadDaily, loadDiscovery, onFeed, loadWeather, onWeather, isCurrent = () => true } = options;

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
}
