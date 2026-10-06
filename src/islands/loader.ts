/** The opening loader stays only until the page can be seen: the site has started and the skyline picture is drawn. Never longer than a cap, so a slow picture can't hold the page hostage. */

/** The longest the loader may stay, even if the picture is still on its way. */
const LOADER_MAX_MS = 1500;

export function hideLoaderWhenReady(opts: { loader: HTMLElement | null; picture: HTMLImageElement | null }): void {
  const { loader, picture } = opts;
  if (!loader) return;
  const pictureReady = picture ? picture.decode().catch(() => undefined) : Promise.resolve();
  const capped = new Promise((resolve) => setTimeout(resolve, LOADER_MAX_MS));
  Promise.race([pictureReady, capped]).then(() => loader.classList.add("done"));
}
