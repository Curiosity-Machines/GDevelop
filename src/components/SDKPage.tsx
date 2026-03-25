import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Content data
// ---------------------------------------------------------------------------

const DEVICE_SPECS = [
  { label: 'Display', value: '800×800 circular' },
  { label: 'DPI', value: '320' },
  { label: 'Platform', value: 'Android 14' },
  { label: 'Chipset', value: 'Qualcomm Panda' },
  { label: 'Viewport', value: 'DPR 1 — CSS px = physical px' },
];

const BUTTONS = [
  { id: 'A', location: 'Front of handle', role: 'Context / options — "what can this do?"' },
  { id: 'B', location: 'Rear of handle', role: 'Action / trigger — "do this"' },
  { id: 'C', location: 'Top / side', role: 'Free — game-defined' },
];

const SIZING_RULES = [
  { element: 'Tap target', min: '140px diameter' },
  { element: 'Body text', min: '28px' },
  { element: 'Section title', min: '34–36px' },
  { element: 'Hero value', min: '72–140px' },
  { element: 'Icon glyph', min: '44px' },
];

interface SDKNamespace {
  id: string;
  name: string;
  icon: string;
  desc: string;
  types: string;
  example: string;
}

const SDK_NAMESPACES: SDKNamespace[] = [
  {
    id: 'motion',
    name: 'Motion',
    icon: '◎',
    desc: 'IMU data — gravity, orientation quaternion, frame deltas',
    types: `interface MotionOptions {
  frequency?: number;   // Hz, 1–240 (default 60)
  smoothing?: number;   // 0.0=max smooth, 1.0=raw (default 0.1)
}
interface MotionData {
  gravity: Vector3;
  smoothGravity: Vector3;
  orientation: Quaternion;
  delta: Vector3;
  timestamp: number;
  sequenceNumber: number;
}
interface MotionSubscription {
  readonly id: string;
  readonly active: boolean;
  on(event: 'data', handler: (data: MotionData) => void): this;
  off(event: 'data', handler: (data: MotionData) => void): this;
  stop(): void;
}`,
    example: `const sub = await Loop.motion.start({
  frequency: 60,
  smoothing: 0.1
});

sub.on('data', data => {
  // data.orientation — Quaternion { x, y, z, w }
  // data.smoothGravity — Vector3 { x, y, z }
  // data.delta — frame-to-frame change
});

// Always clean up
window.addEventListener('beforeunload', () => sub.stop());`,
  },
  {
    id: 'buttons',
    name: 'Buttons',
    icon: '⊡',
    desc: 'Physical A/B/C buttons — press and release events',
    types: `type ButtonId = 'A' | 'B' | 'C';
type ButtonState = 'down' | 'up';
type ButtonEventType = 'press' | 'release' | 'A' | 'B' | 'C';

interface ButtonEvent {
  button: ButtonId;
  state: ButtonState;
  timestamp: number;
  sequenceNumber: number;
}

interface ButtonsAPI {
  on(event: ButtonEventType, handler: (e: ButtonEvent) => void): void;
  off(event: ButtonEventType, handler: (e: ButtonEvent) => void): void;
}`,
    example: `// Listen to specific button
Loop.buttons.on('A', e => {
  if (e.state === 'down') doAction();
});

// Listen to all presses
Loop.buttons.on('press', e => {
  console.log(e.button, e.state); // 'A' 'down'
});`,
  },
  {
    id: 'haptics',
    name: 'Haptics',
    icon: '∿',
    desc: 'Vibration feedback — pulses and custom curves',
    types: `interface HapticCurve {
  keys: { time: number; value: number }[];
  strength?: number;  // overall multiplier
}
interface HapticsResult {
  success: boolean;
  error?: string;
  durationMs?: number;
}
interface HapticsAPI {
  isSupported(): boolean;
  pulse(intensity?: number): HapticsResult;
  playCurve(curve: HapticCurve): HapticsResult;
  stop(): HapticsResult;
}`,
    example: `// Quick pulse at 80% intensity
Loop.haptics.pulse(0.8);

// Custom vibration curve
Loop.haptics.playCurve({
  keys: [
    { time: 0.0, value: 0.0 },
    { time: 0.1, value: 1.0 },
    { time: 1.0, value: 0.0 },
  ],
  strength: 0.8,
});`,
  },
  {
    id: 'ble',
    name: 'BLE',
    icon: '⇄',
    desc: 'Bluetooth multiplayer — host, join, message passing',
    types: `type BLEConnectionState =
  | 'idle' | 'negotiating' | 'hosting'
  | 'scanning' | 'connecting' | 'connected'
  | 'reconnecting';

interface BLEPlayerInfo {
  id: string;
  name: string;
}

interface BLEAPI {
  createGame(gameId: string): string;  // returns token
  joinGame(token: string, name?: string): Promise<BLEPlayerInfo>;
  playGame(seed: string, name?: string): Promise<{ role: string; token: string }>;
  getState(): BLEConnectionState;
  send(data: unknown, options?: { to?: string }): void;
  endGame(): void;
  leaveGame(): void;
  on(event: 'message', handler: (e: { data: unknown; from: BLEPlayerInfo }) => void): void;
  on(event: 'playerJoined' | 'playerLeft', handler: (e: { player: BLEPlayerInfo }) => void): void;
  on(event: 'connected', handler: (e: { host: BLEPlayerInfo }) => void): void;
  on(event: 'disconnected', handler: (e: { reason: string }) => void): void;
  off(event: string, handler: Function): void;
}`,
    example: `// Host a game — returns token to share
const token = Loop.ble.createGame('my-game');

// Join as a player
await Loop.ble.joinGame(token, 'Alice');

// Symmetric role resolution
const { role } = await Loop.ble.playGame('seed', 'Alice');

// Listen for messages
Loop.ble.on('message', e => {
  console.log(e.from.name, e.data);
});

// Always handle disconnects
Loop.ble.on('disconnected', e => {
  Loop.led.off();
  showDisconnectedUI(e.reason);
});`,
  },
  {
    id: 'storage',
    name: 'Storage',
    icon: '▤',
    desc: 'Per-game persistence — 1MB quota, save slots',
    types: `interface StorageResult {
  success: boolean;
  error?: string;
}
interface StorageUsage {
  used: number;   // bytes
  quota: number;  // bytes (1MB)
}
interface StorageAPI {
  setItem(key: string, value: string): StorageResult;
  getItem(key: string): string | null;
  removeItem(key: string): StorageResult;
  clear(): StorageResult;
  keys(): string[];
  getUsage(): StorageUsage;
  exists(key: string): boolean;
}`,
    example: `// Save game state
Loop.storage.setItem('state',
  JSON.stringify({ level: 3, score: 1250 })
);

// Load it back
const state = JSON.parse(
  Loop.storage.getItem('state') ?? '{}'
);

// Player name (convention)
Loop.storage.setItem('playerName', 'Alice');

// Check quota
const { used, quota } = Loop.storage.getUsage();`,
  },
  {
    id: 'led',
    name: 'LED',
    icon: '◉',
    desc: 'RGB flashlight — hex color control',
    types: `interface LedResult {
  success: boolean;
  error?: string;
}
interface LedAPI {
  set(color: string): LedResult;  // "#RRGGBB"
  off(): LedResult;
}`,
    example: `// Set LED to cyan (Loop accent)
Loop.led.set("#00d4ff");

// Red alert
Loop.led.set("#FF0000");

// Turn off (also auto-off on game exit)
Loop.led.off();`,
  },
  {
    id: 'system',
    name: 'System',
    icon: '⏻',
    desc: 'Lifecycle, rotation lock, launch child activities, quit',
    types: `interface SystemAPI {
  isFreeRotateEnabled(): boolean;
  setFreeRotate(enabled: boolean): { success: boolean };
  quit(): void;  // fire-and-forget exit
  launch(manifestUrl: string): Promise<void>;  // open child activity
  getVersion(): { versionName: string; versionCode: number };
  on(event: 'pause', handler: (e: {
    reason: 'sleep' | 'settings'
  }) => void): void;
  on(event: 'resume', handler: (e: {
    reason: string;
    pausedMs: number;
  }) => void): void;
  off(event: string, handler: Function): void;
}`,
    example: `// Handle pause/resume
Loop.system.on('pause', e => {
  if (e.reason === 'sleep') pauseGame();
});
Loop.system.on('resume', e => resumeGame());

// Launch a child activity (max depth 3)
await Loop.system.launch(manifestUrl);

// Check native version
const { versionName } = Loop.system.getVersion();

// Lock rotation for fixed-orientation games
Loop.system.setFreeRotate(false);

// Save and quit
Loop.storage.setItem('state', JSON.stringify(state));
Loop.system.quit();`,
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative group">
      {label && (
        <div className="text-[11px] uppercase tracking-[0.15em] text-[#00d4ff]/60 mb-1.5 font-mono">
          {label}
        </div>
      )}
      <div className="relative rounded-lg overflow-hidden" style={{ background: '#181822' }}>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 px-2 py-1 text-[11px] font-mono rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-0"
          style={{
            background: '#252535',
            color: copied ? '#00d4ff' : '#666680',
          }}
        >
          {copied ? 'copied' : 'copy'}
        </button>
        <pre className="m-0 p-4 overflow-x-auto text-[13px] leading-[1.6]" style={{ color: '#dddde8', fontFamily: "var(--font-family-sans)" }}>
          {code}
        </pre>
      </div>
    </div>
  );
}

function NamespaceCard({ ns }: { ns: SDKNamespace }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: expanded ? '#0d0d1f' : '#0a0a18',
        border: `1px solid ${expanded ? '#00d4ff20' : '#ffffff08'}`,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer border-0 bg-transparent transition-colors hover:bg-white/[0.02]"
      >
        <span
          className="text-xl shrink-0 w-9 h-9 flex items-center justify-center rounded-lg"
          style={{ background: '#00d4ff10', color: '#00d4ff' }}
        >
          {ns.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold" style={{ color: '#e8e8f0', fontFamily: "var(--font-family-sans)" }}>
            Loop.{ns.name.toLowerCase()}
          </div>
          <div className="text-[13px] mt-0.5" style={{ color: '#9999b0' }}>
            {ns.desc}
          </div>
        </div>
        <span
          className="text-sm transition-transform duration-200 shrink-0"
          style={{ color: '#707088', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 flex flex-col gap-4" style={{ borderTop: '1px solid #ffffff06' }}>
          <div className="pt-4" />
          <CodeBlock code={ns.types} label="Types" />
          <CodeBlock code={ns.example} label="Example" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { id: 'quickstart', label: 'Quick Start' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'sdk', label: 'SDK' },
  { id: 'design', label: 'Design' },
  { id: 'deploy', label: 'Deploy' },
];

// SDK asset files in Supabase Storage
const SDK_INSTALLS = [
  {
    id: 'loop-dev',
    label: 'Loop Dev',
    version: 'SDK v0.0.7',
    desc: 'Claude Code skill for building Loop activities',
    files: [
      { key: 'loop-dev.md', dest: '~/.claude/commands/loop-dev.md' },
      { key: 'loop-sdk-dx.d.ts', dest: 'loop-sdk-dx.d.ts' },
    ],
  },
  {
    id: 'dopple-deploy',
    label: 'Dopple Deploy',
    version: 'v0.3.0',
    desc: 'Claude Code skill + CLI for deploying to Dopple Studio',
    files: [
      { key: 'dopple-deploy.md', dest: '~/.claude/commands/dopple-deploy.md' },
      { key: 'dopple-cli.cjs', dest: '~/.dopple/cli.cjs' },
    ],
  },
] as const;

function SkillInstallCard({ install }: { install: typeof SDK_INSTALLS[number] }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');

  const handleCopy = useCallback(() => {
    setStatus('loading');

    // Safari requires clipboard.write() to be called synchronously in the
    // gesture handler. Pass a Promise to ClipboardItem so the async signed-URL
    // fetch resolves later while the write is already queued.
    const textPromise = (async (): Promise<Blob> => {
      const lines: string[] = [];
      for (const f of install.files) {
        const { data, error } = await supabase.storage
          .from('sdk-assets')
          .createSignedUrl(f.key, 3600);

        if (error || !data?.signedUrl) {
          setStatus('error');
          setTimeout(() => setStatus('idle'), 2000);
          throw new Error('Failed to generate signed URL');
        }

        const dir = f.dest.substring(0, f.dest.lastIndexOf('/'));
        if (dir && dir !== '.') {
          lines.push(`mkdir -p ${dir}`);
        }
        lines.push(`curl -sL "${data.signedUrl}" \\\n  -o ${f.dest}`);
      }

      if (install.id === 'dopple-deploy') {
        lines.push(`grep -q 'dopple/cli.cjs' ~/.zshrc 2>/dev/null || echo "alias dopple='node ~/.dopple/cli.cjs'" >> ~/.zshrc`);
        lines.push(`grep -q 'dopple/cli.cjs' ~/.bashrc 2>/dev/null || echo "alias dopple='node ~/.dopple/cli.cjs'" >> ~/.bashrc`);
        lines.push(`alias dopple='node ~/.dopple/cli.cjs'`);
        lines.push(`echo "dopple installed"`);
      }

      const script = `bash -c '${lines.join(' && ').replace(/'/g, "'\\''")}'`;
      return new Blob([script], { type: 'text/plain' });
    })();

    navigator.clipboard.write([
      new ClipboardItem({ 'text/plain': textPromise }),
    ]).then(() => {
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 8000);
    }).catch(() => {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    });
  }, [install]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-4 w-full px-5 py-4 rounded-xl text-left cursor-pointer border-0 transition-colors"
      style={{
        background: status === 'copied' ? '#00d4ff08' : '#181822',
        border: `1px solid ${status === 'copied' ? '#00d4ff25' : '#ffffff08'}`,
        color: '#e0e0e8',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">{install.label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#00d4ff10', color: '#00d4ff' }}>{install.version}</span>
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: '#9999b0' }}>{install.desc}</div>
        <div className="text-[11px] mt-1.5" style={{ color: '#707088' }}>
          {install.files.map(f => f.key).join(', ')}
        </div>
      </div>
      <span
        className="text-[12px] shrink-0 px-3 py-1.5 rounded-lg"
        style={{
          background: status === 'copied' ? '#00d4ff15' : '#ffffff06',
          color: status === 'copied' ? '#00d4ff' : status === 'error' ? '#ff6666' : '#9999b0',
        }}
      >
        {status === 'loading' ? '...' : status === 'copied' ? 'copied!' : status === 'error' ? 'error' : 'copy install'}
      </span>
    </button>
  );
}

export function SDKPage() {
  const [activeSection, setActiveSection] = useState('quickstart');

  // Intersection observer for active nav
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );

    for (const item of NAV_ITEMS) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#111118', color: '#dddde8', fontFamily: "var(--font-family-sans)" }}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Circular glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, #00d4ff08 0%, transparent 70%)',
          }}
        />
        {/* Ring decoration */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: '500px',
            height: '500px',
            border: '1px solid #00d4ff10',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: '380px',
            height: '380px',
            border: '1px solid #00d4ff08',
          }}
        />

        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-16 pb-12">
          <div
            className="text-[11px] uppercase tracking-[0.3em] mb-6 flex items-center gap-3"
            style={{ color: '#00d4ff', fontFamily: "var(--font-family-sans)" }}
          >
            <span>Dopple Loop SDK</span>
            <span className="px-2 py-0.5 rounded" style={{ background: '#00d4ff10', fontSize: '10px' }}>f441e32</span>
          </div>
          <h1
            className="text-5xl md:text-7xl font-extrabold m-0 mb-4"
            style={{
              fontFamily: "var(--font-family-sans)",
              color: '#f0f0f8',
              letterSpacing: '-0.02em',
            }}
          >
            Build for the Loop
          </h1>
          <p
            className="text-lg md:text-xl max-w-[560px] m-0 mb-10 leading-relaxed"
            style={{ color: '#a8a8be' }}
          >
            Create WebView activities for a round, motion-controlled handheld device.
            IMU, haptics, BLE multiplayer, RGB LED — using standard web technologies and our TypeScript SDK.
          </p>

          {/* Spec pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {['800×800 circular', 'Android 14', 'IMU + Gyro', 'Haptics', 'BLE Multiplayer', 'RGB LED', '3 Buttons'].map((s) => (
              <span
                key={s}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium"
                style={{
                  background: '#00d4ff08',
                  color: '#00d4ff',
                  border: '1px solid #00d4ff15',
                  fontFamily: "var(--font-family-sans)",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sticky nav ───────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          background: '#080812e0',
          borderColor: '#ffffff08',
        }}
      >
        <div className="max-w-[900px] mx-auto px-6 flex gap-1 overflow-x-auto py-2">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="px-3 py-1.5 rounded-md text-[13px] font-medium no-underline whitespace-nowrap transition-colors"
              style={{
                color: activeSection === item.id ? '#00d4ff' : '#666680',
                background: activeSection === item.id ? '#00d4ff10' : 'transparent',
                fontFamily: "var(--font-family-sans)",
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="max-w-[900px] mx-auto px-6 py-16 flex flex-col gap-24">

        {/* ── Quick Start ──────────────────────────────────── */}
        <section id="quickstart">
          <SectionHeading number="01" title="Quick Start" />

          <div className="flex flex-col gap-8 mt-8">
            <Step number={1} title="Install skills and tools">
              <p className="text-[13px] m-0 mb-3" style={{ color: '#9999b0' }}>
                Click to copy a one-liner install script. Signed URLs expire in 1 hour.
              </p>
              <div className="flex flex-col gap-3">
                {SDK_INSTALLS.map((install) => (
                  <SkillInstallCard key={install.id} install={install} />
                ))}
              </div>
            </Step>

            <Step number={2} title="Build and deploy">
              <CodeBlock code={`# Initialize dopple config in your project
dopple init

# Deploy to Dopple Studio
dopple deploy`} />
              <p className="text-sm mt-3 m-0" style={{ color: '#9999b0' }}>
                Or upload a ZIP bundle directly in&nbsp;
                <a href="/" style={{ color: '#00d4ff' }}>Dopple Studio</a>.
              </p>
            </Step>
          </div>

        </section>

        {/* ── Hardware ─────────────────────────────────────── */}
        <section id="hardware">
          <SectionHeading number="02" title="Hardware" />

          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {/* Device specs */}
            <div className="rounded-xl p-5" style={{ background: '#181822', border: '1px solid #ffffff08' }}>
              <h3 className="text-[13px] uppercase tracking-[0.15em] m-0 mb-4" style={{ color: '#00d4ff', fontFamily: "var(--font-family-sans)" }}>
                Device
              </h3>
              <div className="flex flex-col gap-3">
                {DEVICE_SPECS.map((s) => (
                  <div key={s.label} className="flex justify-between items-baseline gap-4">
                    <span className="text-[13px]" style={{ color: '#9999b0' }}>{s.label}</span>
                    <span className="text-[13px] font-medium text-right" style={{ color: '#e0e0e8', fontFamily: "var(--font-family-sans)" }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="rounded-xl p-5" style={{ background: '#181822', border: '1px solid #ffffff08' }}>
              <h3 className="text-[13px] uppercase tracking-[0.15em] m-0 mb-4" style={{ color: '#00d4ff', fontFamily: "var(--font-family-sans)" }}>
                Buttons
              </h3>
              <div className="flex flex-col gap-3">
                {BUTTONS.map((b) => (
                  <div key={b.id} className="flex gap-3 items-start">
                    <span
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-[13px] font-bold"
                      style={{ background: '#00d4ff15', color: '#00d4ff', fontFamily: "var(--font-family-sans)" }}
                    >
                      {b.id}
                    </span>
                    <div>
                      <div className="text-[13px]" style={{ color: '#e0e0e8' }}>{b.location}</div>
                      <div className="text-[12px] mt-0.5" style={{ color: '#9999b0' }}>{b.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interaction philosophy */}
          <div className="mt-6 rounded-xl p-5" style={{ background: '#181822', border: '1px solid #ffffff08' }}>
            <h3 className="text-[13px] uppercase tracking-[0.15em] m-0 mb-3" style={{ color: '#00d4ff', fontFamily: "var(--font-family-sans)" }}>
              Interaction Model
            </h3>
            <p className="text-[14px] leading-relaxed m-0 mb-3" style={{ color: '#a8a8be' }}>
              <strong style={{ color: '#e0e0e8' }}>Movement is the interface.</strong> The Loop is not a phone on a stick.
              Interactions should begin with the body, not the finger. Prefer whole-device gestures, IMU-driven navigation, and physical movement over touch.
            </p>
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="flex gap-3 items-center">
                <span style={{ color: '#ff4444' }}>✗</span>
                <span style={{ color: '#9999b0' }}>Pictures under glass — fingertips only, phone-style</span>
              </div>
              <div className="flex gap-3 items-center">
                <span style={{ color: '#ffaa00' }}>○</span>
                <span style={{ color: '#a8a8b8' }}>Diegetic/mimetic — marbles inside a vessel</span>
              </div>
              <div className="flex gap-3 items-center">
                <span style={{ color: '#00d4ff' }}>◉</span>
                <span style={{ color: '#dddde8' }}>3DoF spatial — IMU as d-pad, reticle + buttons as mouse</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── SDK Reference ────────────────────────────────── */}
        <section id="sdk">
          <SectionHeading number="03" title="SDK Reference" />
          <p className="text-[14px] mt-4 mb-6" style={{ color: '#9999b0' }}>
            The <code className="text-[13px] px-1.5 py-0.5 rounded" style={{ background: '#181822', color: '#00d4ff', fontFamily: "var(--font-family-sans)" }}>Loop</code> global
            is injected before any script runs. Check individual namespaces before use.
          </p>

          <CodeBlock
            label="Availability check"
            code={`// WRONG — isAvailable() doesn't guarantee all namespaces
if (Loop.isAvailable()) Loop.buttons.on('press', fn);

// CORRECT — check the namespace you need
if (Loop.buttons) Loop.buttons.on('press', fn);
if (Loop.motion)  Loop.motion.start({ frequency: 60 });`}
          />

          <div className="flex flex-col gap-3 mt-8">
            {SDK_NAMESPACES.map((ns) => (
              <NamespaceCard key={ns.id} ns={ns} />
            ))}
          </div>
        </section>

        {/* ── Design Guidelines ────────────────────────────── */}
        <section id="design">
          <SectionHeading number="04" title="Design Guidelines" />

          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {/* Sizing */}
            <div className="rounded-xl p-5" style={{ background: '#181822', border: '1px solid #ffffff08' }}>
              <h3 className="text-[13px] uppercase tracking-[0.15em] m-0 mb-4" style={{ color: '#00d4ff', fontFamily: "var(--font-family-sans)" }}>
                320 DPI Minimum Sizes
              </h3>
              <div className="flex flex-col gap-2">
                {SIZING_RULES.map((r) => (
                  <div key={r.element} className="flex justify-between items-baseline">
                    <span className="text-[13px]" style={{ color: '#9999b0' }}>{r.element}</span>
                    <span className="text-[13px] font-medium" style={{ color: '#e0e0e8', fontFamily: "var(--font-family-sans)" }}>{r.min}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="rounded-xl p-5" style={{ background: '#181822', border: '1px solid #ffffff08' }}>
              <h3 className="text-[13px] uppercase tracking-[0.15em] m-0 mb-4" style={{ color: '#00d4ff', fontFamily: "var(--font-family-sans)" }}>
                Color & Layout
              </h3>
              <div className="flex flex-col gap-3 text-[13px]">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full shrink-0" style={{ background: '#111118', border: '1px solid #ffffff20' }} />
                  <span style={{ color: '#9999b0' }}>Background</span>
                  <span className="ml-auto" style={{ color: '#a8a8b8', fontFamily: "var(--font-family-sans)" }}>#080812</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full shrink-0" style={{ background: '#00d4ff' }} />
                  <span style={{ color: '#9999b0' }}>Primary accent</span>
                  <span className="ml-auto" style={{ color: '#a8a8b8', fontFamily: "var(--font-family-sans)" }}>#00d4ff</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px]" style={{ background: '#111118', border: '2px solid #ffffff15', color: '#666' }}>
                    R
                  </span>
                  <span style={{ color: '#9999b0' }}>Circular canvas — use radial layouts</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px]" style={{ background: '#111118', border: '2px solid #ffffff15', color: '#666' }}>
                    H
                  </span>
                  <span style={{ color: '#9999b0' }}>Haptic on every meaningful interaction</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Deploy ───────────────────────────────────────── */}
        <section id="deploy">
          <SectionHeading number="05" title="Deploy" />

          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {/* CLI deploy */}
            <div className="rounded-xl p-5 flex flex-col gap-4" style={{ background: '#181822', border: '1px solid #00d4ff15' }}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#00d4ff15', color: '#00d4ff', fontFamily: "var(--font-family-sans)" }}>
                  recommended
                </span>
              </div>
              <h3 className="text-lg font-semibold m-0" style={{ fontFamily: "var(--font-family-sans)", color: '#e8e8f0' }}>
                dopple deploy
              </h3>
              <p className="text-[13px] m-0" style={{ color: '#9999b0' }}>
                CLI tool for automated builds, versioning, and deployment.
              </p>
              <div className="flex flex-col gap-3 mt-auto">
                <p className="text-[12px] m-0 mb-2" style={{ color: '#9999b0' }}>
                  Install the skill from <a href="#quickstart" style={{ color: '#00d4ff' }}>Quick Start</a> above, then:
                </p>
                <CodeBlock code={`# In your project root
dopple init    # configure name, build, entry
dopple deploy  # build, bundle, push`} />
              </div>
            </div>

            {/* Studio upload */}
            <div className="rounded-xl p-5 flex flex-col gap-4" style={{ background: '#181822', border: '1px solid #ffffff08' }}>
              <h3 className="text-lg font-semibold m-0" style={{ fontFamily: "var(--font-family-sans)", color: '#e8e8f0' }}>
                Studio Upload
              </h3>
              <p className="text-[13px] m-0" style={{ color: '#9999b0' }}>
                Upload a ZIP bundle directly through the Dopple Studio web UI.
              </p>
              <ol className="text-[13px] m-0 pl-5 flex flex-col gap-2 mt-auto" style={{ color: '#a8a8b8' }}>
                <li>Build your project <code className="text-[12px] px-1 py-0.5 rounded" style={{ background: '#1c1c2a', color: '#00d4ff', fontFamily: "var(--font-family-sans)" }}>npm run build</code></li>
                <li>ZIP the output directory</li>
                <li>Create new activity → Upload Bundle</li>
                <li>Select your ZIP, pick the entry point HTML</li>
                <li>Activity is live — share the QR page URL</li>
              </ol>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────── */}
        <footer className="pt-8 pb-16 text-center" style={{ borderTop: '1px solid #ffffff06' }}>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span
              className="text-[11px] uppercase tracking-[0.2em]"
              style={{ color: '#707088', fontFamily: "var(--font-family-sans)" }}
            >
              Dopple Studio
            </span>
          </div>
          <div className="flex gap-4 justify-center text-[13px]">
            <a href="/" className="no-underline transition-colors" style={{ color: '#9999b0' }}>
              Studio
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility sub-components
// ---------------------------------------------------------------------------

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span
        className="text-[13px] font-medium"
        style={{ color: '#00d4ff40', fontFamily: "var(--font-family-sans)" }}
      >
        {number}
      </span>
      <h2
        className="text-3xl font-bold m-0"
        style={{ fontFamily: "var(--font-family-sans)", color: '#f0f0f8', letterSpacing: '-0.01em' }}
      >
        {title}
      </h2>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold mt-0.5"
        style={{
          background: '#00d4ff10',
          color: '#00d4ff',
          border: '1px solid #00d4ff20',
          fontFamily: "var(--font-family-sans)",
        }}
      >
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-semibold m-0 mb-3" style={{ color: '#e0e0e8', fontFamily: "var(--font-family-sans)" }}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
