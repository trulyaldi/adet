// Atlas images, decoded once and shared by every sprite that draws from them.
// Only atlases in use are decoded; releaseAtlas frees one (far-away biomes).

import { Skia, SkImage } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';

import { ATLAS_SOURCES } from '../assets/atlasSources';
import type { AtlasName } from '../assets/manifest';

const loading = new Map<AtlasName, Promise<SkImage | null>>();
const ready = new Map<AtlasName, SkImage>();
const users = new Map<AtlasName, number>();

export function loadAtlas(name: AtlasName): Promise<SkImage | null> {
  let p = loading.get(name);
  if (!p) {
    p = (async () => {
      const asset = Asset.fromModule(ATLAS_SOURCES[name]);
      await asset.downloadAsync();
      const data = await Skia.Data.fromURI(asset.localUri ?? asset.uri);
      const img = Skia.Image.MakeImageFromEncoded(data);
      if (img) ready.set(name, img);
      return img;
    })().catch(() => {
      loading.delete(name);
      return null;
    });
    loading.set(name, p);
  }
  return p;
}

/** Free an atlas nothing is drawing from. */
function release(name: AtlasName) {
  const img = ready.get(name);
  ready.delete(name);
  loading.delete(name);
  // Freed after this frame, so a draw in flight never touches a disposed image.
  if (img) setTimeout(() => (users.get(name) ? ready.set(name, img) : img.dispose()), 1000);
}

/** The atlas image once decoded (null until then). Unused atlases are freed. */
export function useAtlas(name: AtlasName | null): SkImage | null {
  // The decoded image, keyed by name so a changed name never shows the old atlas.
  const [loaded, setLoaded] = useState<{ name: AtlasName; img: SkImage | null } | null>(null);
  useEffect(() => {
    if (!name) return;
    users.set(name, (users.get(name) ?? 0) + 1);
    let alive = true;
    if (!ready.has(name)) loadAtlas(name).then((img) => alive && setLoaded({ name, img }));
    return () => {
      alive = false;
      const n = (users.get(name) ?? 1) - 1;
      users.set(name, n);
      // The shared atlas stays; biome atlases go when no one draws from them.
      if (n <= 0 && name !== 'shared') release(name);
    };
  }, [name]);
  if (!name) return null;
  return ready.get(name) ?? (loaded?.name === name ? loaded.img : null);
}
