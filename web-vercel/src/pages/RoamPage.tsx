// 全球漫游 — a spinnable WebGL globe of textbook-level landmarks. Click a marker
// to fly in and read its appreciation; collect it into your 馆藏 (reuses
// user_pins, so it also shows up on your shareable profile).
//
// Uses vanilla globe.gl (framework-agnostic — no React-version peer issues) and
// is lazy-loaded by App so three.js stays out of the main bundle.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Globe, { type GlobeInstance } from 'globe.gl';
import { useRoamPlaces, fetchPinnedWorkIds, togglePin } from '../hooks/useGallery';
import { useSession } from '../hooks/useSession';
import type { RoamPlace } from '../lib/types';

const CATEGORY_COLOR: Record<string, string> = {
  画: '#e7c067',
  建筑: '#7fb5d6',
  雕塑: '#c98f6a',
  遗址: '#9bbd7a',
};
const catColor = (c: string) => CATEGORY_COLOR[c] ?? '#e7c067';

const TODAY_GOLD = '#ffd166';
const DAILY_HUE = '#b9a87f';
const COLLECTED = '#fff1cf';

function beijingTodayISO(): string {
  const b = new Date(Date.now() + 8 * 3600 * 1000);
  return b.toISOString().slice(0, 10);
}

// Several works share a museum (the Beijing 故宫 scrolls, the Louvre, …) and so
// share coordinates. Fan any co-located points out in a small circle so they're
// individually visible and clickable. Returns copies (originals untouched).
function spread(places: RoamPlace[]): RoamPlace[] {
  const groups = new Map<string, RoamPlace[]>();
  for (const p of places) {
    const k = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
    const g = groups.get(k);
    if (g) g.push(p);
    else groups.set(k, [p]);
  }
  const out: RoamPlace[] = [];
  for (const grp of groups.values()) {
    if (grp.length === 1) {
      out.push({ ...grp[0] });
      continue;
    }
    const R = 1.1;
    grp.forEach((p, i) => {
      const ang = (2 * Math.PI * i) / grp.length;
      out.push({ ...p, lat: p.lat + R * Math.sin(ang), lng: p.lng + R * Math.cos(ang) });
    });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pt = any;

export default function RoamPage() {
  const nav = useNavigate();
  const { session } = useSession();
  const { data: places, loading, error } = useRoamPlaces();
  const [selected, setSelected] = useState<RoamPlace | null>(null);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [glError, setGlError] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const selectedRef = useRef<RoamPlace | null>(null);
  const collectedRef = useRef<Set<string>>(new Set());
  const placesRef = useRef<RoamPlace[]>([]);
  selectedRef.current = selected;
  collectedRef.current = collected;

  const todayISO = beijingTodayISO();
  const isToday = useCallback(
    (d: Pt) => d.kind === 'daily' && d.exhibitedOn === todayISO,
    [todayISO],
  );
  const colorFor = useCallback(
    (d: Pt) => {
      if (collectedRef.current.has(d.id)) return COLLECTED;
      if (isToday(d)) return TODAY_GOLD;
      if (d.kind === 'daily') return DAILY_HUE;
      return catColor(d.category);
    },
    [isToday],
  );
  const radiusFor = useCallback(
    (d: Pt) => {
      if (d.id === selectedRef.current?.id) return 1.3;
      if (isToday(d)) return 1.2;
      return d.kind === 'daily' ? 0.72 : 0.95;
    },
    [isToday],
  );
  const altFor = useCallback(
    (d: Pt) => {
      if (d.id === selectedRef.current?.id) return 0.16;
      if (isToday(d)) return 0.14;
      return d.kind === 'daily' ? 0.07 : 0.09;
    },
    [isToday],
  );

  // Load which landmarks this user has already collected.
  useEffect(() => {
    fetchPinnedWorkIds()
      .then(setCollected)
      .catch(() => {});
  }, [session]);

  // Re-apply marker accessors + the selection halo ring.
  const refreshMarkers = useCallback(() => {
    const w = globeRef.current;
    if (!w) return;
    w.pointAltitude(altFor).pointRadius(radiusFor).pointColor(colorFor);
    // Pulsing rings: today's daily work always, plus the selected point.
    const rings: RoamPlace[] = [];
    const todayPlace = placesRef.current.find((p) => isToday(p));
    if (todayPlace) rings.push(todayPlace);
    if (selectedRef.current && selectedRef.current.id !== todayPlace?.id) {
      rings.push(selectedRef.current);
    }
    w.ringsData(rings as unknown as object[])
      .ringLat((d: Pt) => d.lat)
      .ringLng((d: Pt) => d.lng)
      .ringColor((d: Pt) => {
        const gold = isToday(d) ? '255,209,102' : '231,192,103';
        return (t: number) => `rgba(${gold},${1 - t})`;
      })
      .ringMaxRadius(4.5)
      .ringPropagationSpeed(1.8)
      .ringRepeatPeriod(820);
  }, [altFor, radiusFor, colorFor, isToday]);

  const selectPlace = useCallback(
    (p: RoamPlace) => {
      setSelected(p);
      selectedRef.current = p;
      const w = globeRef.current;
      if (w) {
        w.controls().autoRotate = false;
        w.pointOfView({ lat: p.lat, lng: p.lng, altitude: 1.55 }, 1000);
        refreshMarkers();
      }
    },
    [refreshMarkers],
  );

  const closePanel = useCallback(() => {
    setSelected(null);
    selectedRef.current = null;
    const w = globeRef.current;
    if (w) {
      w.controls().autoRotate = true;
      refreshMarkers();
    }
  }, [refreshMarkers]);

  // Build the globe once places + container are ready.
  useEffect(() => {
    if (!containerRef.current || !places || !places.length || globeRef.current) return;
    const positioned = spread(places);
    placesRef.current = positioned;
    let world: GlobeInstance;
    try {
      world = new Globe(containerRef.current)
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
        .atmosphereColor('#e7c067')
        .atmosphereAltitude(0.16)
        .pointsData(positioned as unknown as object[])
        .pointLat((d: Pt) => d.lat)
        .pointLng((d: Pt) => d.lng)
        .pointAltitude(altFor)
        .pointRadius(radiusFor)
        .pointColor(colorFor)
        .pointLabel((d: Pt) => {
          const tag = d.kind === 'daily' ? (isToday(d) ? '今日展厅' : '日课') : d.category;
          return `<div style="font-family:Songti SC,serif;background:rgba(11,9,7,.86);border:1px solid rgba(231,192,103,.5);color:#f6ecd4;padding:6px 10px;border-radius:6px;font-size:12.5px;white-space:nowrap"><b style="color:#e7c067">${d.title}</b> · ${tag}<br/><span style="color:#8f8268">${d.place}</span></div>`;
        })
        .onPointClick((d: object) => selectPlace(d as RoamPlace));
    } catch {
      setGlError(true);
      return;
    }
    world.controls().autoRotate = true;
    world.controls().autoRotateSpeed = 0.32;
    world.controls().enableZoom = true;
    world.controls().minDistance = 180;
    world.pointOfView({ lat: 22, lng: 35, altitude: 2.5 }, 0);
    globeRef.current = world;

    const sizeToBox = () => {
      const el = containerRef.current;
      if (!el) return;
      world.width(el.clientWidth).height(el.clientHeight);
    };
    sizeToBox();
    const ro = new ResizeObserver(sizeToBox);
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      try {
        // globe.gl exposes a _destructor for teardown.
        (world as unknown as { _destructor?: () => void })._destructor?.();
      } catch {
        /* ignore */
      }
      globeRef.current = null;
    };
  }, [places, selectPlace, altFor, radiusFor, colorFor, isToday]);

  // Keep markers in sync when collection changes.
  useEffect(() => {
    refreshMarkers();
  }, [collected, refreshMarkers]);

  const onCollect = useCallback(async () => {
    if (!selected) return;
    if (!session) {
      nav('/login?returnTo=/?tab=roam');
      return;
    }
    const already = collected.has(selected.id);
    const next = new Set(collected);
    if (already) next.delete(selected.id);
    else next.add(selected.id);
    setCollected(next); // optimistic
    try {
      await togglePin(selected.id, already);
    } catch {
      setCollected(collected); // revert
    }
  }, [selected, session, collected, nav]);

  const isCollected = selected ? collected.has(selected.id) : false;

  return (
    <div className="roam-root">
      <div className="roam-head">
        <div className="roam-eyebrow">GLOBAL ROAMING · 全球漫游</div>
        <h1 className="roam-title">在地球上漫游名作</h1>
        <p className="roam-sub">
          旋转地球：金蓝绿点是精选世界名作，浅金点是你日课走过的地方，今日那件在发光。点亮任意一处，读懂它为何成立——喜欢的，收入你的馆藏。
        </p>
        <div className="roam-legend">
          {Object.entries(CATEGORY_COLOR).map(([k, v]) => (
            <span key={k} className="roam-legend-item">
              <i style={{ background: v }} />
              {k}
            </span>
          ))}
          <span className="roam-legend-item">
            <i style={{ background: DAILY_HUE }} />
            日课足迹
          </span>
          <span className="roam-legend-item">
            <i style={{ background: TODAY_GOLD, boxShadow: `0 0 10px ${TODAY_GOLD}` }} />
            今日
          </span>
          <span className="roam-legend-item">
            <i style={{ background: COLLECTED }} />
            已收藏
          </span>
        </div>
      </div>

      <div className="roam-stage">
        <div ref={containerRef} className="roam-globe" />

        {(loading || (!places?.length && !glError)) && (
          <div className="roam-overlay">
            {loading ? '正在点亮地球…' : '全球漫游即将开放——地标正在布展。'}
          </div>
        )}
        {error && <div className="roam-overlay">加载失败：{error}</div>}
        {glError && (
          <div className="roam-overlay">
            你的浏览器或显卡暂不支持 WebGL，无法渲染地球。可在其他设备上体验全球漫游。
          </div>
        )}

        {selected && (
          <aside className="roam-panel">
            <button className="roam-close" onClick={closePanel} aria-label="关闭">
              ×
            </button>
            {selected.image && (
              <div className="roam-panel-img" style={{ backgroundImage: `url(${selected.image})` }} />
            )}
            <div className="roam-panel-body">
              <span
                className="roam-chip"
                style={{
                  borderColor:
                    selected.kind === 'daily' ? TODAY_GOLD : catColor(selected.category),
                }}
              >
                {selected.kind === 'daily'
                  ? isToday(selected)
                    ? '今日展厅'
                    : '日课足迹'
                  : selected.category}
              </span>
              <h2 className="roam-name">{selected.title}</h2>
              {selected.titleEn && <div className="roam-name-en">{selected.titleEn}</div>}
              <div className="roam-meta">
                {[selected.artist, selected.year, selected.place].filter(Boolean).join(' · ')}
              </div>
              {selected.shortLabel && <p className="roam-label">{selected.shortLabel}</p>}
              {selected.curatorNote && <p className="roam-note">{selected.curatorNote}</p>}
              {selected.points.length > 0 && (
                <div className="roam-points">
                  <div className="roam-points-h">怎么看</div>
                  {selected.points.map((pt, i) => (
                    <div key={i} className="roam-point">
                      <b>{pt.label}</b>
                      <span>{pt.detail}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="roam-actions">
                <button
                  className={isCollected ? 'roam-btn roam-btn-on' : 'roam-btn'}
                  onClick={onCollect}
                >
                  {isCollected ? '★ 已收入馆藏' : '☆ 收入馆藏'}
                </button>
                <button className="roam-btn roam-btn-ghost" onClick={() => nav(`/work/${selected.id}`)}>
                  细看与答题 →
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
