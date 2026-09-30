// Art review (dev only): every sprite the game uses, by biome and category,
// animated at an integer scale and labelled with its logical id, plus the
// avatar in all 7 tiers and every cosmetic. Report problems by that id.

import { Canvas, Group } from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { BIOME_IDS } from '../../../domain/game/biomes';
import { biomeIds, REQUIRED_IDS, sprite, TIERS } from '../../../game/assets/manifest';
import { SHOP } from '../../../game/content/shop';
import { Avatar } from '../../../game/render/Avatar';
import { useGameClock } from '../../../game/render/clock';
import { BatchItem, SpriteBatch } from '../../../game/render/SpriteBatch';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { QUI } from '../../../game/ui/theme';
import { packShelves } from './packShelves';
import { Text } from '../../../components/Text';

const LABEL_H = 22;
const TIERS_OPEN = 1000;
const GEAR_OPEN = 1001;

/** Sections: each biome's ids by category, then the shared sprites. */
export function gallerySections(): { title: string; ids: string[] }[] {
  const perBiome = new Set<string>();
  const sections: { title: string; ids: string[] }[] = [];
  for (const b of BIOME_IDS) {
    const ids = biomeIds(b).filter((id) => !id.includes('@'));
    ids.forEach((id) => perBiome.add(id));
    const cat = (re: RegExp) => ids.filter((id) => re.test(id));
    sections.push({ title: `${b}: mobs and boss`, ids: cat(/^(mob|boss|trophy)\./) });
    sections.push({ title: `${b}: critters and villager`, ids: cat(/^(critter|villager)\./) });
    sections.push({ title: `${b}: tiles, decor, props`, ids: cat(/^(tile|decor|prop)\./) });
    sections.push({ title: `${b}: parallax`, ids: cat(/^parallax\./) });
  }
  const shared = REQUIRED_IDS.filter((id) => !perBiome.has(id) && !id.includes('@'));
  const group = (title: string, re: RegExp) => ({ title, ids: shared.filter((id) => re.test(id)) });
  sections.push(group('NPCs', /^npc\./), group('Companions', /^pet\./), group('Avatar layers', /^avatar\./), group('Props', /^prop\./), group('FX', /^fx\./), group('Icons', /^icon\./));
  const listed = new Set(sections.flatMap((s) => s.ids));
  sections.push({ title: 'Other', ids: shared.filter((id) => !listed.has(id)) });
  return sections.filter((s) => s.ids.length);
}

export function ArtGallery({ reduced }: { reduced: boolean }) {
  const { width } = useWindowDimensions();
  const [scale, setScale] = useState(3);
  const sections = useMemo(() => gallerySections(), []);
  const clock = useGameClock(!reduced);
  const [open, setOpen] = useState(TIERS_OPEN);
  return (
    <View style={{ gap: 12, paddingHorizontal: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[2, 3, 4].map((s) => (
          <PixelButton key={s} small tone={scale === s ? 'gold' : 'parchment'} label={`${s}×`} accessibilityLabel={`Show sprites at ${s} times`} onPress={() => setScale(s)} />
        ))}
      </View>
      {/* One section open at a time: each avatar is its own canvas, and web browsers keep only ~16 WebGL contexts. */}
      <PixelPanel tone="night" padding={2} style={{ gap: 8 }}>
        <PixelButton small tone={open === TIERS_OPEN ? 'gold' : 'parchment'} label="Avatar: 7 tiers" accessibilityLabel={`${open === TIERS_OPEN ? 'Hide' : 'Show'} the avatar's 7 tiers`} onPress={() => setOpen(open === TIERS_OPEN ? -1 : TIERS_OPEN)} />
        {open === TIERS_OPEN && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({ length: TIERS }, (_, t) => (
              <Labelled key={t} label={`tier ${t}`}>
                <Avatar tier={t} gear={{}} scale={scale} animate={!reduced} accessibilityLabel={`Avatar tier ${t}`} />
              </Labelled>
            ))}
          </View>
        )}
      </PixelPanel>
      <PixelPanel tone="night" padding={2} style={{ gap: 8 }}>
        <PixelButton small tone={open === GEAR_OPEN ? 'gold' : 'parchment'} label="Avatar: every cosmetic" accessibilityLabel={`${open === GEAR_OPEN ? 'Hide' : 'Show'} every cosmetic on the avatar`} onPress={() => setOpen(open === GEAR_OPEN ? -1 : GEAR_OPEN)} />
        {open === GEAR_OPEN && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SHOP.filter((s) => s.kind === 'gear' && s.slot).map((s) => (
              <Labelled key={s.sku} label={s.sku}>
                <Avatar tier={2} gear={{ [s.slot!]: s.sku }} scale={scale} animate={!reduced} accessibilityLabel={`Avatar wearing ${s.name}`} />
              </Labelled>
            ))}
          </View>
        )}
      </PixelPanel>
      {sections.map((s, i) => (
        <PixelPanel key={s.title} tone="night" padding={2} style={{ gap: 8 }}>
          <PixelButton small tone={open === i ? 'gold' : 'parchment'} label={`${s.title} (${s.ids.length})`} accessibilityLabel={`${open === i ? 'Hide' : 'Show'} ${s.title}`} onPress={() => setOpen(open === i ? -1 : i)} />
          {open === i && <Sheet ids={s.ids} scale={scale} width={width - 40} clock={clock} />}
        </PixelPanel>
      ))}
    </View>
  );
}

function Sheet({ ids, scale, width, clock }: { ids: string[]; scale: number; width: number; clock: ReturnType<typeof useGameClock> }) {
  const maxW = Math.floor(width / scale);
  const { cells, rows } = useMemo(() => {
    const packed = packShelves(ids, maxW, (id) => sprite(id));
    // Labels need room: spread rows apart by the label height (in game pixels).
    const rowYs = [...new Set(packed.cells.map((c) => c.y))];
    const shift = new Map(rowYs.map((y, i) => [y, y + i * Math.ceil(LABEL_H / scale)]));
    return { cells: packed.cells.map((c) => ({ ...c, y: shift.get(c.y)! })), rows: rowYs.length };
  }, [ids, maxW, scale]);
  const height = Math.max(...cells.map((c) => c.y + c.h)) + Math.ceil(LABEL_H / scale);
  const byAtlas = new Map<string, BatchItem[]>();
  for (const c of cells) {
    const m = sprite(c.id);
    const list = byAtlas.get(m.atlas) ?? [];
    list.push({ id: c.id, x: c.x + m.ax, y: c.y + m.ay });
    byAtlas.set(m.atlas, list);
  }
  return (
    <View style={{ width: maxW * scale, height: height * scale }} accessibilityLabel={`${ids.length} sprites in ${rows} rows`}>
      <Canvas style={{ width: maxW * scale, height: height * scale }}>
        <Group transform={[{ scale }]}>
          {[...byAtlas.entries()].map(([a, items]) => (
            <SpriteBatch key={a} atlas={a as never} items={items} clock={clock} />
          ))}
        </Group>
      </Canvas>
      {cells.map((c) => (
        <Text key={c.id} numberOfLines={2} style={{ position: 'absolute', left: c.x * scale, top: (c.y + c.h) * scale + 1, width: Math.max(c.w * scale, 72), color: QUI.white, fontSize: 8, fontFamily: 'Courier' }}>
          {c.id}
        </Text>
      ))}
    </View>
  );
}

const Labelled = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={{ alignItems: 'center', gap: 2 }}>
    {children}
    <Text style={{ color: QUI.white, fontSize: 8, fontFamily: 'Courier' }}>{label}</Text>
  </View>
);
